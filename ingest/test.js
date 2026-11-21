#!/usr/bin/env node
/* ============================================================================
   test.js — run with `npm test`
   ----------------------------------------------------------------------------
   The board's promise is that every field on a listing came from the posting.
   Most of these tests prove the opposite of the usual thing: that when a
   posting is SILENT about salary, book size, segment or tooling, the pipeline
   returns nothing rather than a plausible guess.
   ========================================================================== */

import {
  parseSalaryFromText, parseBook, parseVariable, parseStack,
  cleanLocation, extractDetail,
} from "./lib/parse.js";
import { classify, segment } from "./lib/classify.js";
import { normalize, isDeepLink, applyLinkQuality, homepageOf } from "./lib/normalize.js";
import { dedupe, titleKey, companyKey, urlKey, displayTitle } from "./lib/dedupe.js";
import { mightMatch, INCLUDE } from "./lib/classify.js";

let pass = 0, fail = 0;
const failures = [];
const ok = (name, cond, detail) => cond ? pass++ : (fail++, failures.push(`${name}${detail ? " — " + detail : ""}`));
const eq = (name, a, e) => ok(name, JSON.stringify(a) === JSON.stringify(e), `got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`);

/* ========================================================================== */
console.log("\n── salary: should find ──");
for (const [text, min, max] of [
  ["$120,000 - $150,000", 120000, 150000],
  ["The base salary range for this role is $130,000 to $165,000 USD.", 130000, 165000],
  ["Compensation: $95K–$120K plus equity", 95000, 120000],
  ["Pay range $110,000—$140,000 annually", 110000, 140000],
  ["$45 - $60 per hour", 93600, 124800],
  ["Base salary of $145,000", 145000, 145000],
  ["$150k-$185k", 150000, 185000],
]) {
  const r = parseSalaryFromText(text);
  ok(`"${text.slice(0, 40)}"`, r && r.min === min && r.max === max, r ? `got ${r.min}–${r.max}` : "got null");
}

console.log("── salary: never invented ──");
for (const text of [
  "You will own a book of business worth $4.2M ARR",
  "Manage accounts generating $250,000 in annual recurring revenue",
  "We recently raised $50M in Series C funding",
  "Carry a quota of $900,000 in expansion revenue",
  "401(k) with company match",
  "Help customers save $10,000 - $50,000 per year",
  "Competitive salary and a great benefits package",
  "Salary commensurate with experience",
]) {
  ok(`silent/decoy: "${text.slice(0, 40)}"`, parseSalaryFromText(text) === null, "wrongly produced a number");
}

console.log("── salary: picks the cued range over a decoy ──");
{
  const messy = `You'll manage a portfolio driving $3M ARR in retention.
    Customers typically save $20,000 - $40,000 annually using our platform.
    The base salary range for this position is $125,000 - $155,000.`;
  const r = parseSalaryFromText(messy);
  ok("picks base salary, not customer savings", r && r.min === 125000 && r.max === 155000, r ? `got ${r.min}–${r.max}` : "null");
}

/* ========================================================================== */
console.log("\n── classify: keep ──");
for (const [title, family] of [
  ["Senior Customer Success Manager", "Customer Success"],
  ["CSM - Mid Market", "Customer Success"],
  ["Client Success Lead", "Customer Success"],
  ["Strategic Account Manager", "Account Management"],
  ["Technical Account Manager", (INCLUDE.technicalAccountManagement ? "Technical Account Management" : "Account Management")],
  ["Renewals Manager", "Renewals"],
  ["Customer Onboarding Specialist", "Onboarding"],
  ["Implementation Consultant", "Onboarding"],
  ["Customer Success Operations Manager", "CS Operations"],
  ["Director of Customer Success", "Leadership"],
  ["VP, Customer Experience", "Leadership"],
]) {
  const v = classify({ title });
  ok(`keep "${title}" → ${family}`, v.keep && v.family === family, v.keep ? `got ${v.family}` : `dropped: ${v.reason}`);
}

console.log("── classify: reject ──");
for (const title of [
  "Software Engineer, Customer Success Platform",
  "Customer Support Specialist",
  "Technical Support Engineer",
  "UX Designer, Customer Experience",
  "Customer Success Manager (Intern)",
  "Recruiter, Customer Success Team",
]) {
  ok(`reject "${title}"`, !classify({ title }).keep, "wrongly kept");
}

console.log("── classify: the roles around customer success (19 November 2026) ──");
for (const [title, family, dial] of [
  ["Senior TAM, Enterprise", "Technical Account Management", "technicalAccountManagement"],
  ["Director, Technical Account Management", "Technical Account Management", "technicalAccountManagement"],
  ["Solutions Consultant", "Solutions & Sales Engineering", "solutionsEngineering"],
  ["Senior Sales Engineer", "Solutions & Sales Engineering", "solutionsEngineering"],
  ["Solutions Engineer, Enterprise", "Solutions & Sales Engineering", "solutionsEngineering"],
  ["Pre-Sales Consultant", "Solutions & Sales Engineering", "solutionsEngineering"],
  ["Solutions Engineering Manager", "Solutions & Sales Engineering", "solutionsEngineering"],
  ["Head of Presales", "Solutions & Sales Engineering", "solutionsEngineering"],
  ["Product Marketing Manager", "Product Marketing", "productMarketing"],
  ["Director of Product Marketing", "Product Marketing", "productMarketing"],
  ["Product Manager", "Product Management", "productManagement"],
  ["Senior Product Manager - Customer Success", "Product Management", "productManagement"],
  ["Product Manager, Customer Success", "Product Management", "productManagement"],
  ["VP of Product", "Product Management", "productManagement"],
  ["Product Owner", "Product Management", "productManagement"],
  ["Product Specialist", "Product Specialist", "productSpecialists"],
  ["Senior Product Expert", "Product Specialist", "productSpecialists"],
]) {
  const v = classify({ title });
  if (INCLUDE[dial]) ok(`keep "${title}" → ${family}`, v.keep && v.family === family, v.keep ? `got ${v.family}` : `dropped: ${v.reason}`);
  else if (dial === "technicalAccountManagement" && /technical account/i.test(title)) ok(`"${title}" back under Account Management`, v.keep && v.family === "Account Management", v.keep ? `got ${v.family}` : `dropped: ${v.reason}`);
  else if (dial === "technicalAccountManagement") ok(`dial off: "${title}" (abbreviation only) stays off`, !v.keep, `wrongly kept as ${v.family}`);
  else ok(`dial off: "${title}" stays off the board`, !v.keep, `wrongly kept as ${v.family}`);
}
ok("Customer Success Operations Specialist → CS Operations", classify({ title: "Customer Success Operations Specialist" }).family === "CS Operations");
ok("Director of Customer Success, Product-Led Growth → Leadership", classify({ title: "Director of Customer Success, Product-Led Growth" }).family === "Leadership");
for (const title of [
  "Engineering Manager, Solutions", "Software Engineering Manager", "Product Designer", "Head of Product Design",
  "Product Analyst", "Product Support Specialist", "Director, Product Support", "Product Engineer",
  "Marketing Manager", "Program Manager", "Sales Consultant", "Product Sales Specialist",
  "Software Engineer, Product", "Solutions Architect", "Product Manager Intern",
]) {
  ok(`reject "${title}"`, !classify({ title }).keep, "wrongly kept");
}

console.log("── classify: titles added on request ──");
for (const [title, family] of [
  ["Customer Success Manager/Representative", "Customer Success"],
  ["Customer Success Operations", "CS Operations"],
  ["Customer Success Specialist", "Customer Success"],
  ["Customer Success Representative", "Customer Success"],
  ["Client Success Manager", "Customer Success"],
  ["Client Services Manager", "Customer Success"],
  ["Client Services Coordinator", "Customer Success"],
  ["Director of Client Services", "Leadership"],
  ["Technical Account Manager", (INCLUDE.technicalAccountManagement ? "Technical Account Management" : "Account Management")],
  ["Strategic Account Manager", "Account Management"],
]) {
  const v = classify({ title });
  ok(`keep "${title}" → ${family}`, v.keep && v.family === family, v.keep ? `got ${v.family}` : `dropped: ${v.reason}`);
}

console.log("── classify: industry-specific success titles ──");
for (const [title, family] of [
  ["Merchant Success Manager", "Customer Success"],
  ["Partner Success Manager", "Customer Success"],
  ["Member Success Manager", "Customer Success"],
  ["Seller Success Manager", "Customer Success"],
  ["Provider Success Manager", "Customer Success"],
  ["Client Outcomes Manager", "Customer Success"],
  ["Customer Experience Manager", "Customer Success"],
  ["Customer Adoption Manager", "Customer Success"],
  ["Customer Enablement Manager", "Customer Success"],
  ["Value Consultant", "Customer Success"],
  ["Value Realization Manager", "Customer Success"],
  ["Technical Success Manager", "Customer Success"],
  ["CX Manager", "Customer Success"],
  ["Customer Advocate", "Customer Success"],
  ["Partner Manager", "Account Management"],
  ["Channel Account Manager", "Account Management"],
  ["Client Partner", "Account Management"],
  ["Customer Relationship Manager", "Account Management"],
  ["Implementation Consultant", "Onboarding"],
  ["Deployment Manager", "Onboarding"],
  ["Professional Services Consultant", "Onboarding"],
  ["Retention Manager", "Renewals"],
  ["Subscription Manager", "Renewals"],
  ["Chief Customer Officer", "Leadership"],
  ["Head of Customer Success", "Leadership"],
  ["SVP, Client Experience", "Leadership"],
]) {
  const v = classify({ title });
  ok(`keep "${title}" → ${family}`, v.keep && v.family === family, v.keep ? `got ${v.family}` : `dropped: ${v.reason}`);
}

console.log("── classify: the wider net must not leak ──");
for (const title of [
  "Customer Service Representative",
  "Customer Care Representative",
  "Support Engineer",
  "Help Desk Technician",
  "Technical Support Tier 2",
  "Customer Marketing Manager",
  "Contract Customer Success Manager",
  "Accounts Receivable Specialist",
]) {
  ok(`reject "${title}"`, !classify({ title }).keep, "wrongly kept");
}

console.log("── classify: exclusions beat the department fallback ──");
for (const title of ["Customer Service Representative", "Customer Support Specialist", "Software Engineer, Customer Success Platform"]) {
  const v = classify({ title, department: "Customer Success" });
  ok(`  "${title}" still dropped inside a CS department`, !v.keep, v.keep ? `wrongly kept as ${v.family}` : "");
}

console.log("── classify: Sales & BD and account-lead titles ──");
for (const [title, family] of [
  ["Business Development Representative", "Sales & BD"],
  ["Sales Development Representative", "Sales & BD"],
  ["Senior BDR", "Sales & BD"],
  ["SDR", "Sales & BD"],
  ["Business Development Manager", "Sales & BD"],
  ["Director of Business Development", "Sales & BD"],
  ["Account Development Representative", "Sales & BD"],
  ["Account Lead", "Account Management"],
  ["Accounts Director", "Account Management"],
  ["Key Account Manager", "Account Management"],
  ["Director of Accounts", "Leadership"],
  ["Head of Key Accounts", "Leadership"],
]) {
  const v = classify({ title });
  if (family === "Sales & BD" && !INCLUDE.businessDevelopment) {
    ok(`"${title}" stays out while Sales & BD is off`, !v.keep, `kept as ${v.family}`);
  } else {
    ok(`keep "${title}" → ${family}`, v.keep && v.family === family, v.keep ? `got ${v.family}` : `dropped: ${v.reason}`);
  }
}
console.log("── classify: support leadership in, front line out ──");
for (const title of [
  "Customer Support Manager", "Director of Customer Support", "Head of Support",
  "Customer Service Manager", "Service Delivery Manager", "VP, Global Support",
  "Support Operations Manager", "Manager, Technical Support", "Customer Care Manager",
]) {
  const v = classify({ title });
  if (INCLUDE.supportLeadership) ok(`keep "${title}" → Support & Service`, v.keep && v.family === "Support & Service", v.keep ? `got ${v.family}` : `dropped: ${v.reason}`);
  else ok(`"${title}" stays out while support leadership is off`, !v.keep, `kept as ${v.family}`);
}
for (const title of [
  "Customer Support Specialist", "Technical Support Engineer", "Support Agent",
  "Tier 2 Support Analyst", "Customer Service Representative", "Help Desk Technician",
]) ok(`front line stays out: "${title}"`, !classify({ title }).keep, "wrongly kept");
eq("CS leadership unaffected", classify({ title: "Director of Customer Success" }).family, "Leadership");
eq("Client Services unaffected", classify({ title: "Director of Client Services" }).family, "Leadership");

console.log("── classify: the core board, every level ──");
for (const [title, family] of [
  ["Associate Customer Success Manager", "Customer Success"],
  ["Junior Customer Success Manager", "Customer Success"],
  ["Customer Success Manager II", "Customer Success"],
  ["Senior Customer Success Manager", "Customer Success"],
  ["Staff Customer Success Manager", "Customer Success"],
  ["Principal Customer Success Manager", "Customer Success"],
  ["Client Success Associate", "Customer Success"],
  ["Client Success Manager", "Customer Success"],
  ["Senior Client Success Manager", "Customer Success"],
  ["Client Success Lead", "Customer Success"],
  ["Junior Account Manager", "Account Management"],
  ["Associate Account Manager", "Account Management"],
  ["Account Manager II", "Account Management"],
  ["Senior Account Manager", "Account Management"],
  ["Strategic Account Manager", "Account Management"],
  ["Principal Account Manager", "Account Management"],
  ["Director of Customer Success", "Leadership"],
  ["VP of Customer Success", "Leadership"],
  ["Director of Client Success", "Leadership"],
  ["Head of Client Success", "Leadership"],
  ["Director of Account Management", "Leadership"],
  ["VP of Account Management", "Leadership"],
  ["Head of Account Management", "Leadership"],
  ["Chief Customer Officer", "Leadership"],
]) {
  const v = classify({ title });
  ok(`core: "${title}" → ${family}`, v.keep && v.family === family, v.keep ? `got ${v.family}` : `dropped: ${v.reason}`);
}

console.log("── classify: acronym and evergreen traps ──");
for (const title of [
  "MDR Analyst", "LDR Nurse", "ADR Specialist", "Director of Accounting",
  "General Application - Customer Success", "Future Opportunities: Account Manager",
  "Customer Success Manager - Talent Pool",
]) ok(`reject "${title}"`, !classify({ title }).keep, "wrongly kept");
ok("Account Executive follows its dial", classify({ title: "Account Executive" }).keep === INCLUDE.accountExecutives);
ok("BDR follows the businessDevelopment dial", classify({ title: "Sales Development Representative" }).keep === INCLUDE.businessDevelopment);

console.log("── title-first pre-filter ──");
ok("fetch a CSM", mightMatch("Customer Success Manager"));
ok("fetch a gated generic title (department decides)", mightMatch("Project Coordinator"));
ok("skip an excluded title", !mightMatch("Senior Software Engineer"));
ok("skip an evergreen post", !mightMatch("General Application"));

console.log("── classify: generic titles need a CS department ──");
for (const [title, dept, shouldKeep, family] of [
  ["Project Coordinator", "Customer Success", true, "Onboarding"],
  ["Project Coordinator", "Client Services", true, "Onboarding"],
  ["Marketing Coordinator", "Customer Success", true, "Customer Success"],
  ["Project Coordinator", "Engineering", false, null],
  ["Project Coordinator", "Construction", false, null],
  ["Marketing Coordinator", "Marketing", false, null],
  ["Project Coordinator", "", false, null],
  ["Marketing Coordinator", "", false, null],
  ["Engagement Manager", "Client Services", true, "Onboarding"],
  ["Engagement Manager", "Consulting", false, null],
  ["Solutions Consultant", "Customer Success", INCLUDE.solutionsEngineering, INCLUDE.solutionsEngineering ? "Solutions & Sales Engineering" : null],
  ["Solutions Consultant", "Sales", INCLUDE.solutionsEngineering, INCLUDE.solutionsEngineering ? "Solutions & Sales Engineering" : null],
  ["Revenue Operations Analyst", "Customer Success", true, "CS Operations"],
  ["Revenue Operations Analyst", "Finance", false, null],
]) {
  const v = classify({ title, department: dept });
  const label = `${title} in "${dept || "no department"}"`;
  if (shouldKeep) ok(`  keep: ${label} → ${family}`, v.keep && v.family === family, v.keep ? `got ${v.family}` : v.reason);
  else ok(`  drop: ${label}`, !v.keep, v.keep ? `wrongly kept as ${v.family}` : "");
}

/* ========================================================================== */
console.log("\n── segment: only when the posting says so ──");
eq("explicit in title", segment("Enterprise Customer Success Manager", ""), "Enterprise");
eq("mid-market in title", segment("CSM, Mid-Market", ""), "Mid-Market");
eq("explicit in body", segment("Customer Success Manager", "You will own a book of mid-market accounts."), "Mid-Market");
eq("silent posting → null", segment("Customer Success Manager", "A great role on a growing team."), null);
eq("no guessing from book size", segment("Customer Success Manager", "You will manage 180 accounts."), null);

console.log("── book of business: only when it's the role's number ──");
eq("book + ARR", parseBook("You will own a book of 38 accounts representing $4.1M ARR."), "38 accounts / $4.1M ARR");
eq("accounts only", parseBook("You will manage a portfolio of 150 customers."), "150 customers");
eq("quota", parseBook("You will carry a $600K expansion quota."), "$600K quota");
eq("renewal base", parseBook("You will own a $12M renewal base across roughly 90 contracts."), "90 contracts / $12M ARR");
eq("team size", parseBook("You will lead a team of 8 customer success managers."), "Team of 8");
eq("company ARR rejected", parseBook("We recently passed $50M ARR."), "");
eq("company customer count rejected", parseBook("We serve 10,000 customers worldwide."), "");
eq("trusted-by rejected", parseBook("Trusted by 500 companies across the globe."), "");
eq("silent posting", parseBook("A great role on a growing team."), "");

console.log("── stack: only tools the posting names ──");
eq("explicit tools", parseStack("Experience with Gainsight, Salesforce and SQL required", "Acme").sort(), ["Gainsight", "SQL", "Salesforce"]);
eq("silent posting → empty", parseStack("You will run QBRs and drive adoption.", "Acme"), []);
eq("ambiguous words ignored", parseStack("Put the customer front and center. We want linear progress.", "Acme"), []);
eq("ambiguous word with a cue is kept", parseStack("Experience with tools such as Front and Intercom.", "Acme").sort(), ["Front", "Intercom"]);
eq("company's own product skipped", parseStack("Gainsight seeks a CSM. Gainsight experience a plus.", "Gainsight"), []);

console.log("── variable comp ──");
eq("OTE range", parseVariable("$220,000 - $260,000 OTE"), "$220K–$260K OTE");
eq("bonus pct", parseVariable("plus a 15% annual bonus"), "+ 15% bonus");

console.log("── location: always produced ──");
eq("remote us", cleanLocation("Remote - United States", true), "Remote — US");
eq("city state", cleanLocation("Austin, Texas", false), "Austin, TX");
eq("strips hybrid label", cleanLocation("Hybrid - New York, NY", false), "New York, NY");
eq("bare city survives", cleanLocation("San Francisco", false), "San Francisco");
eq("empty + remote flag", cleanLocation("", true), "Remote — US");

/* ========================================================================== */
console.log("\n── apply links ──");
for (const [url, want] of [
  ["https://boards.greenhouse.io/acme/jobs/4567890", "posting"],
  ["https://job-boards.greenhouse.io/acme/jobs/123", "posting"],
  ["https://boards.greenhouse.io/acme", "list"],
  ["https://boards.greenhouse.io/acme/jobs", "list"],
  ["https://jobs.lever.co/acme/2f8c1b3e-9a4d-4c21-bb77-1a2b3c4d5e6f", "posting"],
  ["https://jobs.lever.co/acme/2f8c1b3e-9a4d-4c21-bb77-1a2b3c4d5e6f/apply", "posting"],
  ["https://jobs.lever.co/acme", "list"],
  ["https://jobs.ashbyhq.com/acme/8f3c1b3e-9a4d-4c21-bb77-1a2b3c4d5e6f", "posting"],
  ["https://jobs.ashbyhq.com/acme", "list"],
  ["https://apply.workable.com/acme/j/ABC123/", "posting"],
  ["https://apply.workable.com/acme", "list"],
  ["https://acme.com", "homepage"],
  ["https://acme.com/careers", "list"],
  ["https://acme.com/careers/senior-csm", "posting"],
  ["https://acme.com/careers?gh_jid=4567890", "posting"],
  ["careers.acme.com", "invalid"],
]) {
  eq(`  ${want.padEnd(8)} ${url.slice(0, 58)}`, applyLinkQuality(url), want);
}
eq("ATS domain is not a company homepage", homepageOf("https://boards.greenhouse.io/acme/jobs/5001"), null);
eq("employer-hosted posting yields a homepage", homepageOf("https://acme.com/careers/csm-123"), "https://acme.com");
eq("lever domain rejected too", homepageOf("https://jobs.lever.co/acme/uuid"), null);

/* ========================================================================== */
console.log("\n── description excerpts ──");
{
  const html = `
    <p>We're hiring a Customer Success Manager to own our mid-market book. You'll be the
       commercial owner for roughly forty accounts, from kickoff through renewal.</p>
    <p>This is a post-sale ownership role. You carry the number rather than supporting
       someone else who does, and you'll work directly with VP-level stakeholders.</p>
    <h3>What you'll do</h3>
    <ul>
      <li>Own a book of 40 mid-market accounts through renewal</li>
      <li>Run quarterly business reviews with executive stakeholders</li>
    </ul>
    <h3>What you'll bring</h3>
    <ul><li>4+ years in customer success at a B2B SaaS company</li></ul>
    <h3>Benefits</h3>
    <ul><li>Unlimited PTO and a great culture</li></ul>
    <p>We are an equal opportunity employer and consider all applicants without regard to race.</p>`;
  const d = extractDetail(html);
  ok("summary is substantial, not one line", d.summary.length > 200, `${d.summary.length} chars`);
  ok("summary keeps both lead paragraphs", d.summary.includes("post-sale ownership"), "second paragraph missing");
  ok("employer's own headings preserved", d.sections.map((s) => s.title).includes("What you'll do"), JSON.stringify(d.sections.map((s) => s.title)));
  ok("benefits section excluded", !d.sections.some((s) => /benefit/i.test(s.title)), "benefits leaked");
  ok("EEO boilerplate excluded", !JSON.stringify(d).includes("equal opportunity"), "EEO leaked");
}
{
  const d = extractDetail(`<p>Intro paragraph that is long enough to be treated as real lead prose for the summary of this role.</p><p><strong>Responsibilities</strong></p><ul><li>Own the renewal cycle end to end</li></ul>`);
  ok("bolded pseudo-headings detected", d.sections.some((s) => s.title === "Responsibilities"), JSON.stringify(d.sections.map((s) => s.title)));
}
{
  const d = extractDetail(`<ul><li>Own a book of accounts</li><li>Run business reviews</li></ul>`);
  eq("headless posting gets an honest label", d.sections[0].title, "From the job description");
}

/* ========================================================================== */
console.log("\n── full pipeline ──");

const GH_RAW = {
  externalId: "5001",
  title: "Senior Customer Success Manager",
  department: "Customer Success",
  locationRaw: "Remote - United States",
  remoteFlag: true,
  html: "&lt;p&gt;Own a book of 38 mid-market accounts representing $4.1M ARR, carrying them from kickoff through renewal. This is a commercial ownership role, not a support seat.&lt;/p&gt;&lt;h3&gt;What you&#39;ll do&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;Run the full post-sale lifecycle from kickoff to renewal&lt;/li&gt;&lt;li&gt;Carry a gross retention target of 94 percent&lt;/li&gt;&lt;/ul&gt;&lt;h3&gt;Qualifications&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;4+ years in customer success at a B2B SaaS company&lt;/li&gt;&lt;/ul&gt;&lt;p&gt;The base salary range for this role is $130,000 - $160,000 plus a 15% bonus. Experience with Gainsight and Salesforce preferred.&lt;/p&gt;",
  plain: "",
  postedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  applyUrl: "https://boards.greenhouse.io/acme/jobs/5001",
  postingUrl: "https://boards.greenhouse.io/acme/jobs/5001",
  pay: null,
};
const company = { ats: "greenhouse", token: "acme", name: "Acme Cloud", industry: "Developer tools", site: "https://acme.example" };
const { job, drop } = normalize(GH_RAW, company);

ok("rich posting kept", !!job, drop);
if (job) {
  eq("  salary", [job.min, job.max], [130000, 160000]);
  eq("  book", job.book, "38 accounts / $4.1M ARR");
  eq("  segment", job.segment, "Mid-Market");
  eq("  location", job.location, "Remote — US");
  eq("  stack", job.stack.sort(), ["Gainsight", "Salesforce"]);
  eq("  companySite from registry", job.companySite, "https://acme.example");
  ok("  applyUrl is a deep link", isDeepLink(job.applyUrl), job.applyUrl);
  ok("  summary is more than a line", job.summary.length > 100, `${job.summary.length} chars`);
  ok("  sections carried through", job.sections.length >= 2, `${job.sections.length} sections`);
  ok("  no does/wants buckets left", !("does" in job) && !("wants" in job), "old shape still present");
  ok("  entities decoded", !JSON.stringify(job).match(/&(lt|gt|#39);/), "entities leaked");
}

console.log("── a silent posting keeps its silence ──");
{
  const bare = {
    ...GH_RAW,
    html: "&lt;p&gt;We are looking for a Customer Success Manager to join our growing team and help our customers succeed with our platform every single day.&lt;/p&gt;&lt;p&gt;We serve 10,000 customers worldwide and recently passed $50M ARR. Competitive salary and benefits.&lt;/p&gt;",
    pay: null,
  };
  const r = normalize(bare, company);
  ok("kept on the board", !!r.job, r.drop);
  if (r.job) {
    eq("  salary null, not invented", [r.job.min, r.job.max], [null, null]);
    eq("  no variable comp without a base", r.job.variable, "");
    eq("  book empty (company figures rejected)", r.job.book, "");
    eq("  segment null", r.job.segment, null);
    eq("  stack empty", r.job.stack, []);
    eq("  location still present", r.job.location, "Remote — US");
    eq("  mode still present", r.job.mode, "Remote");
  }
}

console.log("── structured country and workplace ──");
{
  const de = normalize({ ...GH_RAW, locationRaw: "Stuttgart", country: "DE", remoteFlag: false }, company);
  ok("German role caught by country code alone", de.drop === "outside covered geography", de.drop || "kept");
  const gr = normalize({ ...GH_RAW, locationRaw: "Thessaloniki", country: "Greece", remoteFlag: false }, company);
  ok("Greek role caught by country name alone", gr.drop === "outside covered geography", gr.drop || "kept");
  ok("US country code kept", !!normalize({ ...GH_RAW, country: "US" }, company).job);
  ok("Canada kept", !!normalize({ ...GH_RAW, locationRaw: "Toronto, ON", country: "CA" }, company).job);
  const hyb = normalize({ ...GH_RAW, locationRaw: "Boston, MA", remoteFlag: true, workplace: "Hybrid" }, company);
  eq("explicit workplace beats a remote flag", hyb.job && hyb.job.mode, "Hybrid");
  ok("no 'days ago' stored (keeps nightly diffs small)", !("posted" in normalize(GH_RAW, company).job));
}

console.log("── bad apply links are dropped ──");
{
  const home = normalize({ ...GH_RAW, applyUrl: "https://acme.com", postingUrl: "https://acme.com" }, company);
  ok("homepage dropped", !home.job && home.drop === "apply link was a homepage", home.drop);
  const list = normalize({ ...GH_RAW, applyUrl: "https://boards.greenhouse.io/acme", postingUrl: "https://boards.greenhouse.io/acme" }, company);
  ok("jobs list dropped", !list.job && list.drop === "apply link was a jobs list, not this role", list.drop);
}

console.log("── strict mode still available ──");
{
  const bare = { ...GH_RAW, html: "&lt;p&gt;A CSM role at a growing company with a friendly team and good benefits for everyone.&lt;/p&gt;", pay: null };
  ok("--strict drops salary-less roles", !normalize(bare, company, { requireSalary: true }).job);
  ok("default keeps them", !!normalize(bare, company).job);
}

console.log("── freshness ──");
ok("120-day-old kept (ATS feeds only list open roles)", !!normalize({ ...GH_RAW, postedAt: new Date(Date.now() - 120 * 86400000).toISOString() }, company).job);
ok("200-day-old dropped", normalize({ ...GH_RAW, postedAt: new Date(Date.now() - 200 * 86400000).toISOString() }, company).drop === "older than max age");

console.log("── geography ──");
for (const [loc, shouldDrop] of [
  ["San Francisco", false], ["Austin", false], ["New York, NY", false],
  ["Remote - United States", false], ["Toronto, ON", false],
  ["London, UK", true], ["Bengaluru, India", true], ["Berlin", true],
  ["Remote - EMEA", true], ["Remote (US or UK)", false],
]) {
  const r = normalize({ ...GH_RAW, locationRaw: loc, remoteFlag: /remote/i.test(loc) }, company);
  ok(`  "${loc}"`, (r.drop === "outside covered geography") === shouldDrop, r.drop || "kept");
}

console.log("── dedupe: what IS a duplicate ──");
{
  const desc = "Own a book of forty mid-market accounts through renewal. Run quarterly business reviews with executive stakeholders. Build health scores that predict churn.";
  let n = 0;
  const J = (o) => ({ company: "Northloop", title: "Customer Success Manager", location: "Remote — US", mode: "Remote",
    applyUrl: `https://boards.greenhouse.io/n/jobs/${++n}`, postedAt: "2026-09-10", min: null, max: null,
    summary: desc, sections: [], source: "Greenhouse", ...o });

  let r = dedupe([J({ applyUrl: "https://boards.greenhouse.io/n/jobs/1" }), J({ applyUrl: "https://boards.greenhouse.io/n/jobs/1", company: "Northloop, Inc.", title: "CSM" })]);
  eq("same apply URL, differently spelled → 1", r.jobs.length, 1);

  r = dedupe([J({ postedAt: "2026-09-01" }), J({ postedAt: "2026-09-15", source: "Lever" })]);
  eq("same company + title + location → 1", r.jobs.length, 1);
  eq("  keeps the most recent date", r.jobs[0].postedAt, "2026-09-15");

  r = dedupe([
    J({ location: "New York, NY", mode: "Hybrid", title: "Customer Success Manager - New York", min: 140000, max: 160000 }),
    J({ location: "Remote — US", mode: "Remote", title: "Customer Success Manager (Remote)", min: 120000, max: 140000 }),
    J({ location: "Austin, TX", mode: "Onsite", title: "Customer Success Manager - Austin" }),
  ]);
  eq("one role in 3 cities → 1 listing", r.jobs.length, 1);
  eq("  title loses the city", r.jobs[0].title, "Customer Success Manager");
  eq("  keeps all 3 locations", r.jobs[0].locations.length, 3);
  eq("  each location keeps its own apply link", new Set(r.jobs[0].variants.map((v) => v.applyUrl)).size, 3);
  eq("  remote listed first", r.jobs[0].variants[0].mode, "Remote");
  eq("  pay spans only published ranges", [r.jobs[0].min, r.jobs[0].max], [120000, 160000]);
  eq("  flags that pay varies", r.jobs[0].payVaries, true);
  eq("  filterable by every mode", [...r.jobs[0].modes].sort(), ["Hybrid", "Onsite", "Remote"]);

  console.log("── dedupe: what is NOT a duplicate ──");
  eq("Senior CSM and CSM stay separate", dedupe([J({}), J({ title: "Senior Customer Success Manager" })]).jobs.length, 2);
  eq("same title, different job stays separate", dedupe([J({ location: "New York, NY" }),
    J({ location: "Austin, TX", summary: "Support a pooled book of SMB customers through lifecycle email, webinars and in-app campaigns. Volume role with digital programs." })]).jobs.length, 2);
  eq("same title at different companies stays separate", dedupe([J({}), J({ company: "Parcelay" })]).jobs.length, 2);
  eq("Enterprise and SMB variants stay separate", dedupe([
    J({ title: "Customer Success Manager - Enterprise", location: "New York, NY" }),
    J({ title: "Customer Success Manager - SMB", location: "New York, NY" })]).jobs.length, 2);
}

console.log("── dedupe: normalisers ──");
eq("remote suffix stripped", titleKey("Customer Success Manager - Remote (US)"), "customer success manager");
eq("segment kept", titleKey("Customer Success Manager - Enterprise"), "customer success manager enterprise");
eq("seniority kept", titleKey("Senior Customer Success Manager"), "senior customer success manager");
eq("Sr. expands", titleKey("Sr. CSM"), "senior customer success manager");
eq("legal suffix ignored", companyKey("Figma, Inc."), companyKey("figma"));
eq("Lever apply URL == posting URL", urlKey("https://jobs.lever.co/a/x-1/apply"), urlKey("https://jobs.lever.co/a/x-1/"));
eq("display title keeps segment", displayTitle("Customer Success Manager - Enterprise"), "Customer Success Manager - Enterprise");
eq("display title drops place", displayTitle("Senior CSM - Remote (US)"), "Senior CSM");

/* ========================================================================== */
console.log(`\n${"─".repeat(60)}`);
console.log(`${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFailures:"); failures.forEach((f) => console.log(`  ✗ ${f}`)); process.exit(1); }
console.log("All good.\n");
