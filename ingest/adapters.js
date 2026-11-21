/* ============================================================================
   adapters.js — one function per ATS
   ----------------------------------------------------------------------------
   Every adapter takes a company record and returns RAW postings in a single
   common shape. Classification, salary parsing and dedupe all happen
   downstream, so adapters stay dumb and easy to fix when a vendor changes
   their JSON.

   Common raw shape:
     { externalId, title, department, locationRaw, country, workplace,
       remoteFlag, html, plain, postedAt, applyUrl, postingUrl, pay,
       companyName }

   Built for ~20,000 boards a night:
     - A dead board (404) costs ONE request. Only network errors, 5xx and
       429 are retried, and 429 honours the server's Retry-After.
     - Each vendor gets its own small concurrency limit, so no single ATS
       sees more than a handful of simultaneous requests from us.
     - Greenhouse and SmartRecruiters are fetched title-first: the job list
       is small, and full descriptions are pulled only for titles that could
       possibly end up on the board. A company with 300 engineering roles
       costs one light request instead of one heavy one.
   ========================================================================== */

const UA = "RenewalJobBoard/1.0 (contact: supportrenewalcs@gmail.com)";

/* Overridable so the pipeline can be tested against a local fixture server.
   Leave unset in normal use — these defaults are the real public endpoints. */
const BASE = {
  greenhouse:      process.env.ATS_BASE_GREENHOUSE      || "https://boards-api.greenhouse.io",
  lever:           process.env.ATS_BASE_LEVER           || "https://api.lever.co",
  ashby:           process.env.ATS_BASE_ASHBY           || "https://api.ashbyhq.com",
  workable:        process.env.ATS_BASE_WORKABLE        || "https://apply.workable.com",
  smartrecruiters: process.env.ATS_BASE_SMARTRECRUITERS || "https://api.smartrecruiters.com",
  recruitee:       process.env.ATS_BASE_RECRUITEE       || null, // per-company subdomain
  bamboohr:        process.env.ATS_BASE_BAMBOOHR        || null, // per-company subdomain
  breezy:          process.env.ATS_BASE_BREEZY          || null, // per-company subdomain
};

/* --- polite HTTP --------------------------------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(status, url) { super(`HTTP ${status}`); this.status = status; this.url = url; }
}

function semaphore(max) {
  let active = 0;
  const queue = [];
  return async (fn) => {
    if (active >= max) await new Promise((r) => queue.push(r));
    active++;
    try { return await fn(); }
    finally { active--; const next = queue.shift(); if (next) next(); }
  };
}

// Simultaneous requests allowed per vendor. Small on purpose.
const LIMIT = {
  greenhouse: semaphore(6),
  lever: semaphore(4),
  ashby: semaphore(4),
  workable: semaphore(4),
  smartrecruiters: semaphore(4),
  recruitee: semaphore(4),
  bamboohr: semaphore(4),
  breezy: semaphore(4),
};

export const stats = { requests: 0, retries: 0 };

async function getJson(url, ats, { timeout = 20000 } = {}) {
  return LIMIT[ats](async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        stats.requests++;
        const res = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: ctrl.signal,
        });
        if (res.status === 429 || res.status >= 500) {
          if (attempt < 2) {
            stats.retries++;
            const wait = Number(res.headers.get("retry-after")) || 2 * (attempt + 1);
            await sleep(Math.min(wait, 30) * 1000);
            continue;
          }
          throw new HttpError(res.status, url);
        }
        // 404 / 410 / 403: the board is gone or private. Retrying won't help.
        if (!res.ok) throw new HttpError(res.status, url);
        const body = await res.json();
        await sleep(80); // a little space between requests on the same slot
        return body;
      } catch (e) {
        if (e instanceof HttpError) throw e;
        if (attempt < 2) { stats.retries++; await sleep(800 * (attempt + 1)); continue; }
        throw e;
      } finally {
        clearTimeout(timer);
      }
    }
  });
}

/* Run a small batch of detail fetches for one board, in parallel. */
async function mapLimited(items, n, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch { out[idx] = null; }
    }
  });
  await Promise.all(workers);
  return out.filter(Boolean);
}

const acceptAll = () => true;

/* --- Greenhouse ---------------------------------------------------------- *
   List:   /v1/boards/{token}/jobs                  (titles only, small)
   Detail: /v1/boards/{token}/jobs/{id}?pay_transparency=true
   `content` is HTML-entity-escaped, sometimes twice. No structured country,
   so geography comes from the location text downstream.                    */

export async function greenhouse(company, { wants = acceptAll } = {}) {
  const base = `${BASE.greenhouse}/v1/boards/${company.token}/jobs`;
  const list = await getJson(base, "greenhouse");
  const hits = (list?.jobs || []).filter((j) => wants(j.title || "", j.location?.name || ""));

  const detailed = await mapLimited(hits, 3, async (j) => {
    const d = await getJson(`${base}/${j.id}?pay_transparency=true`, "greenhouse");
    return { ...j, ...d };
  });

  return detailed.map((j) => ({
    externalId: String(j.id),
    title: j.title || "",
    department: (j.departments || []).map((d) => d.name).join(", "),
    locationRaw: j.location?.name || (j.offices || []).map((o) => o.name).join(", "),
    country: null,
    workplace: null,
    remoteFlag: /remote/i.test(j.location?.name || ""),
    html: j.content || "",
    plain: "",
    postedAt: j.first_published || j.updated_at || null,
    // absolute_url IS the posting page and carries the apply form.
    applyUrl: j.absolute_url,
    postingUrl: j.absolute_url,
    pay: payFromGreenhouse(j),
    companyName: j.company_name || null,
  }));
}

function payFromGreenhouse(j) {
  const r = (j.pay_input_ranges || [])[0];
  if (r && (r.min_cents || r.max_cents)) {
    return {
      min: r.min_cents ? r.min_cents / 100 : null,
      max: r.max_cents ? r.max_cents / 100 : null,
      currency: r.currency_type || "USD",
      interval: "year",
    };
  }
  return null;
}

/* --- Lever --------------------------------------------------------------- *
   /v0/postings/{company}?mode=json — everything in one response. Structured
   salaryRange on many accounts, and `lists` is the cleanest source of
   responsibilities/requirements of any ATS.                                 */

const WORKPLACE = (v) => {
  const s = String(v || "").toLowerCase();
  if (/hybrid/.test(s)) return "Hybrid";
  if (/remote/.test(s)) return "Remote";
  if (/on-?site|office/.test(s)) return "Onsite";
  return null;
};

export async function lever(company) {
  const data = await getJson(`${BASE.lever}/v0/postings/${company.token}?mode=json`, "lever");
  const jobs = Array.isArray(data) ? data : [];
  return jobs.map((j) => {
    const listsHtml = (j.lists || []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`).join("");
    const workplace = WORKPLACE(j.workplaceType);
    return {
      externalId: String(j.id),
      title: j.text || "",
      department: j.categories?.department || j.categories?.team || "",
      locationRaw: j.categories?.location || (j.categories?.allLocations || []).join(", "),
      country: j.country || null,
      workplace,
      remoteFlag: workplace === "Remote" || (!workplace && /remote/i.test(j.categories?.location || "")),
      html: `${j.description || ""}${listsHtml}${j.additional || ""}`,
      plain: `${j.descriptionPlain || ""}\n${j.additionalPlain || ""}`,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      applyUrl: j.applyUrl || (j.hostedUrl ? j.hostedUrl.replace(/\/$/, "") + "/apply" : null),
      postingUrl: j.hostedUrl || j.applyUrl,
      pay: j.salaryRange
        ? { min: j.salaryRange.min, max: j.salaryRange.max, currency: j.salaryRange.currency || "USD", interval: j.salaryRange.interval || "year" }
        : null,
      companyName: null,
    };
  });
}

/* --- Ashby --------------------------------------------------------------- *
   /posting-api/job-board/{name}?includeCompensation=true
   Best structured compensation of any ATS. Note: `isRemote` is reported true
   for hybrid roles too, so the explicit `workplaceType` wins when present.  */

export async function ashby(company) {
  const data = await getJson(`${BASE.ashby}/posting-api/job-board/${company.token}?includeCompensation=true`, "ashby");
  return (data?.jobs || [])
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const workplace = WORKPLACE(j.workplaceType) || (j.isRemote ? "Remote" : null);
      return {
        externalId: String(j.id),
        title: j.title || "",
        department: j.department || j.team || "",
        locationRaw: j.location || "",
        country: j.address?.postalAddress?.addressCountry || null,
        workplace,
        remoteFlag: workplace === "Remote",
        html: j.descriptionHtml || "",
        plain: j.descriptionPlain || "",
        postedAt: j.publishedAt || j.updatedAt || null,
        applyUrl: j.applyUrl || j.jobUrl,
        postingUrl: j.jobUrl || j.applyUrl,
        pay: payFromAshby(j),
        companyName: null,
      };
    });
}

function payFromAshby(j) {
  const comps = j.compensation?.summaryComponents || [];
  const salary = comps.find((c) => /salary/i.test(c.compensationType || ""));
  if (salary && (salary.minValue != null || salary.maxValue != null)) {
    return { min: salary.minValue, max: salary.maxValue, currency: salary.currencyCode || "USD", interval: salary.interval || "1 YEAR" };
  }
  const summary = j.compensation?.compensationTierSummary;
  return summary ? { summaryText: summary } : null;
}

/* --- Workable ------------------------------------------------------------ *
   /api/v1/widget/accounts/{token}?details=true
   Workable is especially popular with European companies, so the structured
   `country` matters here: city names alone let foreign roles through.       */

export async function workable(company) {
  const data = await getJson(`${BASE.workable}/api/v1/widget/accounts/${company.token}?details=true`, "workable");
  return (data?.jobs || []).map((j) => {
    const workplace = WORKPLACE(j.workplace) || (j.telecommuting ? "Remote" : null);
    return {
      externalId: String(j.shortcode || j.id),
      title: j.title || "",
      department: j.department || "",
      locationRaw: [j.city, j.state].filter(Boolean).join(", ") || j.country || "",
      country: j.country || j.country_code || null,
      workplace,
      remoteFlag: workplace === "Remote",
      html: [
        j.description ? `<h3>What you'll do</h3>${j.description}` : "",
        j.requirements ? `<h3>Requirements</h3>${j.requirements}` : "",
        j.benefits || "",
      ].join(""),
      plain: "",
      postedAt: j.published_on || j.created_at || null,
      applyUrl: j.application_url || j.url || j.shortlink,
      postingUrl: j.url || j.shortlink || j.application_url,
      pay: null,
      companyName: data?.name || null,
    };
  });
}

/* --- SmartRecruiters ----------------------------------------------------- *
   List:   /v1/companies/{id}/postings?limit=100&offset=N   (titles, small)
   Detail: /v1/companies/{id}/postings/{postingId}           (description)
   Enterprise-heavy (Visa, Bosch). A company that isn't a customer returns
   200 with nothing in it rather than a 404, so "empty" and "not here" look
   the same — both simply contribute no jobs.                                */

const SR_MAX_PAGES = 20;

export async function smartrecruiters(company, { wants = acceptAll } = {}) {
  const base = `${BASE.smartrecruiters}/v1/companies/${company.token}/postings`;
  const listed = [];
  for (let page = 0; page < SR_MAX_PAGES; page++) {
    const data = await getJson(`${base}?limit=100&offset=${page * 100}`, "smartrecruiters");
    const content = data?.content || [];
    listed.push(...content);
    if (content.length < 100 || listed.length >= (data?.totalFound ?? 0)) break;
  }

  const hits = listed.filter((p) => {
    const loc = [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(", ");
    return wants(p.name || "", loc);
  });

  const detailed = await mapLimited(hits, 3, async (p) => {
    const d = await getJson(`${base}/${p.id}`, "smartrecruiters");
    return { ...p, ...d };
  });

  return detailed.map((p) => {
    const s = p.jobAd?.sections || {};
    const html = [s.jobDescription, s.qualifications, s.additionalInformation]
      .filter((x) => x && x.text)
      .map((x) => `<h3>${x.title || ""}</h3>${x.text}`)
      .join("");
    const loc = p.location || {};
    const workplace = loc.hybrid ? "Hybrid" : loc.remote ? "Remote" : null;
    const identifier = p.company?.identifier || company.token;
    const postingUrl = p.postingUrl || `https://jobs.smartrecruiters.com/${identifier}/${p.id}`;
    return {
      externalId: String(p.id),
      title: p.name || "",
      department: p.department?.label || p.function?.label || "",
      locationRaw: loc.fullLocation || [loc.city, loc.region].filter(Boolean).join(", "),
      country: loc.country || null,
      workplace,
      remoteFlag: workplace === "Remote",
      html,
      plain: "",
      postedAt: p.releasedDate || null,
      applyUrl: p.applyUrl || postingUrl,
      postingUrl,
      pay: null,
      companyName: p.company?.name || null,
    };
  });
}

/* --- Recruitee ----------------------------------------------------------- *
   https://{company}.recruitee.com/api/offers/ — everything in one response,
   with separate description and requirements HTML.                          */

export async function recruitee(company) {
  const origin = BASE.recruitee || `https://${company.token}.recruitee.com`;
  const data = await getJson(`${origin}/api/offers/`, "recruitee");
  return (data?.offers || [])
    .filter((o) => !o.status || o.status === "published")
    .map((o) => {
      const workplace = o.hybrid ? "Hybrid" : o.remote ? "Remote" : o.on_site ? "Onsite" : null;
      const sal = o.salary || {};
      return {
        externalId: String(o.id),
        title: o.title || "",
        department: o.department || "",
        locationRaw: o.location || [o.city, o.state_code || o.state_name].filter(Boolean).join(", "),
        country: o.country_code || o.country || null,
        workplace,
        remoteFlag: workplace === "Remote",
        html: [
          o.description ? `<h3>About the role</h3>${o.description}` : "",
          o.requirements ? `<h3>Requirements</h3>${o.requirements}` : "",
        ].join(""),
        plain: "",
        postedAt: o.published_at || o.created_at || null,
        applyUrl: o.careers_apply_url || o.careers_url,
        postingUrl: o.careers_url || o.careers_apply_url,
        pay: sal.min || sal.max
          ? { min: sal.min, max: sal.max, currency: sal.currency || "USD", interval: sal.period || "year" }
          : null,
        companyName: o.company_name || null,
      };
    });
}


/* --- BambooHR ------------------------------------------------------------ *
   List:   https://{company}.bamboohr.com/careers/list
   Detail: https://{company}.bamboohr.com/careers/{id}/detail

   The widest SMB coverage of any ATS here — the small and mid-size companies
   the big aggregators miss. One caveat worth knowing: unlike Greenhouse or
   SmartRecruiters, this is not a documented public API. It's the internal
   JSON that BambooHR's own public careers widget reads, and its field names
   can change without notice. Hence the defensive field lookups below: if
   BambooHR renames something, this adapter returns fewer fields rather than
   crashing, and `npm run verify` will show the boards going quiet.          */

const first = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== "") ?? null;

export async function bamboohr(company, { wants = acceptAll } = {}) {
  const origin = BASE.bamboohr || `https://${company.token}.bamboohr.com`;
  const data = await getJson(`${origin}/careers/list`, "bamboohr");
  const listed = data?.result || data?.jobs || (Array.isArray(data) ? data : []);

  const hits = listed.filter((j) => {
    const loc = j.location || j.atsLocation || {};
    const locText = [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
    return wants(first(j.jobOpeningName, j.title, j.name) || "", locText);
  });

  const detailed = await mapLimited(hits, 3, async (j) => {
    const id = first(j.id, j.jobOpeningId, j.jobOpeningShareUrlId);
    const d = await getJson(`${origin}/careers/${id}/detail`, "bamboohr");
    const opening = d?.result?.jobOpening || d?.result || d?.jobOpening || d || {};
    return { ...j, _id: id, _detail: opening };
  });

  return detailed.map((j) => {
    const d = j._detail || {};
    const loc = j.location || j.atsLocation || d.location || {};
    const remote = !!(j.isRemote ?? d.isRemote ?? /remote/i.test(String(first(j.locationType, d.locationType, "")) || ""));
    const compensation = first(d.compensation, d.compensationText, "");
    return {
      externalId: String(j._id),
      title: first(j.jobOpeningName, j.title, j.name, d.jobOpeningName) || "",
      department: first(j.departmentLabel, j.department?.label, j.department, d.departmentLabel) || "",
      locationRaw: [loc.city, loc.state].filter(Boolean).join(", ") || first(loc.name, loc.country, "") || "",
      country: first(loc.country, loc.countryName, null),
      workplace: remote ? "Remote" : null,
      remoteFlag: remote,
      // Compensation is a free-text field; append it so the salary parser
      // sees it, and let the parser reject anything that isn't a real range.
      html: `${first(d.description, d.jobDescription, "") || ""}${compensation ? `<p>${compensation}</p>` : ""}`,
      plain: "",
      postedAt: first(d.datePosted, d.postedDate, j.datePosted, null),
      applyUrl: `${origin}/careers/${j._id}`,
      postingUrl: `${origin}/careers/${j._id}`,
      pay: null,
      companyName: first(data?.companyName, data?.name, null),
    };
  });
}

/* --- Breezy -------------------------------------------------------------- *
   https://{company}.breezy.hr/json — everything in one response.            */

export async function breezy(company) {
  const origin = BASE.breezy || `https://${company.token}.breezy.hr`;
  const data = await getJson(`${origin}/json`, "breezy");
  const positions = Array.isArray(data) ? data : data?.positions || data?.jobs || [];
  return positions.map((p) => {
    const loc = p.location || {};
    const countryName = first(loc.country?.name, loc.country, null);
    const remote = !!(loc.is_remote ?? p.is_remote ?? /remote/i.test(String(first(loc.name, "") || "")));
    const id = first(p.id, p._id, p.friendly_id);
    return {
      externalId: String(id),
      title: first(p.name, p.title) || "",
      department: first(p.department, p.category?.name, p.category) || "",
      locationRaw: [loc.city, loc.state?.name || loc.state].filter(Boolean).join(", ") || first(loc.name, "") || "",
      country: countryName,
      workplace: remote ? "Remote" : null,
      remoteFlag: remote,
      html: first(p.description, p.body, "") || "",
      plain: "",
      postedAt: first(p.published_date, p.creation_date, p.updated_date, null),
      applyUrl: first(p.url, `${origin}/p/${id}`),
      postingUrl: first(p.url, `${origin}/p/${id}`),
      pay: null,
      companyName: first(data?.company?.name, null),
    };
  });
}

/* --- registry ------------------------------------------------------------ */

export const ADAPTERS = { greenhouse, lever, ashby, workable, smartrecruiters, recruitee, bamboohr, breezy };

export const SOURCE_LABEL = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  smartrecruiters: "SmartRecruiters",
  recruitee: "Recruitee",
  bamboohr: "BambooHR",
  breezy: "Breezy",
};
