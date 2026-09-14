/* ============================================================================
   parse.js — pulling structure out of job description HTML
   ----------------------------------------------------------------------------
   ATS feeds give you a title, a location, and a blob of marketing HTML.
   Everything that makes this board different — the salary, the book size,
   the tooling — has to be dug out of that blob. This file does the digging.
   ========================================================================== */

/* --- HTML → text --------------------------------------------------------- */

const ENTITIES = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
  "&apos;": "'", "&nbsp;": " ", "&ndash;": "–", "&mdash;": "—",
  "&rsquo;": "'", "&lsquo;": "'", "&ldquo;": '"', "&rdquo;": '"',
  "&hellip;": "…", "&bull;": "•", "&middot;": "·", "&#x27;": "'",
  "&#x2F;": "/", "&#160;": " ", "&euro;": "€", "&pound;": "£",
};

export function decodeEntities(s) {
  if (!s) return "";
  let out = String(s);
  // Greenhouse double-encodes: &amp;lt;p&amp;gt; — run twice.
  for (let pass = 0; pass < 2; pass++) {
    out = out.replace(/&[a-zA-Z#0-9x]+;/g, (m) => {
      if (ENTITIES[m]) return ENTITIES[m];
      const num = m.match(/^&#(\d+);$/);
      if (num) return String.fromCharCode(parseInt(num[1], 10));
      const hex = m.match(/^&#x([0-9a-fA-F]+);$/);
      if (hex) return String.fromCharCode(parseInt(hex[1], 16));
      return m;
    });
  }
  return out;
}

export function htmlToText(html) {
  if (!html) return "";
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map((l) => l.trim()).join("\n")
    .trim();
}

/* --- sectioned list extraction ------------------------------------------- *
   Most job posts are: heading, then a <ul>. We map headings to two buckets so
   the site can show "What you own" and "What they want" instead of one wall.  */

const SKIP_HINTS = [
  "benefit", "perks", "compensation", "equal opportunity", "eeo", "about us",
  "about the company", "our values", "why join", "what we offer", "diversity",
  "accommodation", "legal", "e-verify", "privacy", "disclaimer", "notice",
  "apply", "how to apply", "interview process", "pay transparency",
];

/* Boilerplate paragraphs that add nothing to a listing. */
const JUNK_PARA =
  /(equal opportunity|without regard to race|reasonable accommodation|e-verify|background check|we are committed to (building )?a diverse|applicants will not be discriminated|pursuant to the)/i;

function normalizeHeadings(doc) {
  // <p><strong>Responsibilities</strong></p> is a heading in every ATS but the
  // markup doesn't say so. Promote it before tokenising.
  return doc.replace(
    /<(?:p|div)[^>]*>\s*<(?:strong|b)[^>]*>([\s\S]{2,90}?)<\/(?:strong|b)>\s*<\/(?:p|div)>/gi,
    "<h3>$1</h3>"
  );
}

function tokenize(html) {
  const doc = normalizeHeadings(decodeEntities(html || ""));
  const re = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>|<p[^>]*>([\s\S]*?)<\/p>|<li[^>]*>([\s\S]*?)<\/li>/gi;
  const out = [];
  let m;
  while ((m = re.exec(doc)) !== null) {
    if (m[1]) out.push({ type: "h", text: htmlToText(m[2]) });
    else if (m[3] !== undefined) out.push({ type: "p", text: htmlToText(m[3]) });
    else if (m[4] !== undefined) out.push({ type: "li", text: htmlToText(m[4]).replace(/^[•\-\u2013]\s*/, "") });
  }
  return out.filter((b) => b.text && b.text.length > 1);
}

const skipTitle = (t) => SKIP_HINTS.some((k) => t.toLowerCase().includes(k));

/**
 * Pull a real, readable excerpt out of a posting: a multi-paragraph summary
 * plus the actual sections the employer wrote, headings intact.
 *
 * Deliberately NOT reshaped into "what you own / what they want" buckets —
 * that framing forced every posting into a template it didn't fit, and
 * mislabelled bullets when the guess was wrong. Showing the employer's own
 * headings is both more useful and more honest.
 *
 * @returns {{ summary: string, sections: Array<{title, paras, bullets}> }}
 */
export function extractDetail(html, { maxSections = 4, maxBullets = 8, maxParas = 3 } = {}) {
  const blocks = tokenize(html);
  if (!blocks.length) return { summary: "", sections: [] };

  /* summary: the prose before the first heading, else the first paragraphs */
  const lead = [];
  for (const b of blocks) {
    if (b.type === "h" && lead.length) break;
    if (b.type !== "p") continue;
    if (JUNK_PARA.test(b.text)) continue;
    if (b.text.length < 40) continue;
    lead.push(b.text);
    if (lead.join(" ").length > 620 || lead.length >= 4) break;
  }
  let summary = lead.join("\n\n").trim();
  if (summary.length > 900) summary = summary.slice(0, 900).replace(/\s+\S*$/, "") + "…";

  /* sections: the employer's own headings, with their content under them */
  const sections = [];
  let cur = null;
  for (const b of blocks) {
    if (b.type === "h") {
      if (cur && (cur.bullets.length || cur.paras.length)) sections.push(cur);
      cur = skipTitle(b.text) || b.text.length > 90 ? null : { title: b.text, paras: [], bullets: [] };
      continue;
    }
    if (!cur) continue;
    if (b.type === "li") {
      if (b.text.length > 8 && b.text.length < 340 && cur.bullets.length < maxBullets) cur.bullets.push(b.text);
    } else if (b.type === "p") {
      if (JUNK_PARA.test(b.text)) continue;
      if (b.text.length > 40 && cur.paras.length < maxParas && !lead.includes(b.text)) cur.paras.push(b.text);
    }
  }
  if (cur && (cur.bullets.length || cur.paras.length)) sections.push(cur);

  /* No usable headings — don't leave the reader with two lines. Surface
     whatever prose and bullets the posting does have, honestly labelled. */
  if (!sections.length) {
    const bullets = blocks
      .filter((b) => b.type === "li" && b.text.length > 8 && b.text.length < 340)
      .map((b) => b.text);
    const paras = blocks
      .filter((b) => b.type === "p" && b.text.length > 40 && !JUNK_PARA.test(b.text) && !lead.includes(b.text))
      .map((b) => b.text);
    if (bullets.length || paras.length) {
      sections.push({
        title: "From the job description",
        paras: paras.slice(0, 4),
        bullets: bullets.slice(0, maxBullets),
      });
    }
  }

  /* if there was no lead prose, borrow the first section's paragraph */
  if (!summary && sections.length && sections[0].paras.length) summary = sections[0].paras[0];

  return { summary, sections: dedupeSections(sections).slice(0, maxSections) };
}

function dedupeSections(list) {
  const seen = new Set();
  return list.filter((sec) => {
    const k = sec.title.toLowerCase().replace(/[^a-z]/g, "");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* --- blurb --------------------------------------------------------------- */

export function extractBlurb(html, maxLen = 260) {
  const text = htmlToText(html);
  const paras = text.split("\n").map((p) => p.trim()).filter(Boolean);
  const junk =
    /^(about (us|the company)|equal opportunity|at [A-Z][\w& ]+,? we (are|believe))/i;
  for (const p of paras) {
    if (p.startsWith("•")) continue;
    if (p.length < 60) continue;
    if (junk.test(p)) continue;
    return p.length > maxLen ? p.slice(0, maxLen).replace(/[\s,;]+\S*$/, "") + "…" : p;
  }
  const first = paras.find((p) => p.length > 30) || "";
  return first.length > maxLen ? first.slice(0, maxLen) + "…" : first;
}

/* --- salary -------------------------------------------------------------- *
   The whole editorial promise of the board rests on this function, so it is
   deliberately conservative: it would rather return null than publish a wrong
   number. Anything it can't verify gets dropped from the board.              */

const HOURS_PER_YEAR = 2080;

// Contexts that look like money but are not this job's base salary.
const POISON = /\b(arr|acv|mrr|revenue|quota|book of business|pipeline|raised|funding|valuation|series [a-e]|401\(?k\)?|budget|savings|cost|discount|fine|penalt)\b/i;

function toNumber(raw, kMarker) {
  let n = parseFloat(String(raw).replace(/,/g, ""));
  if (isNaN(n)) return null;
  if (kMarker) n *= 1000;
  return n;
}

function plausibleAnnual(n) {
  return n >= 30000 && n <= 800000;
}
function plausibleHourly(n) {
  return n >= 15 && n <= 400;
}

/**
 * Pull a base salary range out of free text.
 * Returns { min, max, basis } or null.
 */
export function parseSalaryFromText(text) {
  if (!text) return null;
  const clean = String(text).replace(/[\u2010-\u2015]/g, "-").replace(/\u00a0/g, " ");
  const candidates = [];

  // $120,000 - $150,000  |  $120K–$150K  |  $120,000 to $150,000
  const rangeRe =
    /\$\s*([\d][\d,]*(?:\.\d+)?)\s*(k|m)?\s*(?:-|–|—|to|up to|through)\s*\$?\s*([\d][\d,]*(?:\.\d+)?)\s*(k|m)?/gi;
  let m;
  while ((m = rangeRe.exec(clean)) !== null) {
    const ctx = clean.slice(Math.max(0, m.index - 90), m.index + m[0].length + 90);
    if (POISON.test(ctx)) continue;
    if (/\bm\b/i.test(m[2] || "") || /\bm\b/i.test(m[4] || "")) continue; // $1M–$2M is not a salary
    let lo = toNumber(m[1], /k/i.test(m[2] || ""));
    let hi = toNumber(m[3], /k/i.test(m[4] || ""));
    if (lo == null || hi == null) continue;

    const hourly = /\b(per hour|\/ ?hour|hourly|an hour|\/hr|per hr)\b/i.test(ctx);
    if (hourly) {
      if (!plausibleHourly(lo) || !plausibleHourly(hi)) continue;
      lo = Math.round(lo * HOURS_PER_YEAR);
      hi = Math.round(hi * HOURS_PER_YEAR);
    }
    // "$120 - $150" with no k and no hourly marker is almost certainly K.
    if (!hourly && lo < 1000 && hi < 1000 && lo >= 30 && hi <= 800) {
      lo *= 1000; hi *= 1000;
    }
    if (lo > hi) [lo, hi] = [hi, lo];
    if (!plausibleAnnual(lo) || !plausibleAnnual(hi)) continue;
    if (hi / lo > 4) continue; // absurd spread, probably two unrelated figures
    candidates.push({ min: Math.round(lo), max: Math.round(hi), basis: hourly ? "hourly" : "annual" });
  }

  if (candidates.length) {
    // Prefer the range that appears nearest an explicit salary cue.
    const cueRe = /\b(base salary|salary range|base pay|pay range|compensation range|annual salary|expected salary)\b/i;
    const cued = candidates.find((c) => {
      const i = clean.indexOf("$" + String(c.min).slice(0, 3));
      return i > -1 && cueRe.test(clean.slice(Math.max(0, i - 160), i + 60));
    });
    return cued || candidates[0];
  }

  // Single figure with an explicit salary cue: "base salary of $140,000"
  const singleRe =
    /\b(?:base salary|salary|base pay|compensation)\b[^.$\n]{0,40}\$\s*([\d][\d,]*(?:\.\d+)?)\s*(k)?/i;
  const s = singleRe.exec(clean);
  if (s) {
    const ctx = clean.slice(Math.max(0, s.index - 60), s.index + s[0].length + 60);
    if (!POISON.test(ctx)) {
      const n = toNumber(s[1], /k/i.test(s[2] || "")) ?? (s[1] < 1000 ? null : null);
      let v = n;
      if (v != null && v < 1000) v *= 1000;
      if (v != null && plausibleAnnual(v)) {
        return { min: Math.round(v), max: Math.round(v), basis: "annual" };
      }
    }
  }
  return null;
}

/**
 * Normalise a structured compensation object (Ashby / Lever supply these).
 * Structured data always beats text scraping, so adapters call this first.
 */
export function normalizeStructuredPay({ min, max, interval, currency }) {
  if (min == null && max == null) return null;
  const cur = (currency || "USD").toUpperCase();
  if (!["USD", "CAD"].includes(cur)) return null; // board is US/Canada for now
  let lo = Number(min ?? max);
  let hi = Number(max ?? min);
  if (!isFinite(lo) || !isFinite(hi)) return null;

  const iv = String(interval || "").toLowerCase();
  if (/hour/.test(iv)) { lo *= HOURS_PER_YEAR; hi *= HOURS_PER_YEAR; }
  else if (/month/.test(iv)) { lo *= 12; hi *= 12; }
  else if (/week/.test(iv)) { lo *= 52; hi *= 52; }
  else if (/day/.test(iv)) { lo *= 260; hi *= 260; }

  if (lo > hi) [lo, hi] = [hi, lo];
  if (!plausibleAnnual(lo) || !plausibleAnnual(hi)) return null;
  return { min: Math.round(lo), max: Math.round(hi), basis: "annual", currency: cur };
}

/* --- variable comp ------------------------------------------------------- */

export function parseVariable(text) {
  if (!text) return "";
  const t = String(text);
  const ote = /\$\s*([\d][\d,]*)\s*(k)?\s*(?:-|–|to)\s*\$?\s*([\d][\d,]*)\s*(k)?\s*(?:total|ote|on-target)/i.exec(t)
    || /\b(?:ote|on-target earnings)\b[^.\n]{0,30}\$\s*([\d][\d,]*)\s*(k)?(?:\s*(?:-|–|to)\s*\$?\s*([\d][\d,]*)\s*(k)?)?/i.exec(t);
  if (ote) {
    const a = toNumber(ote[1], /k/i.test(ote[2] || ""));
    const b = ote[3] ? toNumber(ote[3], /k/i.test(ote[4] || "")) : null;
    const fmt = (n) => "$" + Math.round((n < 1000 ? n * 1000 : n) / 1000) + "K";
    if (a && plausibleAnnual(a < 1000 ? a * 1000 : a)) {
      return b ? `${fmt(a)}–${fmt(b)} OTE` : `${fmt(a)} OTE`;
    }
  }
  const bonusPct = /\b(\d{1,2})\s*%\s*(?:annual\s+)?(?:target\s+)?bonus\b/i.exec(t);
  if (bonusPct) return `+ ${bonusPct[1]}% bonus`;

  const bits = [];
  if (/\bcommission\b/i.test(t)) bits.push("commission");
  if (/\bequity\b|\bstock options\b|\brsus?\b/i.test(t)) bits.push("equity");
  if (/\bbonus\b/i.test(t) && !bonusPct) bits.push("bonus");
  return bits.length ? "+ " + bits.join(" + ") : "";
}

/* --- book of business ---------------------------------------------------- *
   Nobody else surfaces this. It is the single most useful number to a CSM
   deciding whether to apply, and it is almost always buried in a bullet.     */

/* Phrases that mean the number describes the COMPANY, not the job.
   "We serve 10,000 customers" and "we passed $50M ARR" are marketing, and
   putting either in a Book field is a lie about the role. */
const COMPANY_SCALE =
  /\b(we (have|serve|support|work with|power|help|passed|hit|reached)|our (customers|clients|platform|users|community)|trusted by|used by|serving|backed by|raised|valuation|founded|employees|team members|worldwide|globally|across the globe|fortune 500 companies use|company is a|we're a|we are a)\b/i;

/* Phrases that mean the number IS the job. */
const ROLE_OWNERSHIP =
  /\b(you(r)?( will)?( be)?\s*(own|manage|handle|carry|oversee|responsible)|book of business|your book|a book of|portfolio of|manage a|managing a|own a|owning a|be responsible for|responsible for|assigned|oversee|carry a|carrying a|this role (owns|manages)|the role (owns|manages))\b/i;

const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, eighty: 80, hundred: 100,
};

/** True only if the window around a match reads as this role's own number. */
function isRoleScoped(text, index, len) {
  const win = text.slice(Math.max(0, index - 130), index + len + 70);
  if (COMPANY_SCALE.test(win)) return false;
  return ROLE_OWNERSHIP.test(win);
}

/**
 * Book of business — accounts and/or ARR, but ONLY when the posting ties the
 * number to the role. Returns "" whenever that isn't clear, because an empty
 * field is better than a confident wrong one.
 */
export function parseBook(text) {
  if (!text) return "";
  const t = String(text).replace(/[\u2010-\u2015]/g, "-");
  let accounts = null, arr = null;

  /* digits: "a book of 38 accounts", "manage 45 mid-market clients" */
  const acctRe = /\b(\d{1,4})\s*(?:\+)?\s*(?:[\w-]+\s+){0,2}?(accounts|customers|clients|logos|partners|contracts|subscriptions)\b/gi;
  let m;
  while ((m = acctRe.exec(t)) !== null) {
    if (!isRoleScoped(t, m.index, m[0].length)) continue;
    const n = parseInt(m[1], 10);
    if (n > 0 && n <= 2000) { accounts = `${n} ${m[2].toLowerCase()}`; break; }
  }

  /* ARR / quota / renewal base tied to the role */
  const arrRe = /\$\s*([\d][\d,.]*)\s*(k|m|mm|b|million|billion)?\s*(?:in\s+)?(?:[\w-]+\s+){0,2}?(arr|acv|revenue|book|renewal base|renewal book|quota)\b/gi;
  while ((m = arrRe.exec(t)) !== null) {
    if (!isRoleScoped(t, m.index, m[0].length)) continue;
    const num = parseFloat(m[1].replace(/,/g, ""));
    const unit = (m[2] || "").toLowerCase();
    if (!isFinite(num)) continue;
    let label = null;
    if (/^m|^mm|million/.test(unit)) label = `$${num}M`;
    else if (/^b|billion/.test(unit)) label = `$${num}B`;
    else if (unit === "k") label = `$${num}K`;
    else if (num >= 1000000) label = `$${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    else if (num >= 1000) label = `$${Math.round(num / 1000)}K`;
    if (label) { arr = `${label} ${/quota/i.test(m[3]) ? "quota" : "ARR"}`; break; }
  }

  /* written-out counts, only as a last resort and still role-scoped */
  if (!accounts) {
    const wre = new RegExp(`\\b(${Object.keys(WORD_NUM).join("|")})\\b[^.\\n]{0,30}?\\b(accounts|customers|clients|logos|contracts)\\b`, "gi");
    while ((m = wre.exec(t)) !== null) {
      if (!isRoleScoped(t, m.index, m[0].length)) continue;
      accounts = `${WORD_NUM[m[1].toLowerCase()]} ${m[2].toLowerCase()}`;
      break;
    }
  }

  /* team size for leadership roles */
  if (!accounts) {
    const team = /\b(?:manage|lead|leading|managing|build|grow)\s+(?:and \w+\s+)?a\s+team\s+of\s+(\d{1,3})\b/i.exec(t);
    if (team) {
      const n = parseInt(team[1], 10);
      if (n > 0 && n < 200) accounts = `Team of ${n}`;
    }
  }

  if (accounts && arr) return `${accounts} / ${arr}`;
  return accounts || arr || "";
}

const TOOLS = [
  "Gainsight", "Totango", "ChurnZero", "Catalyst", "Vitally", "Planhat",
  "Custify", "ClientSuccess", "Salesforce", "HubSpot", "Zendesk", "Intercom",
  "Front", "Freshdesk", "Jira", "Linear", "Asana", "Notion", "Confluence",
  "Looker", "Tableau", "Sigma", "Snowflake", "Amplitude", "Mixpanel",
  "Pendo", "WalkMe", "Gong", "Chorus", "Clari", "Outreach", "Salesloft",
  "Rocketlane", "Ironclad", "Zoominfo", "Segment", "dbt", "Metabase",
];

/* Tool names that are also ordinary English. "Front", "Linear" and "Segment"
   turn up in sentences that have nothing to do with tooling, so they need a
   nearby cue before we'll believe them. */
const AMBIGUOUS = new Set(["Front", "Linear", "Sigma", "Segment", "Amplitude", "Notion"]);
const TOOL_CUE =
  /\b(experience (with|in|using)|familiar(ity)? with|proficien\w+ (in|with)|hands-on with|working knowledge of|tools?|tech stack|stack|platforms?|software|systems?|using|such as|e\.g\.|CRM|we use|our stack)\b/i;

/**
 * Tools the posting actually names. Returns [] when the text doesn't mention
 * any — the board never guesses a stack from the company or the job family.
 */
export function parseStack(text, companyName = "") {
  if (!text) return [];
  const t = String(text);
  const company = String(companyName).toLowerCase().trim();
  const found = [];

  for (const tool of TOOLS) {
    // Never tag a company with its own product (a CSM job at Gainsight).
    if (company && tool.toLowerCase() === company) continue;

    const re = new RegExp(`(^|[^a-zA-Z])(${tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})([^a-zA-Z]|$)`, "g");
    let m;
    while ((m = re.exec(t)) !== null) {
      const exact = m[2] === tool; // case-sensitive: "Front" not "in front of"
      if (!exact) continue;
      if (AMBIGUOUS.has(tool)) {
        const win = t.slice(Math.max(0, m.index - 110), m.index + 110);
        if (!TOOL_CUE.test(win)) continue;
      }
      found.push(tool);
      break;
    }
  }

  if (/\bSQL\b/.test(t)) found.push("SQL");
  if (/\bPython\b/.test(t)) found.push("Python");
  return [...new Set(found)].slice(0, 6);
}

/* --- location & work mode ------------------------------------------------ */

const US_STATES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

export function cleanLocation(raw, isRemoteFlag) {
  let s = htmlToText(raw || "").replace(/\s*\|\s*/g, ", ").trim();
  if (!s) return isRemoteFlag ? "Remote — US" : "Location not listed";

  const remote = /\bremote\b|\bwork from home\b|\bwfh\b|\bdistributed\b|\banywhere\b/i.test(s) || isRemoteFlag;
  s = s.replace(/\b(remote|hybrid|on-?site|in-?office)\b[\s,\-–—]*/gi, "").trim();
  s = s.replace(/^[,\s\-–—]+|[,\s\-–—]+$/g, "");

  // Trim long multi-city strings to the first two.
  const parts = s.split(/\s*(?:;|,(?=\s*[A-Z][a-z]))\s*/).filter(Boolean);
  if (parts.length > 3) s = parts.slice(0, 2).join(", ") + " + more";

  for (const [name, abbr] of Object.entries(US_STATES)) {
    const re = new RegExp(`,\\s*${name}\\b`, "i");
    if (re.test(s)) s = s.replace(re, ", " + abbr);
  }
  s = s.replace(/,?\s*(United States|USA|US)\b/i, "").replace(/[,\s]+$/, "");

  if (!s) return remote ? "Remote — US" : "Location not listed";
  return remote ? `Remote — ${s}` : s;
}

export function workMode(locationRaw, text, remoteFlag) {
  const hay = `${locationRaw || ""} ${String(text || "").slice(0, 2500)}`;
  if (/\bhybrid\b/i.test(hay)) return "Hybrid";
  if (remoteFlag || /\b(fully remote|100% remote|remote-first|remote,|remote\b)/i.test(locationRaw || "")) return "Remote";
  if (/\b(on-?site|in-?office|in person|onsite)\b/i.test(hay)) return "Onsite";
  if (/\bremote\b/i.test(hay)) return "Remote";
  return "Onsite";
}

/* --- misc ---------------------------------------------------------------- */

export function daysSince(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export function titleCase(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
