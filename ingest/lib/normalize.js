/* ============================================================================
   normalize.js — raw ATS posting → board listing
   ----------------------------------------------------------------------------
   One job in, one listing out (or null, with a reason). Every drop is counted
   so build.js can tell you WHY your board is smaller than you expected.
   ========================================================================== */

import {
  htmlToText, extractDetail, extractBlurb, parseSalaryFromText,
  normalizeStructuredPay, parseVariable, parseBook, parseStack,
  cleanLocation, workMode, daysSince, titleCase,
} from "./parse.js";
import { classify, segment, seniority } from "./classify.js";
import { SOURCE_LABEL } from "../adapters.js";

export const DROP = {
  NOT_CS: "not a CS role",
  NO_SALARY: "no published salary",
  TOO_OLD: "older than max age",
  NO_URL: "no apply link",
  SHALLOW_URL: "apply link was a homepage",
  LIST_URL: "apply link was a jobs list, not this role",
  BAD_GEO: "outside covered geography",
};

/* An Apply button has exactly one job: land the person on THIS role's posting.
   A homepage is useless. A board root ("all our openings") is almost as bad —
   they have to find the job again, and by then half of them are gone.

   For the four ATSes we know the URL grammar, so we can check it exactly.  */
const ATS_POSTING_SHAPE = [
  // boards.greenhouse.io/acme/jobs/4567890   (job-boards.greenhouse.io too)
  { host: /greenhouse\.io$/i, path: /^\/[^/]+\/jobs\/\d+/i },
  // jobs.lever.co/acme/2f8c…-uuid  (optionally /apply)
  { host: /lever\.co$/i, path: /^\/[^/]+\/[0-9a-f]{8}-[0-9a-f-]{4,}/i },
  // jobs.ashbyhq.com/acme/uuid  (optionally /application)
  { host: /ashbyhq\.com$/i, path: /^\/[^/]+\/[0-9a-f]{8}-[0-9a-f-]{4,}/i },
  // apply.workable.com/acme/j/ABC123/
  { host: /workable\.com$/i, path: /^\/[^/]+\/j\/[A-Za-z0-9]+/i },
  { host: /smartrecruiters\.com$/i, path: /^\/[^/]+\/\d+/i },
  { host: /recruitee\.com$/i, path: /^\/o\/[^/]+/i },
];

/* Single-segment paths that are obviously a jobs index on a company site. */
const LIST_PAGE = /^\/(careers?|jobs?|openings?|positions?|vacancies|opportunities|work-with-us|join-us|hiring|about\/careers)\/?$/i;

/**
 * Classify an apply link.
 * @returns "posting" | "list" | "homepage" | "invalid"
 */
export function applyLinkQuality(url) {
  let u;
  try { u = new URL(url); } catch { return "invalid"; }
  if (!/^https?:$/.test(u.protocol)) return "invalid";

  const path = u.pathname.replace(/\/+$/, "");
  const hasQuery = u.search.length > 1;

  if (!path && !hasQuery) return "homepage";

  // Known ATS: we know exactly what a posting URL looks like there.
  const ats = ATS_POSTING_SHAPE.find((a) => a.host.test(u.host));
  if (ats) return ats.path.test(u.pathname) ? "posting" : "list";

  // Company-hosted careers page. A job-id query param is a reliable signal
  // (gh_jid, lever-id, jobId are all common on embedded boards).
  if (/(gh_jid|jobid|job_id|lever|ashby|req|requisition|posting)/i.test(u.search)) return "posting";
  if (LIST_PAGE.test(u.pathname)) return "list";

  // Otherwise require more than one path segment: /careers/senior-csm is a
  // posting, /careers is not.
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2) return "posting";
  return hasQuery ? "posting" : "list";
}

export function isDeepLink(url) {
  return applyLinkQuality(url) === "posting";
}

/* Posting URLs usually live on the ATS, not the employer. Deriving a
   "Company site" link from them would send people to Greenhouse's homepage. */
const ATS_HOSTS = /(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|recruitee\.com|bamboohr\.com|jazzhr\.com|breezy\.hr|teamtailor\.com|myworkday|icims\.com|taleo\.net)$/i;

export function homepageOf(url) {
  try {
    const u = new URL(url);
    if (ATS_HOSTS.test(u.host)) return null;   // not the employer's site
    return `${u.protocol}//${u.host}`;
  } catch { return null; }
}

/* Geography is a BLOCKLIST, not an allowlist.
   ATS feeds are wildly inconsistent — "San Francisco", "SF Bay Area", "NYC",
   "Remote (US)" and "Austin" all mean a US job. An allowlist of states drops
   every bare city name, which quietly deletes most of the board. So instead:
   keep everything unless it clearly names somewhere we don't cover. A false
   include is a minor annoyance; a false exclude is a job the user never sees. */
const GEO_BLOCK = new RegExp(
  "\\b(" + [
    // countries / regions
    "United Kingdom", "UK", "England", "Scotland", "Ireland", "Germany",
    "France", "Spain", "Portugal", "Italy", "Netherlands", "Belgium",
    "Sweden", "Norway", "Denmark", "Finland", "Poland", "Romania", "Ukraine",
    "Switzerland", "Austria", "Czech", "Greece", "Turkey", "Israel",
    "India", "China", "Japan", "Singapore", "Australia", "New Zealand",
    "Brazil", "Mexico", "Argentina", "Colombia", "Chile", "Philippines",
    "Indonesia", "Vietnam", "Thailand", "Malaysia", "South Africa", "Nigeria",
    "Kenya", "Egypt", "UAE", "Dubai", "Saudi", "Korea", "Taiwan", "Hong Kong",
    "EMEA", "APAC", "LATAM", "LATM", "EU only", "Europe",
    // cities that are unambiguous
    "London", "Manchester", "Dublin", "Berlin", "Munich", "Hamburg", "Paris",
    "Madrid", "Barcelona", "Lisbon", "Milan", "Rome", "Amsterdam", "Brussels",
    "Stockholm", "Oslo", "Copenhagen", "Helsinki", "Warsaw", "Krakow",
    "Prague", "Zurich", "Vienna", "Athens", "Istanbul", "Tel Aviv",
    "Bangalore", "Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Pune",
    "Chennai", "Beijing", "Shanghai", "Shenzhen", "Tokyo", "Osaka", "Seoul",
    "Sydney", "Melbourne", "Brisbane", "Auckland", "Wellington",
    "Sao Paulo", "São Paulo", "Rio de Janeiro", "Bogota", "Buenos Aires",
    "Mexico City", "Guadalajara", "Manila", "Jakarta", "Bangkok",
    "Kuala Lumpur", "Cape Town", "Johannesburg", "Lagos", "Nairobi", "Cairo",
  ].join("|") + ")\\b", "i"
);

/* Explicit US/Canada markers override a block — "Remote (US or UK)" stays. */
const GEO_RESCUE = /\b(US|U\.S\.|USA|United States|Canada|Remote\s*[-—–(]?\s*US)\b/i;

/**
 * @param {object} raw      one posting from an adapter
 * @param {object} company  the registry entry it came from
 * @param {object} opts     { maxAgeDays, requireSalary, geoFilter }
 * @returns {{ job?: object, drop?: string }}
 */
export function normalize(raw, company, opts = {}) {
  const {
    maxAgeDays = 45,
    requireSalary = false,   // salary is shown when present, not a gate
    geoFilter = true,
  } = opts;

  const title = titleCase(raw.title);
  const text = raw.plain && raw.plain.length > 200 ? raw.plain : htmlToText(raw.html);

  /* 1. is this even a CS job */
  const verdict = classify({ title, department: raw.department, text });
  if (!verdict.keep) return { drop: DROP.NOT_CS };

  /* 2. links — apply must be a real deep link, not a homepage */
  const applyUrl = raw.applyUrl || raw.url || null;
  if (!applyUrl || !/^https?:\/\//i.test(applyUrl)) return { drop: DROP.NO_URL };
  const quality = applyLinkQuality(applyUrl);
  if (quality === "invalid") return { drop: DROP.NO_URL };
  if (quality === "homepage") return { drop: DROP.SHALLOW_URL };
  if (quality === "list") return { drop: DROP.LIST_URL };
  const postingUrl = raw.postingUrl && isDeepLink(raw.postingUrl) ? raw.postingUrl : applyUrl;

  /* 3. freshness */
  const posted = daysSince(raw.postedAt);
  if (posted > maxAgeDays) return { drop: DROP.TOO_OLD };

  /* 4. geography — location is always shown, even when it's just a city */
  const location = cleanLocation(raw.locationRaw, raw.remoteFlag);
  if (geoFilter && GEO_BLOCK.test(raw.locationRaw || location) && !GEO_RESCUE.test(raw.locationRaw || "")) {
    return { drop: DROP.BAD_GEO };
  }

  /* 5. salary — structured first, text second, null if the posting is silent.
        Nothing is ever estimated: the UI shows "See job listing" instead. */
  let pay = null;
  if (raw.pay) {
    pay = raw.pay.summaryText ? parseSalaryFromText(raw.pay.summaryText) : normalizeStructuredPay(raw.pay);
  }
  if (!pay) pay = parseSalaryFromText(text);
  if (!pay && requireSalary) return { drop: DROP.NO_SALARY };

  /* 6. everything else is opt-in: absent unless the posting actually says it */
  const detail = extractDetail(raw.html);
  const book = parseBook(text);           // "" when not tied to the role
  const seg = segment(title, text);       // null when not stated
  const stack = parseStack(text, company.name);  // [] when no tools named

  const job = {
    id: `${company.ats}:${company.token}:${raw.externalId}`,
    title,
    company: company.name,
    companySite: company.site || homepageOf(postingUrl),
    industry: company.industry || "",
    family: verdict.family,
    seniority: seniority(title),
    segment: seg,                                  // may be null
    location,                                      // always present
    mode: workMode(raw.locationRaw, text, raw.remoteFlag),
    min: pay ? pay.min : null,                     // may be null
    max: pay ? pay.max : null,
    variable: pay ? parseVariable(text) : "",      // no variable without a base
    book,                                          // may be ""
    stack,                                         // may be []
    posted,
    postedAt: raw.postedAt || new Date().toISOString(),
    source: SOURCE_LABEL[company.ats] || company.ats,
    featured: false,
    applyUrl,
    postingUrl,
    blurb: extractBlurb(raw.html) || `${title} at ${company.name}.`,
    summary: detail.summary || extractBlurb(raw.html, 600) || "",
    sections: detail.sections,
  };

  return { job };
}

/* --- dedupe -------------------------------------------------------------- *
   Companies repost, and some run two ATSes during a migration. Key on
   company + normalised title + location, keep the freshest.                */

const noise = /\b(senior|sr|junior|jr|staff|principal|lead|i{1,3}|iv|v|\d+)\b/gi;

function key(job) {
  const t = job.title.toLowerCase().replace(noise, "").replace(/[^a-z]/g, "");
  const c = job.company.toLowerCase().replace(/[^a-z]/g, "");
  const l = job.location.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12);
  return `${c}|${t}|${l}`;
}

export function dedupe(jobs) {
  const map = new Map();
  for (const j of jobs) {
    const k = key(j);
    const prev = map.get(k);
    if (!prev || j.posted < prev.posted) map.set(k, j);
  }
  return [...map.values()];
}
