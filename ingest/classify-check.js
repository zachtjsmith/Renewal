#!/usr/bin/env node
/* ============================================================================
   classify-check.js — test job titles against the board's filter
   ----------------------------------------------------------------------------
     npm run classify -- "Senior Customer Success Manager"
     npm run classify -- "Customer Success Manager" "Account Executive" "CSM"
     npm run classify                       # runs a built-in sample set

   Use this whenever you add a title pattern to ingest/lib/classify.js. It tells
   you immediately whether a title would be kept, which family it lands in, and
   if it's dropped, exactly which rule dropped it — so you're not guessing and
   re-running a 40-board ingest to find out.
   ========================================================================== */

import { classify, segment, seniority } from "./lib/classify.js";

const SAMPLES = [
  // should be kept
  "Customer Success Manager",
  "Senior Customer Success Manager",
  "CSM, Mid-Market",
  "Client Success Lead",
  "Strategic Account Manager",
  "Technical Account Manager",
  "Renewals Manager",
  "Customer Onboarding Specialist",
  "Implementation Consultant",
  "Customer Success Operations Manager",
  "Director of Customer Success",
  "VP, Customer Experience",
  // should be dropped
  "Software Engineer, Customer Success Platform",
  "Account Executive, Enterprise",
  "Customer Support Specialist",
  "Sales Development Representative",
  "UX Designer, Customer Experience",
  "Customer Success Manager (Intern)",
];

const titles = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const list = titles.length ? titles : SAMPLES;

if (!titles.length) {
  console.log(`\n  No titles given — showing the built-in sample set.`);
  console.log(`  Try: npm run classify -- "Your Job Title Here"\n`);
}

const GREEN = "\x1b[32m", RED = "\x1b[31m", DIM = "\x1b[2m", OFF = "\x1b[0m";
const width = Math.min(52, Math.max(...list.map((t) => t.length)) + 2);

let kept = 0, dropped = 0;

console.log("");
for (const title of list) {
  const v = classify({ title });
  if (v.keep) {
    kept++;
    const lvl = seniority(title);
    const seg = segment(title, "");
    console.log(
      `  ${GREEN}KEEP${OFF}  ${title.padEnd(width)} ${v.family}` +
      `${DIM}  ·  ${lvl}${seg ? "  ·  " + seg : ""}${OFF}`
    );
  } else {
    dropped++;
    console.log(`  ${RED}DROP${OFF}  ${title.padEnd(width)} ${DIM}${v.reason}${OFF}`);
  }
}

console.log(`\n  ${kept} kept, ${dropped} dropped.\n`);

if (dropped && titles.length) {
  console.log(`  A title you expected to keep got dropped?`);
  console.log(`  - "excluded title: ..." means a rule in EXCLUDE_TITLE caught it.`);
  console.log(`    That list runs FIRST and always wins. Loosen the rule it names.`);
  console.log(`  - "no CS signal" means nothing in FAMILY_RULES matched.`);
  console.log(`    Add a pattern to the family you want it in.\n`);
}
