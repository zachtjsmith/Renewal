/* ============================================================================
   dedupe.js — one job, one listing
   ----------------------------------------------------------------------------
   What counts as a duplicate, strongest signal first:

     1. Same apply URL.                     Definitely the same posting, even
                                            if the company name or title was
                                            spelled differently by two sources.
     2. Same company + title + location,    A repost, or a company mid-way
        and a broadly similar description.  through switching ATS. The
                                            description check matters: a company
                                            hiring two "BDR, Remote — US" roles
                                            on different teams has two jobs.
     3. Same company + title, near-identical The same role advertised in several
        description, different locations.  cities. Merged into ONE listing
                                            with a location list, each location
                                            keeping its own apply link.

   What is deliberately NOT a duplicate:

     - "Senior Customer Success Manager" vs "Customer Success Manager" at the
       same company. Different level, different pay, different job. The old
       dedupe stripped "Senior" before comparing and hid real openings.
     - Same title, same company, genuinely different descriptions — e.g. an
       Enterprise CSM in New York and an SMB CSM in Austin both titled "CSM".
       Two jobs; both stay.
   ========================================================================== */

/* --- normalisers --------------------------------------------------------- */

const LEGAL_SUFFIX = /\b(incorporated|inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|gmbh|plc|pty|sa|ag|bv|oy|ab)\b\.?/g;

export function companyKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/^the\s+/, "")
    .replace(LEGAL_SUFFIX, "")
    .replace(/[^a-z0-9]/g, "");
}

// Words that, when they appear as a trailing title segment, describe WHERE the
// job is rather than WHAT it is. "CSM - Remote (US)" and "CSM - New York" are
// the same role; "CSM - Enterprise" is not the same as "CSM - SMB".
const PLACE_WORDS = new Set([
  "remote", "hybrid", "onsite", "on-site", "in-office", "office", "anywhere", "wfh",
  "us", "usa", "u.s.", "united states", "canada", "uk", "emea", "apac", "latam",
  "americas", "north america", "na", "east", "west", "central", "eastern", "western",
  "pst", "est", "cst", "mst", "et", "pt", "ct", "mt", "time zone", "timezone",
  "new york", "nyc", "san francisco", "sf", "bay area", "los angeles", "la",
  "chicago", "boston", "austin", "seattle", "denver", "atlanta", "dallas",
  "houston", "miami", "phoenix", "portland", "salt lake city", "nashville",
  "raleigh", "charlotte", "philadelphia", "washington", "dc", "washington dc",
  "minneapolis", "detroit", "pittsburgh", "san diego", "san jose", "toronto",
  "vancouver", "montreal", "remote us", "remote usa", "remote canada",
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho", "illinois",
  "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland",
  "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana",
  "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
  "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania",
  "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah",
  "vermont", "virginia", "west virginia", "wisconsin", "wyoming",
  "ny", "ca", "tx", "fl", "il", "ma", "wa", "co", "ga", "nc", "va", "az", "or",
  "nj", "pa", "oh", "mi", "mn", "tn", "ut", "md", "on", "bc", "qc",
]);

const isPlaceSegment = (seg) => {
  const s = seg.toLowerCase().replace(/[^a-z .-]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return true;
  if (PLACE_WORDS.has(s)) return true;
  // "remote - us", "hybrid (nyc)", "new york, ny"
  const words = s.split(/[\s,/-]+/).filter(Boolean);
  if (/\b(remote|hybrid|on-?site)\b/.test(s)) return true;
  return words.length > 0 && words.length <= 4 && words.every((w) => PLACE_WORDS.has(w) || /^[a-z]{2}$/.test(w));
};

const ABBREV = [
  [/\bsr\.?(?=\s|$)/g, "senior"], [/\bjr\.?(?=\s|$)/g, "junior"],
  [/\bmgr\b|\bmngr\b/g, "manager"], [/\bassoc\b/g, "associate"],
  [/\bexec\b/g, "executive"], [/\brep\b/g, "representative"],
  [/\bcsm\b/g, "customer success manager"], [/\btam\b/g, "technical account manager"],
  [/\bbdr\b/g, "business development representative"],
  [/\bsdr\b/g, "sales development representative"],
  [/\bvp\b/g, "vice president"], [/&/g, " and "],
];

export function titleKey(title) {
  let t = String(title || "").toLowerCase();
  // Split off trailing segments and drop the ones that are just a place.
  const parts = t.split(/\s+[-–—|]\s+|\s*\(|\)\s*|,\s*/).map((p) => p.trim()).filter(Boolean);
  const kept = parts.filter((p, i) => i === 0 || !isPlaceSegment(p));
  t = kept.join(" ");
  for (const [re, rep] of ABBREV) t = t.replace(re, rep);
  return t.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The title as the employer wrote it, minus any trailing place.
 * "Customer Success Manager - New York" → "Customer Success Manager"
 * "Customer Success Manager - Enterprise" is left alone: that's the role.
 * Only applied to merged multi-location listings, where showing one city in
 * the title next to a list of three would be wrong.
 */
export function displayTitle(title) {
  const t = String(title || "").trim();
  const sep = /\s+[-–—|]\s+|\s*\(|,\s*/g;
  let m;
  while ((m = sep.exec(t)) !== null) {
    const head = t.slice(0, m.index).trim();
    const tail = t.slice(m.index + m[0].length).replace(/\)\s*$/, "");
    const parts = tail.split(/\s+[-–—|]\s+|\s*\(|\)\s*|,\s*/).map((x) => x.trim()).filter(Boolean);
    if (head && parts.length && parts.every(isPlaceSegment)) return head;
  }
  return t;
}

export function locationKey(loc) {
  return String(loc || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function urlKey(url) {
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+$/, "").replace(/\/(apply|application)$/i, "").toLowerCase();
    // Keep only the query params that identify a posting.
    const idParam = [...u.searchParams.entries()].find(([k]) => /^(gh_jid|jobid|job_id|id|lever-origin)$/i.test(k));
    return `${u.host.toLowerCase().replace(/^www\./, "")}${path}${idParam ? `?${idParam[0]}=${idParam[1]}` : ""}`;
  } catch {
    return "";
  }
}

/* --- description similarity ---------------------------------------------- */

function descWords(job) {
  const text = [
    job.summary || "",
    ...(job.sections || []).flatMap((s) => [...(s.paras || []), ...(s.bullets || [])]),
  ].join(" ").toLowerCase();
  return new Set(text.replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length > 3));
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;   // two empty descriptions: can't tell them apart
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/* --- union-find ---------------------------------------------------------- */

function makeUF(n) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
  return { find, union };
}

/* --- picking the best record of a cluster -------------------------------- */

const SOURCE_RANK = { Greenhouse: 3, Ashby: 3, Lever: 3, Workable: 2, SmartRecruiters: 2, Recruitee: 2 };

function quality(j) {
  return (j.min != null ? 4 : 0)
    + (j.book ? 1 : 0)
    + Math.min(2, (j.summary || "").length / 400)
    + Math.min(2, (j.sections || []).length * 0.5)
    + (SOURCE_RANK[j.source] || 1) * 0.1
    + (j.featured ? 100 : 0);
}

const MODE_ORDER = { Remote: 0, Hybrid: 1, Onsite: 2 };

/* --- the pass ------------------------------------------------------------ */

/**
 * @param {object[]} jobs  normalised listings
 * @param {object}   opts  similarity: how alike two descriptions must be to
 *                          count as one role advertised in two places (0.8).
 *                          sameLocationSimilarity: the lower bar when the
 *                          location also matches (0.5) — measured to catch
 *                          reformatted reposts without merging different teams.
 * @returns {{ jobs: object[], stats: object }}
 */
export function dedupe(jobs, { similarity = 0.8, sameLocationSimilarity = 0.5 } = {}) {
  const n = jobs.length;
  const uf = makeUF(n);
  const stats = { input: n, sameUrl: 0, sameLocation: 0, multiLocationMerged: 0, output: 0 };

  // 1. Same apply URL, globally.
  const byUrl = new Map();
  jobs.forEach((j, i) => {
    for (const u of [j.applyUrl, j.postingUrl]) {
      const k = urlKey(u);
      if (!k) continue;
      if (byUrl.has(k)) { if (uf.find(byUrl.get(k)) !== uf.find(i)) stats.sameUrl++; uf.union(byUrl.get(k), i); }
      else byUrl.set(k, i);
    }
  });

  // 2 & 3. Within each company + title group.
  const groups = new Map();
  jobs.forEach((j, i) => {
    const k = `${companyKey(j.company)}|${titleKey(j.title)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });

  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    const words = new Map(idxs.map((i) => [i, descWords(jobs[i])]));
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const i = idxs[a], k = idxs[b];
        if (uf.find(i) === uf.find(k)) continue;
        const sim = jaccard(words.get(i), words.get(k));
        const sameLoc = locationKey(jobs[i].location) === locationKey(jobs[k].location);
        if (sameLoc && sim >= sameLocationSimilarity) {
          uf.union(i, k); stats.sameLocation++;
        } else if (!sameLoc && sim >= similarity) {
          uf.union(i, k); stats.multiLocationMerged++;
        }
      }
    }
  }

  // Build one listing per cluster.
  const clusters = new Map();
  jobs.forEach((j, i) => {
    const r = uf.find(i);
    if (!clusters.has(r)) clusters.set(r, []);
    clusters.get(r).push(j);
  });

  const out = [];
  for (const members of clusters.values()) {
    const best = members.reduce((a, b) => (quality(b) > quality(a) ? b : a));
    const listing = { ...best };

    // One entry per distinct location, each with its own apply link.
    const seen = new Map();
    for (const m of members) {
      const lk = locationKey(m.location);
      const prev = seen.get(lk);
      if (!prev || quality(m) > quality(prev)) seen.set(lk, m);
    }
    const variants = [...seen.values()]
      .sort((a, b) => (MODE_ORDER[a.mode] ?? 9) - (MODE_ORDER[b.mode] ?? 9) || a.location.localeCompare(b.location))
      .map((m) => ({ location: m.location, mode: m.mode, applyUrl: m.applyUrl, min: m.min, max: m.max }));

    if (variants.length > 1) {
      listing.title = displayTitle(best.title);
      listing.variants = variants;
      listing.locations = variants.map((v) => v.location);
      listing.modes = [...new Set(variants.map((v) => v.mode))];
      // Pay across every location that published one — never invented.
      const mins = variants.map((v) => v.min).filter((v) => v != null);
      const maxs = variants.map((v) => v.max).filter((v) => v != null);
      if (mins.length) {
        listing.min = Math.min(...mins);
        listing.max = Math.max(...maxs);
        listing.payVaries = new Set(variants.filter((v) => v.min != null).map((v) => `${v.min}-${v.max}`)).size > 1;
      }
    }

    // Most recent posting date in the cluster, and featured if any member is.
    listing.postedAt = members.map((m) => m.postedAt).filter(Boolean).sort().pop() || listing.postedAt;
    listing.featured = members.some((m) => m.featured);
    out.push(listing);
  }

  stats.output = out.length;
  return { jobs: out, stats };
}
