import React, { useState, useMemo, useEffect, useRef } from "react";

/* ============================================================================
   RENEWAL — a job board for customer success people
   ----------------------------------------------------------------------------
   Listings load from /jobs.json, which ingest/build.js writes each night.
   If that file is missing (local preview, first deploy) the board falls back
   to a small sample set and says so, rather than showing an empty page.
   ========================================================================== */

const BRAND = {
  name: "renewal",
  line: "Customer success jobs, nothing invented.",
  contactEmail: "zachtjsmith@gmail.com",
  GumRoadShop: "https://zachsmith43.gumroad.com/",
};

const JOBS_URL = "/jobs.json";
const CONTENT_URL = "/content.json";

/* Where submitted listings go. Leave empty and the form falls back to opening
   a pre-filled email, so it works on day one with no backend. To collect them
   properly, paste a Formspree / Basin / Netlify Forms endpoint here — the
   payload is plain JSON and needs no other changes. */
const LISTING_ENDPOINT = "";

const C = {
  paper: "#EDF1EF", surface: "#FFFFFF", ink: "#0E1A15", body: "#38453F",
  muted: "#6B7A73", rule: "#D5DEDA", ruleSoft: "#E7ECEA",
  signal: "#0B6E4F", signalSoft: "#E2EFE9", flag: "#8A6104", flagSoft: "#FAF0D9",
};
const FONT = "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const FAMILIES = ["All roles", "Customer Success", "Account Management", "Onboarding", "Renewals", "CS Operations", "Leadership"];

/* Shown only when /jobs.json can't be loaded. Real data replaces this.
   Deliberately mixed: some postings publish a salary, a book size, a segment
   and a stack; others publish none of it. The board shows exactly what each
   one said and nothing more. */
const SAMPLE_JOBS = [
  {
    id: "s1", title: "Senior Customer Success Manager", company: "Northloop", industry: "Developer tools",
    family: "Customer Success", segment: "Mid-Market", location: "Remote — US", mode: "Remote",
    min: 130000, max: 160000, variable: "+ 15% bonus", book: "38 accounts / $4.1M ARR",
    stack: ["Gainsight", "Salesforce", "SQL"], posted: 1, source: "Greenhouse", featured: true,
    applyUrl: "https://boards.greenhouse.io/northloop/jobs/5001", companySite: "https://northloop.example",
    summary: "Own a book of 38 mid-market accounts representing $4.1M ARR, carrying them from kickoff through renewal. This is a commercial ownership role rather than a support seat: you hold the retention number yourself and you are the person the customer escalates to.\n\nThe team is six CSMs covering mid-market, reporting into a VP who came up through the function. Expect direct access to Product and a short path from customer feedback to roadmap.",
    sections: [
      { title: "What you'll do", paras: [], bullets: ["Run the full post-sale lifecycle for a book of 38 accounts", "Carry a gross retention target of 94% and a $600K expansion goal", "Build and defend health scores in Gainsight, escalating risk early", "Run quarterly business reviews with VP Engineering and above"] },
      { title: "What you'll bring", paras: [], bullets: ["4+ years in customer success at a B2B SaaS company", "You have personally owned a renewal number, not supported one", "Comfortable reading an API doc and holding a technical conversation"] },
    ],
  },
  {
    id: "s2", title: "Enterprise Account Manager", company: "Parcelay", industry: "Logistics software",
    family: "Account Management", segment: "Enterprise", location: "Chicago, IL", mode: "Hybrid",
    min: 110000, max: 130000, variable: "$220K–$260K OTE", book: "12 accounts / $9.8M ARR",
    stack: ["Salesforce", "Clari"], posted: 2, source: "Lever", featured: false,
    applyUrl: "https://jobs.lever.co/parcelay/lv-1/apply", companySite: "https://parcelay.example",
    summary: "Twelve enterprise logistics accounts worth $9.8M ARR, three of them in the Fortune 500. Heavy expansion motion with a renewal floor underneath it, and a solutions engineer attached to the pod.\n\nThis is a hybrid role. Three days a week in the Chicago office is a firm requirement, not a preference.",
    sections: [
      { title: "Responsibilities", paras: [], bullets: ["Own commercial relationships for 12 enterprise logistics accounts", "Drive multi-year renewals and land-and-expand into new business units", "Partner with Solutions Engineering on technical expansion cases"] },
      { title: "Requirements", paras: [], bullets: ["5+ years enterprise AM or CSM with a quota attached", "Closed six-figure expansion deals inside existing accounts"] },
    ],
  },
  {
    id: "s3", title: "Customer Success Manager, SMB", company: "Northloop", industry: "Developer tools",
    family: "Customer Success", segment: null, location: "Remote — US", mode: "Remote",
    min: null, max: null, variable: "", book: "", stack: [],
    posted: 3, source: "Greenhouse", featured: false,
    applyUrl: "https://boards.greenhouse.io/northloop/jobs/5004", companySite: "https://northloop.example",
    summary: "Northloop is growing its SMB customer success team and is looking for someone who enjoys working at volume. You will support a pooled book of accounts through onboarding, adoption and renewal, working alongside two other CSMs on the segment.\n\nMost of your week is spent in one-to-many programs rather than scheduled calls: lifecycle email, office hours, webinars and in-app campaigns. When an account shows expansion signal you hand it to the sales team with context.\n\nThis is a good first customer success role, or a good fit if you have done enterprise work and want volume without the account politics.",
    sections: [],
  },
  {
    id: "s4", title: "Customer Success Operations Manager", company: "Havenpoint", industry: "Insurtech",
    family: "CS Operations", segment: null, location: "San Francisco, CA", mode: "Onsite",
    min: 115000, max: 140000, variable: "+ equity", book: "", stack: ["Gainsight", "SQL", "dbt"],
    posted: 5, source: "Ashby", featured: false,
    applyUrl: "https://jobs.ashbyhq.com/havenpoint/ash-1", companySite: "https://havenpoint.example",
    summary: "The systems role behind a 24-person customer success organisation. If you would rather build the machine than work the accounts, this is the seat: you own the tooling, the reporting layer and the segmentation model that decides who covers what.\n\nYou will report to the VP of Customer Success and work closely with RevOps and the data team.",
    sections: [
      { title: "What you'll do", paras: [], bullets: ["Administer Gainsight end to end: rules engine, playbooks, scorecards", "Build the retention reporting layer the exec team actually trusts", "Own capacity planning and book-of-business segmentation each half"] },
      { title: "What you'll bring", paras: [], bullets: ["3+ years in CS Ops, RevOps or Sales Ops", "You write your own SQL rather than waiting on the data team"] },
    ],
  },
  {
    id: "s5", title: "Renewals Manager", company: "Ferrous", industry: "Fintech infrastructure",
    family: "Renewals", segment: "Mid-Market", location: "Remote — US", mode: "Remote",
    min: 95000, max: 115000, variable: "$150K–$180K OTE", book: "90 contracts / $12M ARR",
    stack: [], posted: 7, source: "Ashby", featured: false,
    applyUrl: "https://jobs.ashbyhq.com/ferrous/ash-2", companySite: "https://ferrous.example",
    summary: "A dedicated renewals desk sitting between customer success and finance. Contract-heavy, negotiation-heavy, and no relationship management — the CSMs own the relationship and hand you the commercial conversation four months out.\n\nYou will forecast weekly against a 95% accuracy bar and work directly with procurement teams on paper exceptions.",
    sections: [
      { title: "What you'll do", paras: [], bullets: ["Own a $12M renewal base across roughly 90 mid-market contracts", "Negotiate uplifts, multi-year terms and paper exceptions with procurement"] },
      { title: "What you'll bring", paras: [], bullets: ["3+ years in renewals, sales or commercial customer success"] },
    ],
  },
  {
    id: "s6", title: "Director of Customer Success", company: "Tidemark Labs", industry: "Security",
    family: "Leadership", segment: "Enterprise", location: "Austin, TX", mode: "Hybrid",
    min: 185000, max: 215000, variable: "+ equity", book: "Team of 11",
    stack: ["Gainsight", "Salesforce"], posted: 4, source: "Greenhouse", featured: false,
    applyUrl: "https://boards.greenhouse.io/tidemark/jobs/9001", companySite: "https://tidemark.example",
    summary: "Series C security company with eleven CSMs across two segments, reporting to the CRO. You own net revenue retention as a board-reported number, currently sitting at 108%.\n\nThe org was built fast and shows it. Your first two quarters are about segmentation, coverage and getting the churn-reason taxonomy to a place where Product will act on it.",
    sections: [
      { title: "What you'll do", paras: [], bullets: ["Lead an 11-person CS org split across enterprise and mid-market", "Own NRR as a board-reported number", "Partner with Product on the churn-reason taxonomy"] },
      { title: "What you'll bring", paras: [], bullets: ["5+ years leading CS teams, including managing managers", "Security, infrastructure or another technical B2B category"] },
    ],
  },
];

const ISSUES = [
  { n: 14, date: "Sep 11, 2026", title: "The book size question nobody answers honestly", teaser: "What 40 accounts actually means at three different company sizes, and the number to push back on in an interview." },
  { n: 13, date: "Sep 4, 2026", title: "Nine companies quietly rebuilt their CS org this month", teaser: "Who split CS from renewals, who folded AM back in, and what that means for where the open seats are." },
  { n: 12, date: "Aug 28, 2026", title: "Your health score is a vanity metric", teaser: "How to tell in one interview question whether a company's health model predicts churn or just describes it." },
  { n: 11, date: "Aug 21, 2026", title: "What to say when they ask about your GRR", teaser: "A framing that works even when your last number was bad, and why the bad number is not the disqualifier you think." },
];

/* --- shop ----------------------------------------------------------------
   Checkout runs through Gumroad. Set SHOP.vendor once and every button
   follows. If you move to Etsy or Stripe, change the buildUrl function and
   nothing else in the file needs touching.                               */
const SHOP = {
  vendor: "zachsmith43",                       // <- your Gumroad username
  buildUrl: (slug) => `https://${SHOP.vendor}.gumroad.com/l/${slug}?wanted=true`,
  freeLeadMagnet: "free-cs-prompts",
};

const BUNDLE = {
  slug: "complete-cs-toolkit",
  name: "The Complete CS Toolkit",
  price: 69,
  compareAt: "$120+ separately",
  save: "Save 40%",
  cover: "/images/covers/bundle.jpg",
  summary: "All six customer success products, twelve editable files, and a Start Here guide that shows you where to begin — whether you're stopping churn, fixing onboarding, or starting a new role.",
  contains: [
    "Customer Health Scorecard (Excel)",
    "QBR Decks in four design styles (PowerPoint)",
    "Customer Onboarding Playbook (Word)",
    "22 Renewal & Escalation Email Scripts (Word)",
    "Customer Success Plan + Tracker (Word + Excel)",
    "CSM 30-60-90 Plan Kit (Word + PowerPoint)",
  ],
  why: "One sample account runs through every file, so they work as a system instead of sitting in a folder.",
};

const PRODUCTS = [
  {
    slug: "health-scorecard",
    name: "Customer Health Scorecard",
    price: 24,
    format: "Excel",
    stage: "Track",
    cover: "/images/covers/health-scorecard.jpg",
    tagline: "Flags at-risk ARR before the renewal call.",
    summary: "Rate each account 1–5 across six factors and the weighted health score, RAG tier and exposed revenue calculate themselves. The written rubric is the part that matters — it defines what a 2 looks like versus a 4, so two CSMs scoring the same account land in the same place.",
    includes: [
      "Weighted 6-factor model with a written 1–5 rubric",
      "Auto RAG tiers and at-risk ARR calculation",
      "Portfolio dashboard tab for leadership",
      "12 realistic sample accounts included",
    ],
    stats: ["4 tabs", "6 weighted factors", "12 sample accounts", "0 formulas to write"],
  },
  {
    slug: "qbr-decks",
    name: "QBR Deck Template ×4",
    price: 24,
    format: "PowerPoint",
    stage: "Review",
    cover: "/images/covers/qbr-decks.jpg",
    tagline: "Talks outcomes, not login counts.",
    summary: "Four complete design styles — corporate, warm editorial, minimal, and a dark dashboard edition. Every slide is built around outcomes, adoption trends and an earned recommendation: the structure that gets a sponsor to say this is obviously worth it.",
    includes: [
      "Four design styles, up to 12 slides each",
      "Charts, KPI tiles and roadmap visuals built in",
      "Speaker notes on every slide",
      "Bracketed placeholders — just fill in",
    ],
    stats: ["4 design styles", "38 slides total"],
  },
  {
    slug: "onboarding-playbook",
    name: "Customer Onboarding Playbook",
    price: 24,
    format: "Word",
    stage: "Onboard",
    cover: "/images/covers/onboarding-playbook.jpg",
    tagline: "Nothing advances until the customer is actually ready.",
    summary: "Six phases, each gated by real exit criteria. Fixes the onboarding that goes differently depending on who runs it — which is what protects time-to-value and, eventually, the renewal.",
    includes: [
      "Handoff → Kickoff → Configure → Enable → Go-live → Adopt",
      "RACI matrix and success metrics with baselines",
      "Risk signals and escalation guidance",
      "14 starter email templates and a master checklist",
    ],
    stats: ["17 pages", "6 phases", "14 email templates", "1 master checklist"],
  },
  {
    slug: "email-scripts",
    name: "22 Renewal & Escalation Scripts",
    price: 24,
    format: "Word",
    stage: "Renew",
    cover: "/images/covers/email-scripts.jpg",
    tagline: "For the blank reply box on a hard email.",
    summary: "Every script says when to use it, gives you a subject line written to get opened, and adds the judgment call that makes it land. Written to sound human rather than automated.",
    includes: [
      "Renewals (7) and pricing & negotiation (3)",
      "At-risk & escalation (6)",
      "Expansion (3), advocacy & win-back (3)",
      "A pro tip on every single script",
    ],
    stats: ["22 scripts", "5 categories", "15 pages", "1 pro tip each"],
  },
  {
    slug: "success-plan",
    name: "Success Plan + Tracker",
    price: 24,
    format: "Word + Excel",
    stage: "Plan",
    cover: "/images/covers/success-plan.jpg",
    tagline: "The mutual plan your customer will actually co-sign.",
    summary: "Replaces they seem happy with an agreement. Objectives, metrics with baselines and targets, owners on both sides, and a tracker that keeps score between reviews so the renewal isn't a surprise.",
    includes: [
      "Nine guided sections plus a one-page exec summary",
      "A fully worked example, not empty fields",
      "Mutual action plan with sign-off",
      "Tracker auto-calculates % to target and status",
    ],
    stats: ["9 plan sections", "2 files", "1 worked example", "0 formulas to write"],
  },
  {
    slug: "csm-30-60-90-kit",
    name: "CSM 30-60-90 Plan Kit",
    price: 24,
    format: "Word + PowerPoint",
    stage: "Career",
    cover: "/images/covers/csm-30-60-90-kit.jpg",
    tagline: "Win the interview, then own your first quarter.",
    summary: "Built on one rule: hiring panels hire deliverables. Every goal names a thing, a number and a date — and the kit tells you what panels are actually scoring while you present.",
    includes: [
      "Editable plan and nine-slide interview deck",
      "Speaker notes and a fully worked example",
      "Three questions to ask your panel",
      "Five mistakes that quietly kill candidacies",
    ],
    stats: ["8 page plan", "9 deck slides", "3 questions to ask", "1 worked example"],
    forJobSeekers: true,
  },
  {
    slug: "ai-prompt-library",
    name: "The AI Prompt Library for CS",
    price: 39,
    format: "Word + plain text",
    stage: "AI layer",
    cover: "/images/covers/ai-prompt-library.jpg",
    tagline: "Turns messy notes into finished CS work.",
    summary: "45 prompts organised by the job you're doing, not by feature. Works with ChatGPT, Claude, Gemini or Copilot. Paste messy call notes, get a filled success plan. Paste usage data, get scorecard ratings with the evidence shown.",
    includes: [
      "Onboarding, health & risk, success planning",
      "QBRs, renewals & expansion, weekly rhythm",
      "24 prompts wired to the toolkit, 21 standalone",
      "Account context block and a 7-step running guide",
    ],
    stats: ["45 prompts", "6 workflows", "24 wired to the toolkit", "21 standalone"],
  },
];

const RESOURCE_GROUPS = [
  { goal: "Get interviews", items: [
    { kind: "Video", len: "12 min", title: "Rewriting a CSM resume around retention numbers", desc: "Line-by-line edit of a real resume that was getting no callbacks." },
    { kind: "Guide", len: "8 min read", title: "The 14 CS interview questions that actually get asked", desc: "With the follow-up each one is fishing for." },
    { kind: "Template", len: "Free", title: "Outreach note to a CS hiring manager", desc: "Short, specific, no flattery. Two versions: cold and referred." } ] },
  { goal: "Survive the first 90 days", items: [
    { kind: "Video", len: "18 min", title: "Your first book handoff, without losing an account", desc: "What to ask the departing CSM before their laptop gets wiped." },
    { kind: "Guide", len: "10 min read", title: "Reading a book of business you did not build", desc: "Which accounts to call in week one, and which to leave alone." } ] },
  { goal: "Do the job better", items: [
    { kind: "Video", len: "22 min", title: "Running a QBR an executive will not reschedule", desc: "Structure, timing, and the slide to cut." },
    { kind: "Guide", len: "14 min read", title: "Building a health score that predicts churn", desc: "Why usage-only models fail and what to weight instead." },
    { kind: "Video", len: "9 min", title: "The renewal conversation, four months early", desc: "Where the uplift gets won or lost." } ] },
  { goal: "Handle a layoff", items: [
    { kind: "Guide", len: "6 min read", title: "The first 72 hours after a CS layoff", desc: "Severance, references, and what to take with you before access is cut." },
    { kind: "Guide", len: "9 min read", title: "Explaining a layoff in an interview", desc: "Three framings, and the one that stops the follow-up question." } ] },
];

const AD_SLOTS = [
  { id: "rail-a", label: "Board rail, upper", size: "300 × 250", price: "$299 / month", sold: false },
  { id: "rail-b", label: "Board rail, lower", size: "300 × 250", price: "$199 / month", sold: false },
];

const AD_PACKAGES = [
  { name: "Featured listing", price: "$99", unit: "per job, 30 days", what: "Your role sits at the top of the board with an amber edge and a pinned position, above the daily feed.", stats: ["Top of board for 30 days", "Included in the next newsletter", "Amber featured treatment"] },
  { name: "Newsletter sponsor", price: "$199", unit: "per issue", what: "A single sponsor slot near the top of the weekly issue. Plain text, written in the newsletter's voice, no banner.", stats: ["One sponsor per issue", "Above the job roundup", "Copy written with you"] },
  { name: "Board rail", price: "$299", unit: "per month", what: "A 300 × 250 unit in the right rail of the job board, visible on every filtered view.", stats: ["Runs on all board views", "Two slots total, ever", "Monthly reporting"] },
  { name: "Resource sponsor", price: "$499", unit: "per quarter", what: "Your brand on a resource section, plus one co-produced guide or video that lives on the site permanently.", stats: ["Section-level placement", "One co-produced piece", "Evergreen, does not expire"] },
];

/* --- helpers ------------------------------------------------------------- */
const money = (n) => "$" + Math.round(n / 1000) + "k";
const ago = (d) => (d === 0 ? "today" : d === 1 ? "yesterday" : d + " days ago");
const markColors = ["#0B6E4F", "#1F4E6B", "#6B3F5E", "#5A4A21", "#2F4858", "#6B3A2E"];
const markFor = (name) => markColors[String(name).length % markColors.length];
const hasBook = (b) => b && b !== "Not listed" && b !== "—";
/* lowercase, strip punctuation, collapse whitespace — used by search on both
   the query and the job text so the two always match the same way */
/* Paste any YouTube or Loom link and the site works out the thumbnail. */
const videoThumb = (url) => {
  if (!url) return null;
  const yt = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
  return null;
};
const fmtDate = (d) => {
  const t = new Date(d);
  return isFinite(t) ? t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : String(d || "");
};
const normalizeText = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* --- shared pieces ------------------------------------------------------- */
function Chip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? C.ink : C.surface, color: active ? "#fff" : C.body,
      border: "1px solid " + (active ? C.ink : C.rule), borderRadius: 999,
      padding: "6px 13px", fontSize: 13, fontWeight: 500, fontFamily: FONT,
      cursor: "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function Tag({ children, tone }) {
  const map = {
    signal: { bg: C.signalSoft, fg: C.signal, bd: "#CBE2D8" },
    flag: { bg: C.flagSoft, fg: C.flag, bd: "#EADFBC" },
    plain: { bg: "#F2F5F4", fg: C.muted, bd: C.ruleSoft },
  };
  const t = map[tone] || map.plain;
  return <span style={{ background: t.bg, color: t.fg, border: "1px solid " + t.bd, borderRadius: 4, padding: "3px 7px", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", display: "inline-block" }}>{children}</span>;
}

function Mark({ name, size = 40 }) {
  return <div style={{ width: size, height: size, flex: "0 0 auto", background: markFor(name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.42, borderRadius: 3, letterSpacing: "-0.02em" }}>{String(name).slice(0, 2).toUpperCase()}</div>;
}

function Button({ children, href, onClick, kind = "primary", wide }) {
  const s0 = { primary: { bg: C.signal, fg: "#fff", bd: C.signal }, dark: { bg: C.ink, fg: "#fff", bd: C.ink }, ghost: { bg: "transparent", fg: C.ink, bd: C.rule } }[kind];
  const s = { background: s0.bg, color: s0.fg, border: "1px solid " + s0.bd, borderRadius: 5, padding: "10px 18px", fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: "pointer", textDecoration: "none", display: wide ? "block" : "inline-block", textAlign: "center", width: wide ? "100%" : "auto" };
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={s}>{children}</a>;
  return <button onClick={onClick} style={s}>{children}</button>;
}

function PageHead({ title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.035em", color: C.ink, margin: 0, lineHeight: 1.08 }}>{title}</h1>
      {sub && <p style={{ margin: "10px 0 0", fontSize: 16, color: C.body, maxWidth: "62ch", lineHeight: 1.55 }}>{sub}</p>}
    </div>
  );
}

/* --- header -------------------------------------------------------------- */
function Header({ tab, setTab }) {
  const [open, setOpen] = useState(false);
  const tabs = [["jobs", "Jobs"], ["newsletter", "Newsletter"], ["templates", "Templates"], ["resources", "Free resources"], ["advertise", "Advertise"]];
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 40, background: C.paper, borderBottom: "1px solid " + C.rule }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, height: 62 }}>
          <button onClick={() => { setTab("jobs"); setOpen(false); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: FONT }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.045em", color: C.ink }}>{BRAND.name}</span>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: C.signal, marginTop: 6 }} />
          </button>
          <nav className="hidden md:flex" style={{ gap: 22, alignItems: "center", flex: 1 }}>
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{ background: "none", border: "none", padding: "4px 0", cursor: "pointer", fontFamily: FONT, fontSize: 14.5, fontWeight: tab === k ? 600 : 450, color: tab === k ? C.ink : C.muted, borderBottom: "2px solid " + (tab === k ? C.signal : "transparent") }}>{label}</button>
            ))}
          </nav>
          <div className="hidden md:flex" style={{ gap: 10, marginLeft: "auto" }}>
            <Button kind="ghost" onClick={() => setTab("advertise")}>Post a job</Button>
          </div>
          <button className="md:hidden" onClick={() => setOpen(!open)} style={{ marginLeft: "auto", background: "none", border: "1px solid " + C.rule, borderRadius: 5, padding: "7px 11px", fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.ink, cursor: "pointer" }}>{open ? "Close" : "Menu"}</button>
        </div>
        {open && (
          <div className="md:hidden" style={{ paddingBottom: 14, display: "grid", gap: 2 }}>
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => { setTab(k); setOpen(false); }} style={{ textAlign: "left", background: tab === k ? C.surface : "transparent", border: "none", borderRadius: 5, padding: "11px 12px", fontFamily: FONT, fontSize: 15, fontWeight: tab === k ? 600 : 450, color: tab === k ? C.ink : C.body, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

/* --- job row ------------------------------------------------------------- */
/* Every field below is conditional. A posting that didn't state a salary,
   a book size, a segment or a stack simply doesn't show those rows — the
   board never fills a gap with a guess. */
function JobRow({ job, open, toggle }) {
  const isNew = job.posted <= 2;
  const edge = job.featured ? C.flag : isNew ? C.signal : "transparent";
  const hasPay = job.min != null && job.max != null;
  const hasSections = job.sections && job.sections.length > 0;

  return (
    <article style={{ background: C.surface, borderBottom: "1px solid " + C.ruleSoft, borderLeft: "3px solid " + edge }}>
      <button onClick={toggle} aria-expanded={open} style={{ width: "100%", background: "none", border: "none", textAlign: "left", padding: "18px 20px", cursor: "pointer", fontFamily: FONT, display: "block" }}>
        <div style={{ display: "flex", gap: 15, alignItems: "flex-start" }}>
          <Mark name={job.company} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: C.ink, letterSpacing: "-0.015em" }}>{job.title}</h3>
              {job.featured && <Tag tone="flag">Featured</Tag>}
              {isNew && !job.featured && <Tag tone="signal">New</Tag>}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 14.5, color: C.body }}>
              {job.company}{job.industry ? <span style={{ color: C.muted }}> — {job.industry}</span> : null}
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {/* location and mode are always shown */}
              <Tag>{job.location}</Tag>
              <Tag>{job.mode}</Tag>
              {/* these three only when the posting stated them */}
              {job.segment && <Tag>{job.segment}</Tag>}
              {job.book && <Tag>Book: {job.book}</Tag>}
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "0 0 auto", paddingLeft: 8 }}>
            {hasPay ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {job.min === job.max ? money(job.min) : `${money(job.min)}–${money(job.max)}`}
                </div>
                {job.variable ? <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3, whiteSpace: "nowrap" }}>{job.variable}</div> : null}
              </>
            ) : (
              <div style={{ fontSize: 13.5, color: C.muted, whiteSpace: "nowrap", paddingTop: 3 }}>See job listing</div>
            )}
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10, whiteSpace: "nowrap" }}>{ago(job.posted)}</div>
          </div>
        </div>
      </button>

      {open && (
        <div style={{ padding: "4px 20px 24px 75px", borderTop: "1px dashed " + C.ruleSoft, marginTop: -1 }}>
          {/* the employer's own words, at readable length */}
          {job.summary && job.summary.split("\n\n").map((para, i) => (
            <p key={i} style={{ fontSize: 15.5, color: C.body, lineHeight: 1.65, maxWidth: "72ch", margin: i === 0 ? "18px 0 0" : "12px 0 0" }}>{para}</p>
          ))}

          {/* the employer's own headings, not a template we imposed */}
          {hasSections && (
            <div style={{ marginTop: 24, display: "grid", gap: 22 }}>
              {job.sections.map((sec, i) => (
                <section key={i}>
                  <h4 style={{ fontSize: 13.5, fontWeight: 650, color: C.ink, margin: "0 0 9px", letterSpacing: "-0.005em" }}>{sec.title}</h4>
                  {sec.paras && sec.paras.map((para, k) => (
                    <p key={k} style={{ fontSize: 14.5, color: C.body, lineHeight: 1.6, margin: "0 0 8px", maxWidth: "72ch" }}>{para}</p>
                  ))}
                  {sec.bullets && sec.bullets.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 17, color: C.body, fontSize: 14.5, lineHeight: 1.65 }}>
                      {sec.bullets.map((b, k) => <li key={k} style={{ marginBottom: 5 }}>{b}</li>)}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}

          {/* only when the posting actually named tools */}
          {job.stack && job.stack.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <h4 style={{ fontSize: 13.5, fontWeight: 650, color: C.ink, margin: "0 0 9px" }}>Tools named in the posting</h4>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{job.stack.map((t) => <Tag key={t}>{t}</Tag>)}</div>
            </div>
          )}

          <div style={{ marginTop: 26, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button href={job.applyUrl}>Apply for this role</Button>
            {job.companySite && <Button href={job.companySite} kind="ghost">Company site</Button>}
          </div>
          <p style={{ fontSize: 13, color: C.muted, margin: "12px 0 0", lineHeight: 1.5 }}>
            Apply goes straight to this posting on {job.source}. {!hasPay && "This employer didn't publish a range — it'll be on their listing or worth asking early."}
          </p>
        </div>
      )}
    </article>
  );
}

/* --- rail ---------------------------------------------------------------- */
function AdUnit({ slot, setTab }) {
  return (
    <div style={{ background: C.flagSoft, border: "1px dashed #DCC98E", borderRadius: 6, padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 12.5, color: C.flag, fontWeight: 600 }}>Available ad space</div>
      <div style={{ fontSize: 15, color: C.ink, fontWeight: 600, margin: "8px 0 4px" }}>{slot.size} — {slot.price}</div>
      <p style={{ fontSize: 13.5, color: C.body, lineHeight: 1.5, margin: "0 0 14px" }}>Reaches customer success people actively changing jobs.</p>
      <Button kind="dark" onClick={() => setTab("advertise")} wide>See the rate card</Button>
    </div>
  );
}

function RailNewsletter({ onSub, subbed }) {
  const [email, setEmail] = useState("");
  return (
    <div style={{ background: C.surface, border: "1px solid " + C.rule, borderRadius: 6, padding: 20 }}>
      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>The Friday roundup</h4>
      <p style={{ fontSize: 13.5, color: C.body, lineHeight: 1.55, margin: "8px 0 14px" }}>New CS roles, org changes worth knowing about, and one thing to steal for your own book. Weekly.</p>
      {subbed ? (
        <p style={{ fontSize: 13.5, color: C.signal, fontWeight: 600, margin: 0 }}>You're on the list. First issue lands Friday.</p>
      ) : (
        <>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" style={{ width: "100%", padding: "10px 12px", border: "1px solid " + C.rule, borderRadius: 5, fontSize: 14, fontFamily: FONT, marginBottom: 9, boxSizing: "border-box", color: C.ink }} />
          <Button kind="dark" onClick={() => email.includes("@") && onSub()} wide>Subscribe</Button>
        </>
      )}
    </div>
  );
}

/* --- pagination ---------------------------------------------------------- */
const PAGE_SIZE = 10;

function Pager({ page, pageCount, setPage, total }) {
  if (pageCount <= 1) return null;

  // Window the numbers so 40 pages doesn't produce 40 links.
  const nums = [];
  const push = (n) => { if (n >= 1 && n <= pageCount && !nums.includes(n)) nums.push(n); };
  push(1); push(2);
  for (let n = page - 1; n <= page + 1; n++) push(n);
  push(pageCount - 1); push(pageCount);
  nums.sort((a, b) => a - b);

  const numStyle = (active) => ({
    background: "none", border: "none", padding: "2px 5px", cursor: "pointer",
    fontFamily: FONT, fontSize: 13, fontVariantNumeric: "tabular-nums",
    color: active ? C.ink : C.muted, fontWeight: active ? 700 : 500,
    textDecoration: active ? "underline" : "none", textUnderlineOffset: 3,
  });

  return (
    <div style={{ padding: "22px 20px 24px", background: C.surface, textAlign: "center" }}>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        {page > 1 && <Button kind="ghost" onClick={() => setPage(page - 1)}>Previous page</Button>}
        {page < pageCount && <Button onClick={() => setPage(page + 1)}>Next page</Button>}
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
        <div>Page {page} of {pageCount} — {total} {total === 1 ? "role" : "roles"} in total</div>
        <div style={{ marginTop: 3 }}>
          {nums.map((n, i) => (
            <span key={n}>
              {i > 0 && nums[i - 1] !== n - 1 && <span style={{ color: C.rule, padding: "0 2px" }}>…</span>}
              <button onClick={() => setPage(n)} style={numStyle(n === page)} aria-current={n === page ? "page" : undefined}>{n}</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --- jobs page ----------------------------------------------------------- */
function JobsPage({ setTab, onSub, subbed, feed }) {
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("All roles");
  const [mode, setMode] = useState("Any");
  const [segment, setSegment] = useState("Any");
  const [minPay, setMinPay] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const listTop = useRef(null);

  const jobs = feed.jobs;

  /* Build a searchable blob once per job, not once per keystroke. Punctuation
     is flattened so "mid market" finds "Mid-Market" and "csm" finds "CSM -". */
  const indexed = useMemo(
    () => jobs.map((j) => ({
      job: j,
      hay: normalizeText([
        j.title, j.company, j.industry, j.location, j.mode, j.family,
        j.segment || "", j.book || "", (j.stack || []).join(" "),
        j.summary || "",
        (j.sections || []).map((sec) => `${sec.title} ${(sec.bullets || []).join(" ")} ${(sec.paras || []).join(" ")}`).join(" "),
      ].join(" ")),
    })),
    [jobs]
  );

  const filtered = useMemo(() => {
    // Every word must appear somewhere. "remote renewals" = remote AND renewals.
    const terms = normalizeText(q).split(" ").filter(Boolean);

    const list = indexed
      .filter(({ job: j, hay }) => {
        if (family !== "All roles" && j.family !== family) return false;
        if (mode !== "Any" && j.mode !== mode) return false;
        if (segment !== "Any" && j.segment !== segment) return false;
        // A pay floor excludes roles with no published range — you asked to
        // filter on a number they didn't give.
        if (minPay > 0 && (j.max == null || j.max < minPay)) return false;
        return terms.every((t) => hay.includes(t));
      })
      .map((x) => x.job);

    list.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (sort === "pay") {
        // Roles with no published salary sort last rather than as zero.
        if ((a.max == null) !== (b.max == null)) return a.max == null ? 1 : -1;
        if (a.max == null) return a.posted - b.posted;
        return b.max - a.max;
      }
      return a.posted - b.posted;
    });
    return list;
  }, [indexed, q, family, mode, segment, minPay, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Changing a filter should land you on page 1, not page 7 of a shorter list.
  useEffect(() => { setPage(1); setOpenId(null); }, [q, family, mode, segment, minPay, sort]);

  const goToPage = (n) => {
    setPage(n);
    setOpenId(null);
    if (listTop.current) {
      listTop.current.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }
  };

  const reset = () => { setQ(""); setFamily("All roles"); setMode("Any"); setSegment("Any"); setMinPay(0); };
  const selectStyle = { padding: "9px 11px", border: "1px solid " + C.rule, borderRadius: 5, fontSize: 13.5, fontFamily: FONT, background: C.surface, color: C.ink, cursor: "pointer" };

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", color: C.ink, margin: 0, lineHeight: 1.1, maxWidth: "20ch" }}>{BRAND.line}</h1>
        <p style={{ margin: "10px 0 0", fontSize: 15.5, color: C.body, maxWidth: "60ch", lineHeight: 1.55 }}>
          {feed.loading ? "Loading the board…" : `${jobs.length} open roles across customer success, account management, onboarding, renewals and CS ops.`}{" "}
          {!feed.loading && "Salary, book size and tooling are shown only where the employer published them — nothing on this board is estimated."}
        </p>
        {feed.sample && !feed.loading && (
          <p style={{ margin: "10px 0 0", fontSize: 13.5, color: C.flag, background: C.flagSoft, border: "1px solid #EADFBC", borderRadius: 5, padding: "9px 12px", display: "inline-block" }}>
            Showing sample listings — run <code>npm run ingest</code> to generate jobs.json with live roles.
          </p>
        )}
      </div>

      <div style={{ background: C.surface, border: "1px solid " + C.rule, borderRadius: 6, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, company, or tool" style={{ flex: "1 1 240px", padding: "9px 12px", border: "1px solid " + C.rule, borderRadius: 5, fontSize: 14, fontFamily: FONT, color: C.ink }} />
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={selectStyle}>{["Any", "Remote", "Hybrid", "Onsite"].map((o) => <option key={o}>{o}</option>)}</select>
          <select value={segment} onChange={(e) => setSegment(e.target.value)} style={selectStyle}>{["Any", "Enterprise", "Mid-Market", "SMB"].map((o) => <option key={o}>{o}</option>)}</select>
          <select value={minPay} onChange={(e) => setMinPay(Number(e.target.value))} style={selectStyle}>
            <option value={0}>Any base</option><option value={80000}>$80k+</option><option value={100000}>$100k+</option><option value={130000}>$130k+</option><option value={160000}>$160k+</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle}>
            <option value="newest">Newest first</option><option value="pay">Highest pay</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 13 }}>
          {FAMILIES.map((f) => <Chip key={f} active={family === f} onClick={() => setFamily(f)}>{f}</Chip>)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 26, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div ref={listTop} style={{ scrollMarginTop: 78, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9, paddingLeft: 2 }}>
            <span style={{ fontSize: 13.5, color: C.muted }}>
              {feed.loading
                ? "Loading…"
                : filtered.length === 0
                  ? "No roles"
                  : pageCount > 1
                    ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} roles`
                    : `${filtered.length} ${filtered.length === 1 ? "role" : "roles"}`}
              {feed.generatedAt && !feed.loading ? ` — updated ${new Date(feed.generatedAt).toLocaleDateString()}` : ""}
            </span>
            {filtered.length !== jobs.length && <button onClick={reset} style={{ background: "none", border: "none", color: C.signal, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT, padding: 0 }}>Clear filters</button>}
          </div>

          <div style={{ border: "1px solid " + C.rule, borderRadius: 6, overflow: "hidden" }}>
            {feed.loading ? (
              [0, 1, 2].map((i) => (
                <div key={i} style={{ background: C.surface, padding: "22px 20px", borderBottom: "1px solid " + C.ruleSoft, display: "flex", gap: 15 }}>
                  <div style={{ width: 40, height: 40, background: C.ruleSoft, borderRadius: 3 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 13, width: "42%", background: C.ruleSoft, borderRadius: 3 }} />
                    <div style={{ height: 11, width: "26%", background: C.ruleSoft, borderRadius: 3, marginTop: 9 }} />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div style={{ background: C.surface, padding: "56px 24px", textAlign: "center" }}>
                <p style={{ fontSize: 16, color: C.ink, fontWeight: 600, margin: 0 }}>Nothing matches those filters yet.</p>
                <p style={{ fontSize: 14.5, color: C.body, margin: "8px 0 18px" }}>Widen the pay floor or clear the role type. New roles land every morning.</p>
                <Button kind="ghost" onClick={reset}>Clear filters</Button>
              </div>
            ) : (
              <>
                {visible.map((job) => <JobRow key={job.id} job={job} open={openId === job.id} toggle={() => setOpenId(openId === job.id ? null : job.id)} />)}
                <Pager page={safePage} pageCount={pageCount} setPage={goToPage} total={filtered.length} />
              </>
            )}
          </div>

          <p style={{ fontSize: 13, color: C.muted, marginTop: 14, lineHeight: 1.55 }}>
            Pulled from company career pages and applicant tracking systems each morning. Apply links go straight to the posting, never to a homepage.
          </p>
        </div>

        <aside className="hidden lg:block" style={{ width: 300, flex: "0 0 300px" }}>
          <div style={{ display: "grid", gap: 16, position: "sticky", top: 82 }}>
            <AdUnit slot={AD_SLOTS[0]} setTab={setTab} />
            <RailNewsletter onSub={onSub} subbed={subbed} />
            <div style={{ background: C.surface, border: "1px solid " + C.rule, borderRadius: 6, padding: 20 }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>Walk in with the deck already built</h4>
              <p style={{ fontSize: 13.5, color: C.body, lineHeight: 1.55, margin: "8px 0 14px" }}>QBR decks, health score models and renewal trackers. Built by a CSM who had to use them.</p>
              <Button kind="ghost" onClick={() => setTab("templates")} wide>Browse templates</Button>
            </div>
            <AdUnit slot={AD_SLOTS[1]} setTab={setTab} />
          </div>
        </aside>
      </div>
    </>
  );
}

/* --- newsletter ---------------------------------------------------------- */
function NewsletterPage({ onSub, subbed, issues }) {
  const [email, setEmail] = useState("");
  return (
    <div style={{ maxWidth: 780 }}>
      <PageHead title="The Friday roundup" sub="One email a week. The roles worth a look, which CS orgs are restructuring, and one thing you can use in your own book on Monday. No sponsors disguised as advice." />
      <div style={{ background: C.surface, border: "1px solid " + C.rule, borderRadius: 6, padding: 26, marginBottom: 44 }}>
        {subbed ? (
          <div>
            <p style={{ fontSize: 17, fontWeight: 650, color: C.signal, margin: 0 }}>You're on the list.</p>
            <p style={{ fontSize: 14.5, color: C.body, margin: "7px 0 0" }}>The next issue goes out Friday morning. Nothing else arrives in between.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" style={{ flex: "1 1 260px", padding: "12px 14px", border: "1px solid " + C.rule, borderRadius: 5, fontSize: 15, fontFamily: FONT, color: C.ink }} />
              <Button onClick={() => email.includes("@") && onSub()}>Subscribe free</Button>
            </div>
            <p style={{ fontSize: 13, color: C.muted, margin: "12px 0 0" }}>Weekly. Unsubscribe in one click. Your address is never sold or shared.</p>
          </>
        )}
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 700, color: C.ink, letterSpacing: "-0.025em", margin: "0 0 4px" }}>Past issues</h2>
      <p style={{ fontSize: 14.5, color: C.muted, margin: "0 0 16px" }}>Read a few before you decide.</p>
      <div style={{ border: "1px solid " + C.rule, borderRadius: 6, overflow: "hidden" }}>
        {ISSUES.map((iss) => (
          <a key={iss.n} href="#" onClick={(e) => e.preventDefault()} style={{ display: "block", background: C.surface, padding: "18px 20px", borderBottom: "1px solid " + C.ruleSoft, textDecoration: "none" }}>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
              <span style={{ fontSize: 13.5, color: C.muted, fontVariantNumeric: "tabular-nums", flex: "0 0 auto", paddingTop: 2, width: 88 }}>No. {iss.n}</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 650, color: C.ink, letterSpacing: "-0.015em" }}>{iss.title}</h3>
                <p style={{ margin: "5px 0 0", fontSize: 14.5, color: C.body, lineHeight: 1.55 }}>{iss.teaser}</p>
              </div>
              <span style={{ fontSize: 13, color: C.muted, flex: "0 0 auto", whiteSpace: "nowrap" }}>{iss.date}</span>
            </div>
          </a>
        ))}
      </div>
      <div style={{ marginTop: 32, background: C.flagSoft, border: "1px solid #EADFBC", borderRadius: 6, padding: 22 }}>
        <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: C.ink }}>One sponsor slot per issue</h3>
        <p style={{ fontSize: 14.5, color: C.body, lineHeight: 1.55, margin: "8px 0 0" }}>Plain text, near the top, written in the newsletter's voice. $199 an issue. Email <span style={{ color: C.ink, fontWeight: 600 }}>{BRAND.contactEmail}</span>.</p>
      </div>
    </div>
  );
}

/* --- templates ----------------------------------------------------------- */
function Cover({ src, stage, height = 168 }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div style={{ height, background: C.signalSoft, border: "1px solid " + C.ruleSoft, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.signal, letterSpacing: "-0.01em" }}>{stage}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      style={{ width: "100%", height, objectFit: "cover", borderRadius: 4, border: "1px solid " + C.ruleSoft, display: "block", background: C.ruleSoft }}
    />
  );
}

function TemplatesPage() {
  return (
    <div>
      <PageHead
        title="The templates behind the job"
        sub="Health scorecards, QBR decks, onboarding playbooks, renewal scripts and success plans. Editable, worked through with a real example, and built to fit together as one system rather than a folder of files."
      />

      {/* bundle */}
      <div style={{ background: C.surface, border: "2px solid " + C.signal, borderRadius: 6, padding: 24, marginBottom: 36, display: "flex", gap: 26, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 230px", minWidth: 200 }}>
          <Cover src={BUNDLE.cover} stage="Complete toolkit" height={210} />
        </div>
        <div style={{ flex: "1 1 340px" }}>
          <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
            <Tag tone="signal">Best value</Tag>
            <Tag tone="flag">{BUNDLE.save}</Tag>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: C.ink, letterSpacing: "-0.03em", lineHeight: 1.2 }}>{BUNDLE.name}</h2>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.ink, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>${BUNDLE.price}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{BUNDLE.compareAt}</div>
            </div>
          </div>
          <p style={{ fontSize: 15, color: C.body, lineHeight: 1.6, margin: "12px 0 0", maxWidth: "62ch" }}>{BUNDLE.summary}</p>
          <ul style={{ margin: "14px 0 0", paddingLeft: 17, fontSize: 14, color: C.body, lineHeight: 1.75, columns: 2, columnGap: 28 }}>
            {BUNDLE.contains.map((c) => <li key={c} style={{ breakInside: "avoid" }}>{c}</li>)}
          </ul>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.55, margin: "14px 0 18px", maxWidth: "60ch" }}>{BUNDLE.why}</p>
          <Button href={SHOP.buildUrl(BUNDLE.slug)}>Get the toolkit — ${BUNDLE.price}</Button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: "-0.025em", whiteSpace: "nowrap" }}>Or one at a time</h2>
        <div style={{ height: 1, background: C.rule, flex: 1 }} />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
        {PRODUCTS.map((p) => (
          <div key={p.slug} style={{ background: C.surface, border: "1px solid " + C.rule, borderRadius: 6, padding: 18, display: "flex", flexDirection: "column" }}>
            <Cover src={p.cover} stage={p.stage} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0 10px" }}>
              <Tag>{p.format}</Tag>
              <Tag tone="signal">{p.stage}</Tag>
              {p.forJobSeekers && <Tag tone="flag">For interviews</Tag>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1.3 }}>{p.name}</h3>
              <span style={{ fontSize: 19, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>${p.price}</span>
            </div>
            <p style={{ fontSize: 14.5, color: C.ink, fontWeight: 500, lineHeight: 1.5, margin: "8px 0 0" }}>{p.tagline}</p>
            <p style={{ fontSize: 14, color: C.body, lineHeight: 1.6, margin: "8px 0 0" }}>{p.summary}</p>
            <ul style={{ margin: "13px 0 0", paddingLeft: 17, fontSize: 13.5, color: C.body, lineHeight: 1.65 }}>
              {p.includes.map((i) => <li key={i} style={{ marginBottom: 3 }}>{i}</li>)}
            </ul>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "14px 0 18px" }}>
              {p.stats.map((st) => <Tag key={st}>{st}</Tag>)}
            </div>
            <div style={{ marginTop: "auto" }}>
              <Button href={SHOP.buildUrl(p.slug)} kind="ghost" wide>Buy — ${p.price}</Button>
            </div>
          </div>
        ))}
      </div>

      {/* free sample — feeds the list */}
      <div style={{ marginTop: 28, background: C.signalSoft, border: "1px solid #CBE2D8", borderRadius: 6, padding: 24, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 360px" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>Try a few prompts first, free</h3>
          <p style={{ fontSize: 14.5, color: C.body, lineHeight: 1.55, margin: "7px 0 0", maxWidth: "58ch" }}>
            A free sample pack from the AI Prompt Library. No card, no trial — if they're useful you'll know inside ten minutes.
          </p>
        </div>
        <Button href={SHOP.buildUrl(SHOP.freeLeadMagnet).replace("?wanted=true", "")}>Get the free pack</Button>
      </div>

      <p style={{ fontSize: 13.5, color: C.muted, marginTop: 22, maxWidth: "72ch", lineHeight: 1.6 }}>
        Every file is editable and yours to keep. Checkout, downloads and refunds are handled by Gumroad.
        Set your vendor name once in <code>SHOP.vendor</code> and every button on this page follows.
      </p>
    </div>
  );
}

/* --- resources ----------------------------------------------------------- */
function ResourcesPage({ setTab, groups }) {
  return (
    <div>
      <PageHead title="Free resources" sub="Sorted by what you're trying to do right now, not by content type. Nothing here is gated and nothing asks for your email first." />
      <div style={{ display: "grid", gap: 36 }}>
        {groups.map((g) => (
          <section key={g.goal}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: "-0.025em", margin: "0 0 12px", paddingBottom: 9, borderBottom: "1px solid " + C.rule }}>{g.goal}</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
              {g.items.map((it) => {
                const thumb = videoThumb(it.url);
                const live = !!it.url;
                return (
                  <a
                    key={it.title}
                    href={it.url || "#"}
                    target={live ? "_blank" : undefined}
                    rel={live ? "noopener noreferrer" : undefined}
                    onClick={(e) => { if (!live) e.preventDefault(); }}
                    style={{ background: C.surface, border: "1px solid " + C.rule, borderRadius: 6, padding: 18, textDecoration: "none", display: "block", opacity: live ? 1 : 0.7 }}
                  >
                    {thumb && (
                      <img src={thumb} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 4, border: "1px solid " + C.ruleSoft, marginBottom: 12, display: "block", background: C.ruleSoft }} />
                    )}
                    <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
                      <Tag tone={it.kind === "Video" ? "signal" : "plain"}>{it.kind}</Tag>
                      {it.len && <Tag>{it.len}</Tag>}
                      {!live && <Tag tone="flag">Coming soon</Tag>}
                    </div>
                    <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 650, color: C.ink, lineHeight: 1.35, letterSpacing: "-0.01em" }}>{it.title}</h3>
                    <p style={{ fontSize: 14, color: C.body, lineHeight: 1.55, margin: "7px 0 0" }}>{it.desc}</p>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div style={{ marginTop: 40, background: C.surface, border: "1px solid " + C.rule, borderRadius: 6, padding: 24, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 340px" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>Want the editable versions?</h3>
          <p style={{ fontSize: 14.5, color: C.body, lineHeight: 1.55, margin: "7px 0 0" }}>The guides here explain the thinking. The templates are the same thing built out and ready to fill in.</p>
        </div>
        <Button onClick={() => setTab("templates")}>See the templates</Button>
      </div>
    </div>
  );
}


/* --- submit a listing ---------------------------------------------------- */
const ROLE_TYPES = FAMILIES.filter((f) => f !== "All roles");

const EMPTY_LISTING = {
  company: "", title: "", url: "", location: "", mode: "Remote",
  family: "Customer Success", min: "", max: "", book: "", email: "",
};

function validateListing(f) {
  const e = {};
  if (!f.company.trim()) e.company = "Add the company name.";
  if (!f.title.trim()) e.title = "Add the role title.";

  if (!f.url.trim()) e.url = "Add a link to the posting.";
  else if (!/^https?:\/\/\S+\.\S+/.test(f.url.trim())) e.url = "That doesn't look like a full link. Start with https://";

  if (!f.location.trim()) e.location = "Add a location, or write Remote.";

  const min = Number(String(f.min).replace(/[^0-9.]/g, ""));
  const max = Number(String(f.max).replace(/[^0-9.]/g, ""));
  if (!f.min.trim() || !isFinite(min) || min <= 0) e.min = "Add the bottom of the range.";
  else if (min < 20000) e.min = "Enter the annual figure, not hourly or thousands.";
  if (!f.max.trim() || !isFinite(max) || max <= 0) e.max = "Add the top of the range.";
  else if (max < 20000) e.max = "Enter the annual figure, not hourly or thousands.";
  if (!e.min && !e.max && max < min) e.max = "The top of the range is below the bottom.";
  if (!e.min && !e.max && max / min > 4) e.max = "That range is unusually wide. Double-check it.";

  if (!f.email.trim()) e.email = "Add an email so we can confirm the listing.";
  else if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "That email address looks incomplete.";

  return e;
}

function Field({ label, hint, error, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.ink, marginBottom: 5 }}>{label}</span>
      {children}
      {error
        ? <span style={{ display: "block", fontSize: 12.5, color: "#A3341C", marginTop: 5 }}>{error}</span>
        : hint ? <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginTop: 5 }}>{hint}</span> : null}
    </label>
  );
}

function ListingForm({ onClose }) {
  const [f, setF] = useState(EMPTY_LISTING);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("editing"); // editing | sending | sent | emailed
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const inputStyle = (bad) => ({
    width: "100%", padding: "10px 12px", border: "1px solid " + (bad ? "#C87B68" : C.rule),
    borderRadius: 5, fontSize: 14.5, fontFamily: FONT, color: C.ink,
    background: C.surface, boxSizing: "border-box",
  });

  async function submit() {
    const e = validateListing(f);
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = {
      company: f.company.trim(),
      title: f.title.trim(),
      applyUrl: f.url.trim(),
      location: f.location.trim(),
      mode: f.mode,
      family: f.family,
      salaryMin: Number(String(f.min).replace(/[^0-9.]/g, "")),
      salaryMax: Number(String(f.max).replace(/[^0-9.]/g, "")),
      book: f.book.trim(),
      contactEmail: f.email.trim(),
      submittedAt: new Date().toISOString(),
    };

    if (LISTING_ENDPOINT) {
      setState("sending");
      try {
        const res = await fetch(LISTING_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(String(res.status));
        setState("sent");
        return;
      } catch {
        setState("editing");
        setErrors({ form: "That didn't send. Try again, or email " + BRAND.contactEmail + " directly." });
        return;
      }
    }

    // No endpoint configured: open a pre-filled email instead of losing the data.
    const lines = [
      `Company: ${payload.company}`,
      `Role: ${payload.title}`,
      `Link: ${payload.applyUrl}`,
      `Location: ${payload.location} (${payload.mode})`,
      `Type: ${payload.family}`,
      `Base salary: $${payload.salaryMin.toLocaleString()} - $${payload.salaryMax.toLocaleString()}`,
      payload.book ? `Book of business: ${payload.book}` : null,
      `Contact: ${payload.contactEmail}`,
    ].filter(Boolean).join("\n");
    window.location.href =
      `mailto:${BRAND.contactEmail}?subject=${encodeURIComponent("Free listing: " + payload.title + " at " + payload.company)}&body=${encodeURIComponent(lines)}`;
    setState("emailed");
  }

  if (state === "sent" || state === "emailed") {
    return (
      <div style={{ background: C.surface, borderRadius: 6, padding: 26 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.signal, letterSpacing: "-0.02em" }}>
          {state === "sent" ? "Listing received." : "Your email client is open."}
        </h3>
        <p style={{ fontSize: 14.5, color: C.body, lineHeight: 1.6, margin: "8px 0 18px", maxWidth: "58ch" }}>
          {state === "sent"
            ? `${f.title} at ${f.company} is in the queue. Free listings are checked by hand and go live within a day. You'll get a note at ${f.email} when it's on the board.`
            : `Send the message that just opened and the listing is in the queue. Free listings go live within a day.`}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button kind="ghost" onClick={() => { setF(EMPTY_LISTING); setErrors({}); setState("editing"); }}>Submit another</Button>
          <Button kind="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.surface, borderRadius: 6, padding: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: C.ink, letterSpacing: "-0.025em" }}>Submit a free listing</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", fontFamily: FONT, fontSize: 13.5, color: C.muted, cursor: "pointer", padding: 4 }}>Close</button>
      </div>
      <p style={{ fontSize: 14.5, color: C.body, lineHeight: 1.6, margin: "0 0 20px", maxWidth: "60ch" }}>
        Takes about a minute. Listings are checked by hand and go live within a day.
      </p>

      <div style={{ background: C.flagSoft, border: "1px solid #EADFBC", borderRadius: 5, padding: "12px 14px", marginBottom: 22 }}>
        <p style={{ fontSize: 13.5, color: C.body, lineHeight: 1.55, margin: 0 }}>
          <span style={{ fontWeight: 600, color: C.ink }}>The salary range is required.</span>{" "}
          Every role on this board shows one. It's the rule the whole site runs on, and we can't make an exception.
        </p>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        <Field label="Company" error={errors.company}>
          <input value={f.company} onChange={set("company")} placeholder="Northloop" style={inputStyle(errors.company)} />
        </Field>
        <Field label="Role title" error={errors.title}>
          <input value={f.title} onChange={set("title")} placeholder="Senior Customer Success Manager" style={inputStyle(errors.title)} />
        </Field>
      </div>

      <div style={{ marginTop: 16 }}>
        <Field label="Link to the posting" error={errors.url} hint="Where applicants land. Your careers page or ATS link is fine.">
          <input value={f.url} onChange={set("url")} placeholder="https://boards.greenhouse.io/yourcompany/jobs/12345" style={inputStyle(errors.url)} />
        </Field>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginTop: 16 }}>
        <Field label="Location" error={errors.location}>
          <input value={f.location} onChange={set("location")} placeholder="Remote — US, or Austin, TX" style={inputStyle(errors.location)} />
        </Field>
        <Field label="Work mode">
          <select value={f.mode} onChange={set("mode")} style={inputStyle(false)}>
            {["Remote", "Hybrid", "Onsite"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Role type">
          <select value={f.family} onChange={set("family")} style={inputStyle(false)}>
            {ROLE_TYPES.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginTop: 16 }}>
        <Field label="Base salary, bottom" error={errors.min} hint="Annual, in USD.">
          <input value={f.min} onChange={set("min")} inputMode="numeric" placeholder="130000" style={inputStyle(errors.min)} />
        </Field>
        <Field label="Base salary, top" error={errors.max}>
          <input value={f.max} onChange={set("max")} inputMode="numeric" placeholder="160000" style={inputStyle(errors.max)} />
        </Field>
        <Field label="Book of business" hint="Optional, and the first thing CSMs look for.">
          <input value={f.book} onChange={set("book")} placeholder="38 accounts / $4.1M ARR" style={inputStyle(false)} />
        </Field>
      </div>

      <div style={{ marginTop: 16, maxWidth: 420 }}>
        <Field label="Your email" error={errors.email} hint="Only used to confirm the listing. Never published.">
          <input value={f.email} onChange={set("email")} placeholder="you@company.com" style={inputStyle(errors.email)} />
        </Field>
      </div>

      {errors.form && (
        <p style={{ fontSize: 13.5, color: "#A3341C", margin: "16px 0 0" }}>{errors.form}</p>
      )}

      <div style={{ marginTop: 22, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Button onClick={submit}>{state === "sending" ? "Sending…" : "Submit listing"}</Button>
        <span style={{ fontSize: 13, color: C.muted }}>Free. No account needed.</span>
      </div>
    </div>
  );
}

/* --- advertise ----------------------------------------------------------- */
function AdvertisePage() {
  const [showForm, setShowForm] = useState(false);
  return (
    <div>
      <PageHead title="Reach customer success people who are actually looking" sub="A narrow audience: CSMs, account managers, renewals and CS ops, most of them mid-career and actively changing jobs. Four ways to reach them, and a hard cap on how much of the site is for sale." />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", marginBottom: 40 }}>
        {AD_PACKAGES.map((p) => (
          <div key={p.name} style={{ background: C.surface, border: "1px solid " + C.rule, borderRadius: 6, padding: 22, display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>{p.name}</h3>
            <div style={{ margin: "10px 0 0", display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ fontSize: 27, fontWeight: 800, color: C.ink, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{p.price}</span>
              <span style={{ fontSize: 13.5, color: C.muted }}>{p.unit}</span>
            </div>
            <p style={{ fontSize: 14.5, color: C.body, lineHeight: 1.6, margin: "12px 0 14px" }}>{p.what}</p>
            <ul style={{ margin: "0 0 18px", paddingLeft: 17, fontSize: 14, color: C.body, lineHeight: 1.7 }}>{p.stats.map((s) => <li key={s}>{s}</li>)}</ul>
            <div style={{ marginTop: "auto" }}><Button kind="ghost" href={"mailto:" + BRAND.contactEmail + "?subject=" + encodeURIComponent(p.name)} wide>Book this slot</Button></div>
          </div>
        ))}
      </div>
      <div style={{ background: C.surface, border: "1px solid " + C.rule, borderRadius: 6, padding: 26, marginBottom: 26 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: "-0.025em", margin: 0 }}>Current inventory</h2>
        <p style={{ fontSize: 14.5, color: C.body, margin: "7px 0 18px" }}>Two rail slots exist on this site and there will never be a third.</p>
        <div style={{ display: "grid", gap: 10 }}>
          {AD_SLOTS.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "13px 15px", border: "1px solid " + C.ruleSoft, borderRadius: 5, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{s.label}</div>
                <div style={{ fontSize: 13.5, color: C.muted, marginTop: 2 }}>{s.size} — {s.price}</div>
              </div>
              <Tag tone={s.sold ? "plain" : "signal"}>{s.sold ? "Sold" : "Available"}</Tag>
            </div>
          ))}
        </div>
      </div>
      <div id="submit-listing" style={{ background: C.ink, borderRadius: 6, padding: showForm ? 4 : 30, color: "#fff" }}>
        {showForm ? (
          <ListingForm onClose={() => setShowForm(false)} />
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", margin: 0, color: "#fff" }}>Hiring a CS person?</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, margin: "10px 0 20px", color: "#C6D2CD", maxWidth: "60ch" }}>
              Send us the role and a salary range. Free listings are checked by hand and go live within a day.
              A featured slot puts it at the top of the board for a month.
            </p>
            <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
              <Button onClick={() => setShowForm(true)}>Submit a free listing</Button>
              <a href={"mailto:" + BRAND.contactEmail + "?subject=Featured%20listing"} style={{ color: "#fff", border: "1px solid #3A4B44", borderRadius: 5, padding: "10px 18px", fontSize: 14, fontWeight: 600, textDecoration: "none", fontFamily: FONT }}>Feature a role — $99</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --- footer -------------------------------------------------------------- */
function Footer({ setTab }) {
  const linkBtn = { background: "none", border: "none", padding: 0, textAlign: "left", fontFamily: FONT, fontSize: 13.5, color: C.body, cursor: "pointer" };
  return (
    <footer style={{ borderTop: "1px solid " + C.rule, marginTop: 64, background: C.paper }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "34px 20px 46px", display: "flex", gap: 34, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ maxWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.045em", color: C.ink }}>{BRAND.name}</span>
            <span style={{ width: 6, height: 6, borderRadius: 2, background: C.signal, marginTop: 5 }} />
          </div>
          <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, margin: "9px 0 0" }}>Built by a customer success manager who got laid off and went looking for a board like this. There wasn't one.</p>
        </div>
        <div style={{ display: "flex", gap: 46, flexWrap: "wrap" }}>
          <div>
            <h4 style={{ fontSize: 13.5, fontWeight: 650, color: C.ink, margin: "0 0 10px" }}>Site</h4>
            <div style={{ display: "grid", gap: 7 }}>
              {[["jobs", "Jobs"], ["newsletter", "Newsletter"], ["templates", "Templates"], ["resources", "Free resources"]].map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} style={linkBtn}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 13.5, fontWeight: 650, color: C.ink, margin: "0 0 10px" }}>Business</h4>
            <div style={{ display: "grid", gap: 7 }}>
              <button onClick={() => setTab("advertise")} style={linkBtn}>Advertise</button>
              <button onClick={() => setTab("advertise")} style={linkBtn}>Post a job</button>
              <a href={"mailto:" + BRAND.contactEmail} style={{ fontSize: 13.5, color: C.body, textDecoration: "none" }}>{BRAND.contactEmail}</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* --- app ----------------------------------------------------------------- */
export default function App() {
  const [tab, setTab] = useState("jobs");
  const [subbed, setSubbed] = useState(false);
  const [feed, setFeed] = useState({ jobs: [], loading: true, sample: false, generatedAt: null });
  const [content, setContent] = useState({ issues: ISSUES, resources: RESOURCE_GROUPS });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(JOBS_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!Array.isArray(data.jobs) || data.jobs.length === 0) throw new Error("empty feed");
        if (live) setFeed({ jobs: data.jobs, loading: false, sample: false, generatedAt: data.generatedAt || null });
      } catch {
        // No jobs.json yet (local preview, first deploy, or ingest hasn't run).
        // Show the sample board and say so, rather than an empty page.
        if (live) setFeed({ jobs: SAMPLE_JOBS, loading: false, sample: true, generatedAt: null });
      }
    })();
    return () => { live = false; };
  }, []);

  // Newsletter issues and free resources live in /content.json so publishing
  // is a file edit, not a code change. Built-in defaults if it isn't there.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(CONTENT_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const c = await res.json();
        if (!live) return;
        setContent({
          issues: Array.isArray(c.issues) && c.issues.length ? c.issues : ISSUES,
          resources: Array.isArray(c.resources) && c.resources.length ? c.resources : RESOURCE_GROUPS,
        });
      } catch { /* defaults already in state */ }
    })();
    return () => { live = false; };
  }, []);

  const pages = {
    jobs: <JobsPage setTab={setTab} onSub={() => setSubbed(true)} subbed={subbed} feed={feed} />,
    newsletter: <NewsletterPage onSub={() => setSubbed(true)} subbed={subbed} issues={content.issues} />,
    templates: <TemplatesPage />,
    resources: <ResourcesPage setTab={setTab} groups={content.resources} />,
    advertise: <AdvertisePage />,
  };

  return (
    <div style={{ background: C.paper, minHeight: "100vh", fontFamily: FONT, color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible {
          outline: 2px solid ${C.signal}; outline-offset: 2px;
        }
        input:focus, select:focus { outline: 2px solid ${C.signal}; outline-offset: 0; }
        a { color: inherit; }
        code { font-size: 0.92em; background: rgba(0,0,0,.06); padding: 1px 5px; border-radius: 3px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>
      <Header tab={tab} setTab={setTab} />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "34px 20px 0" }}>{pages[tab]}</main>
      <Footer setTab={setTab} />
    </div>
  );
}
