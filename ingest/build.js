#!/usr/bin/env node
/* ============================================================================
   build.js — run the whole pipeline and write public/jobs.json
   ----------------------------------------------------------------------------
     npm run ingest                 normal run
     npm run ingest -- --strict     drop roles with no published salary
     npm run ingest -- --max-age=90 widen the freshness window
     npm run ingest -- --limit=5    only hit the first 5 companies (debugging)
     npm run verify                 check which board tokens are still alive
   ========================================================================== */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTERS } from "./adapters.js";
import { COMPANIES } from "./companies.js";
import { DEMO } from "./demo-companies.js";
import { normalize, dedupe, DROP } from "./lib/normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "jobs.json");
const FEATURED = path.join(ROOT, "featured.json");

/* --- args ---------------------------------------------------------------- */
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : dflt;
};
const OPTS = {
  requireSalary: argv.includes("--strict"),
  maxAgeDays: Number(flag("max-age", 45)),
  geoFilter: !argv.includes("--global"),
};
const LIMIT = Number(flag("limit", 0)) || 9999;
const CONCURRENCY = Number(flag("concurrency", 5));

/* --- small helpers ------------------------------------------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pool(items, size, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
      await sleep(250); // be a polite guest on someone else's API
    }
  });
  await Promise.all(runners);
  return results;
}

async function withRetry(fn, tries = 3) {
  let last;
  for (let n = 0; n < tries; n++) {
    try { return await fn(); }
    catch (e) { last = e; await sleep(600 * (n + 1)); }
  }
  throw last;
}

/* --- main ---------------------------------------------------------------- */

async function run() {
  const source = argv.includes("--demo") ? DEMO : COMPANIES;
  const list = source.slice(0, LIMIT);
  const started = Date.now();

  console.log(`\nRenewal ingest — ${list.length} boards`);
  console.log(`  salary required : ${OPTS.requireSalary ? "yes (--strict)" : "no — shown when published"}`);
  console.log(`  max age         : ${OPTS.maxAgeDays} days\n`);

  const drops = { [DROP.NOT_CS]: 0, [DROP.NO_SALARY]: 0, [DROP.TOO_OLD]: 0, [DROP.NO_URL]: 0, [DROP.SHALLOW_URL]: 0, [DROP.BAD_GEO]: 0 };
  const failures = [];
  let seen = 0;
  const collected = [];

  await pool(list, CONCURRENCY, async (company) => {
    const adapter = ADAPTERS[company.ats];
    if (!adapter) {
      failures.push({ company: company.name, error: `unknown ats "${company.ats}"` });
      return;
    }
    try {
      const raws = await withRetry(() => adapter(company));
      seen += raws.length;
      let kept = 0;
      for (const raw of raws) {
        const { job, drop } = normalize(raw, company, OPTS);
        if (drop) { drops[drop] = (drops[drop] || 0) + 1; continue; }
        collected.push(job);
        kept++;
      }
      const pad = company.name.padEnd(22);
      console.log(`  ok   ${pad} ${String(raws.length).padStart(4)} postings → ${kept} listed`);
    } catch (e) {
      failures.push({ company: company.name, token: company.token, ats: company.ats, error: e.message });
      console.log(`  FAIL ${company.name.padEnd(22)} ${e.message}`);
    }
  });

  /* --- featured overlay: this is the paid inventory ---------------------- *
     featured.json is edited by hand (or by your payment webhook) and looks
     like: { "matches": [{ "company": "Ramp", "titleContains": "Customer Success" }] }
     Anything it matches gets pinned to the top of the board.               */
  let featuredRules = { matches: [] };
  try { featuredRules = JSON.parse(await fs.readFile(FEATURED, "utf8")); } catch {}
  for (const job of collected) {
    job.featured = (featuredRules.matches || []).some(
      (r) =>
        (!r.company || job.company.toLowerCase() === String(r.company).toLowerCase()) &&
        (!r.titleContains || job.title.toLowerCase().includes(String(r.titleContains).toLowerCase()))
    );
  }

  const final = dedupe(collected).sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.posted - b.posted;
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    count: final.length,
    sources: [...new Set(final.map((j) => j.source))],
    jobs: final,
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(payload, null, 2));

  /* --- report ------------------------------------------------------------ */
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n  ${seen} postings seen across ${list.length} boards in ${secs}s`);
  console.log(`  ${collected.length} matched customer success, ${final.length} after dedupe\n`);
  console.log(`  dropped:`);
  for (const [reason, n] of Object.entries(drops)) {
    if (n) console.log(`    ${String(n).padStart(5)}  ${reason}`);
  }
  if (failures.length) {
    console.log(`\n  ${failures.length} board(s) failed — likely a dead or renamed token:`);
    for (const f of failures) console.log(`    ${f.ats}/${f.token} (${f.company}) — ${f.error}`);
    console.log(`  Run \`npm run verify\` to confirm, then fix them in ingest/companies.js`);
  }
  const withPay = final.filter((j) => j.min != null).length;
  console.log(`\n  ${withPay} of ${final.length} listings publish a salary (${Math.round((withPay / (final.length || 1)) * 100)}%).`);
  console.log(`  The rest show "See job listing" — no figure is ever estimated.`);
  if (!OPTS.requireSalary) console.log(`  Use --strict to drop them instead.`);
  console.log(`\n  wrote ${path.relative(ROOT, OUT)}\n`);
}

/* --- verify mode --------------------------------------------------------- */

async function verify() {
  console.log(`\nChecking ${COMPANIES.length} board tokens...\n`);
  const dead = [];
  await pool(COMPANIES, 5, async (c) => {
    try {
      const raws = await ADAPTERS[c.ats](c);
      console.log(`  ok    ${c.ats.padEnd(11)} ${c.token.padEnd(18)} ${raws.length} postings`);
    } catch (e) {
      dead.push(c);
      console.log(`  DEAD  ${c.ats.padEnd(11)} ${c.token.padEnd(18)} ${e.message}`);
    }
  });
  console.log(`\n  ${COMPANIES.length - dead.length} alive, ${dead.length} dead.`);
  if (dead.length) {
    console.log(`  Remove or fix these in ingest/companies.js:`);
    for (const d of dead) console.log(`    { ats: "${d.ats}", token: "${d.token}", name: "${d.name}" }`);
  }
  console.log();
}

const mode = argv.includes("--verify") ? verify : run;
mode().catch((e) => { console.error(e); process.exit(1); });
