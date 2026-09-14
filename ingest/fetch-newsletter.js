#!/usr/bin/env node
/* ============================================================================
   fetch-newsletter.js — pull published issues into public/content.json
   ----------------------------------------------------------------------------
     npm run newsletter

   Every serious newsletter platform publishes an RSS feed of sent issues:

     Beehiiv      https://yourpub.beehiiv.com/feed
     Substack     https://yourpub.substack.com/feed
     Buttondown   https://buttondown.com/yourname/rss
     ConvertKit   https://yourname.ck.page/posts/feed
     Ghost        https://yoursite.com/rss/

   Put yours in NEWSLETTER_FEED below (or set the env var), then run this after
   each send. It rewrites only the "issues" array — your resources are left
   alone — so you never have to hand-edit a listing again.

   If you'd rather not automate it, skip this entirely and edit the issues
   array in public/content.json by hand. Both work.
   ========================================================================== */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.resolve(__dirname, "..", "public", "content.json");

const NEWSLETTER_FEED = process.env.NEWSLETTER_FEED || "";
const MAX_ISSUES = 12;

/* --- tiny RSS/Atom reader (no dependencies) ------------------------------ */

const strip = (s) =>
  String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#3[49];/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? strip(m[1]) : "";
};

function parseFeed(xml) {
  const chunks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ].map((m) => m[0]);

  return chunks.map((c) => {
    // Atom puts the URL in an attribute rather than element text.
    let link = tag(c, "link");
    if (!link) {
      const href = c.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = href ? href[1] : "";
    }
    const teaserRaw = tag(c, "description") || tag(c, "summary") || tag(c, "content:encoded") || tag(c, "content");
    return {
      title: tag(c, "title"),
      url: link,
      date: tag(c, "pubDate") || tag(c, "published") || tag(c, "updated") || "",
      teaser: teaserRaw.length > 210 ? teaserRaw.slice(0, 210).replace(/\s+\S*$/, "") + "…" : teaserRaw,
    };
  }).filter((i) => i.title && i.url);
}

/* --- main ---------------------------------------------------------------- */

async function run() {
  if (!NEWSLETTER_FEED) {
    console.log(`
  No feed configured.

  Either set one:
      NEWSLETTER_FEED=https://yourpub.beehiiv.com/feed npm run newsletter

  ...or edit ingest/fetch-newsletter.js and put your feed URL in
  NEWSLETTER_FEED. You can also just edit the "issues" array in
  public/content.json by hand — that works exactly as well.
`);
    process.exit(0);
  }

  console.log(`\n  Reading ${NEWSLETTER_FEED}`);
  const res = await fetch(NEWSLETTER_FEED, {
    headers: { "User-Agent": "RenewalJobBoard/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
  });
  if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}. Check the URL in a browser first.`);

  const items = parseFeed(await res.text());
  if (!items.length) throw new Error("No issues found in that feed. Open it in a browser — is it really an RSS/Atom feed?");

  const content = JSON.parse(await fs.readFile(CONTENT, "utf8"));
  const total = items.length;

  // Newest first, numbered so the oldest issue is No. 1.
  content.issues = items.slice(0, MAX_ISSUES).map((it, i) => ({
    n: total - i,
    date: it.date ? new Date(it.date).toISOString().slice(0, 10) : "",
    title: it.title,
    teaser: it.teaser,
    url: it.url,
  }));

  await fs.writeFile(CONTENT, JSON.stringify(content, null, 2));
  console.log(`  ${content.issues.length} issue(s) written to public/content.json`);
  console.log(`  Most recent: ${content.issues[0].title}\n`);
  console.log(`  Commit and push to publish.\n`);
}

run().catch((e) => { console.error(`\n  ${e.message}\n`); process.exit(1); });
