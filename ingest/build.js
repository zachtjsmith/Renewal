#!/usr/bin/env node
/* ============================================================================
   build.js — sweep every board, write the site's job data
   ----------------------------------------------------------------------------
     npm run ingest                          everything: curated + open list
     npm run ingest -- --curated-only        just ingest/companies.js
     npm run ingest -- --ats=greenhouse,lever   only these ATSes
     npm run ingest -- --limit=500           first N boards (debugging)
     npm run ingest -- --strict              drop roles with no published salary
     npm run ingest -- --max-age=90          freshness window (default 180 days)
     npm run verify                          which boards are alive, per ATS

   OUTPUT
     public/jobs.json         the index: everything the board needs to list,
                              filter and search. One listing per line.
     public/jobs/d-NN.json    64 detail shards: descriptions and apply links,
                              loaded only when someone opens a listing.

   Both are written in a stable order and carry no "days ago" field, so the
   nightly commit only contains listings that genuinely changed. That keeps
   git history small even at tens of thousands of listings.
   ========================================================================== */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTERS, SOURCE_LABEL, stats as httpStats } from "./adapters.js";
import { allCompanies } from "./companies.js";
import { DEMO } from "./demo-companies.js";
import { normalize, DROP, isForeignLocation } from "./lib/normalize.js";
import { dedupe } from "./lib/dedupe.js";
import { mightMatch } from "./lib/classify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_INDEX = path.join(ROOT, "public", "jobs.json");
const OUT_SHARDS = path.join(ROOT, "public", "jobs");
const FEATURED = path.join(ROOT, "featured.json");
const SHARDS = 64;

/* --- args ---------------------------------------------------------------- */
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : dflt;
};
const OPTS = {
  requireSalary: argv.includes("--strict"),
  maxAgeDays: Number(flag("max-age", 180)),
  geoFilter: !argv.includes("--global"),
};
const LIMIT = Number(flag("limit", 0)) || Infinity;
const ONLY_ATS = flag("ats", "") ? new Set(flag("ats").split(",")) : null;
const WORKERS = Number(flag("workers", 24));

/* --- helpers ------------------------------------------------------------- */

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/* Alternate ATSes in the work queue. Every vendor has its own small
   concurrency limit, so a queue of 6,000 Greenhouse boards in a row would
   leave the other five vendors idle for most of the run. */
function interleave(list) {
  const groups = new Map();
  for (const c of list) {
    if (!groups.has(c.ats)) groups.set(c.ats, []);
    groups.get(c.ats).push(c);
  }
  const queues = [...groups.values()];
  const out = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift());
  return out;
}

async function pool(items, size, worker) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await worker(items[idx], idx); }
  }));
}

/* Title-first pre-filter: fetch a full description only if this listing
   could possibly end up on the board. */
const wants = (title, locationText) => mightMatch(title) && !(OPTS.geoFilter && isForeignLocation(locationText));

function companyList() {
  if (argv.includes("--demo")) return DEMO;
  let list = allCompanies({ curatedOnly: argv.includes("--curated-only") });
  if (ONLY_ATS) list = list.filter((c) => ONLY_ATS.has(c.ats));
  list = interleave(list);
  return Number.isFinite(LIMIT) ? list.slice(0, LIMIT) : list;
}

/* --- output -------------------------------------------------------------- */

// What the board needs to list, filter and search — kept deliberately lean.
const INDEX_FIELDS = [
  "id", "title", "company", "industry", "family", "segment", "location",
  "locations", "mode", "modes", "min", "max", "payVaries", "variable", "book",
  "stack", "postedAt", "source", "featured",
];
// What only matters once someone opens a listing.
const DETAIL_FIELDS = ["summary", "sections", "applyUrl", "companySite", "variants"];

function pick(obj, keys) {
  const o = {};
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || v === false) continue;
    o[k] = v;
  }
  return o;
}

async function writeOutput(jobs, meta) {
  const sorted = [...jobs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const index = [];
  const shards = Array.from({ length: SHARDS }, () => []);
  for (const j of sorted) {
    const s = fnv1a(j.id) % SHARDS;
    index.push({ ...pick(j, INDEX_FIELDS), s });
    shards[s].push([j.id, pick(j, DETAIL_FIELDS)]);
  }

  // One listing per line: compact, and git diffs stay line-sized.
  const lines = index.map((r) => JSON.stringify(r));
  const head = JSON.stringify({ generatedAt: meta.generatedAt, count: index.length, shards: SHARDS, sources: meta.sources });
  const indexText = `${head.slice(0, -1)},"jobs":[\n${lines.join(",\n")}\n]}\n`;

  await fs.mkdir(path.dirname(OUT_INDEX), { recursive: true });
  await fs.writeFile(OUT_INDEX, indexText);

  await fs.rm(OUT_SHARDS, { recursive: true, force: true });
  await fs.mkdir(OUT_SHARDS, { recursive: true });
  let shardBytes = 0;
  for (let s = 0; s < SHARDS; s++) {
    const body = shards[s].map(([id, d]) => `${JSON.stringify(id)}:${JSON.stringify(d)}`).join(",\n");
    const text = `{\n${body}\n}\n`;
    shardBytes += text.length;
    await fs.writeFile(path.join(OUT_SHARDS, `d-${String(s).padStart(2, "0")}.json`), text);
  }
  return { indexBytes: indexText.length, shardBytes };
}

/* --- main ---------------------------------------------------------------- */

async function run() {
  const list = companyList();
  const started = Date.now();
  const byAts = list.reduce((a, c) => ((a[c.ats] = (a[c.ats] || 0) + 1), a), {});

  console.log(`\nRenewal ingest — ${list.length.toLocaleString()} boards`);
  console.log(`  ${Object.entries(byAts).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(" · ")}`);
  console.log(`  salary required: ${OPTS.requireSalary ? "yes (--strict)" : "no"} · max age: ${OPTS.maxAgeDays} days\n`);

  const drops = Object.fromEntries(Object.values(DROP).map((d) => [d, 0]));
  const boardStats = { ok: 0, empty: 0, failed: 0, failures: [] };
  const perCompany = new Map();
  const collected = [];
  let seen = 0, done = 0;

  await pool(list, WORKERS, async (company) => {
    const adapter = ADAPTERS[company.ats];
    try {
      if (!adapter) throw new Error(`no adapter for "${company.ats}"`);
      const raws = await adapter(company, { wants });
      seen += raws.length;
      let kept = 0;
      for (const raw of raws) {
        const { job, drop } = normalize(raw, company, OPTS);
        if (drop) { drops[drop] = (drops[drop] || 0) + 1; continue; }
        collected.push(job);
        kept++;
      }
      if (kept) { boardStats.ok++; perCompany.set(company.name, (perCompany.get(company.name) || 0) + kept); }
      else boardStats.empty++;
    } catch (e) {
      boardStats.failed++;
      if (boardStats.failures.length < 5000) {
        boardStats.failures.push({ ats: company.ats, token: company.token, error: e.status ? `HTTP ${e.status}` : e.name === "AbortError" ? "timeout" : e.message });
      }
    }
    done++;
    if (done % 1000 === 0 || done === list.length) {
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      console.log(`  ${done.toLocaleString().padStart(7)} / ${list.length.toLocaleString()} boards · ${collected.length.toLocaleString()} matches · ${mins} min`);
    }
  });

  /* --- paid placements --------------------------------------------------- */
  let featuredRules = { matches: [] };
  try { featuredRules = JSON.parse(await fs.readFile(FEATURED, "utf8")); } catch {}
  for (const job of collected) {
    job.featured = (featuredRules.matches || []).some(
      (r) =>
        (!r.company || job.company.toLowerCase() === String(r.company).toLowerCase()) &&
        (!r.titleContains || job.title.toLowerCase().includes(String(r.titleContains).toLowerCase()))
    );
  }

  /* --- dedupe + write ---------------------------------------------------- */
  const { jobs: final, stats: dd } = dedupe(collected);
  const sources = [...new Set(final.map((j) => j.source))].sort();
  const { indexBytes, shardBytes } = await writeOutput(final, { generatedAt: new Date().toISOString(), sources });

  /* --- report ------------------------------------------------------------ */
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`\n  ${seen.toLocaleString()} postings read from ${(boardStats.ok + boardStats.empty).toLocaleString()} live boards in ${mins} min`);
  console.log(`  ${httpStats.requests.toLocaleString()} requests, ${httpStats.retries} retries`);
  console.log(`\n  ${collected.length.toLocaleString()} matched → ${final.length.toLocaleString()} listings after dedupe`);
  console.log(`    ${dd.sameUrl} same apply link · ${dd.sameLocation} reposts · ${dd.multiLocationMerged} merged as one role in several cities`);

  const fam = final.reduce((a, j) => ((a[j.family] = (a[j.family] || 0) + 1), a), {});
  console.log(`\n  by family:`);
  for (const [k, v] of Object.entries(fam).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(6)}  ${k}`);

  // Per-source counts, so a source that quietly returns nothing stands out.
  const bySource = final.reduce((a, j) => ((a[j.source] = (a[j.source] || 0) + 1), a), {});
  console.log(`\n  by source:`);
  for (const [ats, label] of Object.entries(SOURCE_LABEL)) {
    if (!byAts[ats]) continue; // not part of this run
    const n = bySource[label] || 0;
    console.log(`    ${String(n).padStart(6)}  ${label}${n ? "" : "   <- nothing from this source"}`);
  }

  const withPay = final.filter((j) => j.min != null).length;
  console.log(`\n  ${withPay.toLocaleString()} of ${final.length.toLocaleString()} publish a salary (${Math.round((withPay / (final.length || 1)) * 100)}%). The rest show "See job listing".`);

  console.log(`\n  dropped:`);
  for (const [reason, n] of Object.entries(drops).sort((a, b) => b[1] - a[1])) if (n) console.log(`    ${String(n).padStart(7)}  ${reason}`);

  const top = [...perCompany.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (top.length) {
    console.log(`\n  most listings:`);
    for (const [name, n] of top) console.log(`    ${String(n).padStart(5)}  ${name}`);
  }

  if (boardStats.failed) {
    const byErr = boardStats.failures.reduce((a, f) => ((a[`${f.ats} ${f.error}`] = (a[`${f.ats} ${f.error}`] || 0) + 1), a), {});
    console.log(`\n  ${boardStats.failed.toLocaleString()} boards unreachable (usually a company that changed ATS — normal at this scale):`);
    for (const [k, v] of Object.entries(byErr).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ${String(v).padStart(6)}  ${k}`);
  }

  console.log(`\n  wrote public/jobs.json (${kb(indexBytes)}) + ${SHARDS} detail shards (${kb(shardBytes)} total)\n`);
}

/* --- verify mode --------------------------------------------------------- */

async function verify() {
  const list = companyList();
  console.log(`\nChecking ${list.length.toLocaleString()} boards...\n`);
  const tally = {};
  const dead = [];
  let done = 0;
  await pool(list, WORKERS, async (c) => {
    const t = (tally[c.ats] ||= { alive: 0, dead: 0 });
    try { await ADAPTERS[c.ats](c, { wants: () => false }); t.alive++; }
    catch (e) { t.dead++; if (dead.length < 200) dead.push(`${c.ats}/${c.token}`); }
    if (++done % 1000 === 0) console.log(`  ${done.toLocaleString()} / ${list.length.toLocaleString()}`);
  });
  console.log("");
  for (const [ats, t] of Object.entries(tally)) {
    console.log(`  ${ats.padEnd(16)} ${String(t.alive).padStart(6)} alive  ${String(t.dead).padStart(6)} unreachable`);
  }
  if (dead.length) console.log(`\n  first unreachable: ${dead.slice(0, 20).join(", ")}`);
  console.log("");
}

const mode = argv.includes("--verify") ? verify : run;
mode().catch((e) => { console.error(e); process.exit(1); });
