/* ============================================================================
   adapters.js — one function per ATS
   ----------------------------------------------------------------------------
   Every adapter takes a company record and returns an array of RAW postings in
   a single common shape. Normalisation, classification and salary parsing all
   happen downstream in normalize.js, so adapters stay dumb and easy to fix
   when a vendor changes their JSON.

   Common raw shape:
     { externalId, title, department, locationRaw, remoteFlag, html, plain,
       postedAt, url, pay }
   ========================================================================== */

const UA = "RenewalJobBoard/1.0 (+https://renewal.jobs; jobs@renewal.jobs)";

/* Base URLs are overridable so the pipeline can be exercised against a local
   fixture server without touching anybody's production API. Leave unset in
   normal use — these defaults are the real public endpoints. */
const BASE = {
  greenhouse: process.env.ATS_BASE_GREENHOUSE || "https://boards-api.greenhouse.io",
  lever:      process.env.ATS_BASE_LEVER      || "https://api.lever.co",
  ashby:      process.env.ATS_BASE_ASHBY      || "https://api.ashbyhq.com",
  workable:   process.env.ATS_BASE_WORKABLE   || "https://apply.workable.com",
};

async function getJson(url, { timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* --- Greenhouse ---------------------------------------------------------- *
   https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
   Note: `content` is HTML-entity-escaped HTML, sometimes double-escaped.
   No structured salary — it has to be scraped out of the body.              */

export async function greenhouse(company) {
  const url = `${BASE.greenhouse}/v1/boards/${company.token}/jobs?content=true`;
  const data = await getJson(url);
  const jobs = data?.jobs || [];
  return jobs.map((j) => ({
    externalId: String(j.id),
    title: j.title || "",
    department: (j.departments || []).map((d) => d.name).join(", "),
    locationRaw: j.location?.name || (j.offices || []).map((o) => o.name).join(", "),
    remoteFlag: /remote/i.test(j.location?.name || ""),
    html: j.content || "",
    plain: "",
    postedAt: j.first_published || j.updated_at || null,
    // Greenhouse's absolute_url IS the posting page and carries the apply form.
    applyUrl: j.absolute_url,
    postingUrl: j.absolute_url,
    pay: payFromGreenhouseMeta(j),
  }));
}

function payFromGreenhouseMeta(j) {
  // Some boards expose a pay_input_ranges block; most do not.
  const r = j.pay_input_ranges?.[0];
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
   https://api.lever.co/v0/postings/{company}?mode=json
   Gives structured salaryRange on many accounts, plus `lists` which is the
   cleanest source of responsibilities/requirements of any ATS.             */

export async function lever(company) {
  const url = `${BASE.lever}/v0/postings/${company.token}?mode=json`;
  const data = await getJson(url);
  const jobs = Array.isArray(data) ? data : [];
  return jobs.map((j) => {
    const listsHtml = (j.lists || [])
      .map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`)
      .join("");
    return {
      externalId: String(j.id),
      title: j.text || "",
      department: j.categories?.department || j.categories?.team || "",
      locationRaw: j.categories?.location || "",
      remoteFlag: /remote/i.test(j.workplaceType || "") || /remote/i.test(j.categories?.location || ""),
      html: `${j.description || ""}${listsHtml}${j.additional || ""}`,
      plain: `${j.descriptionPlain || ""}\n${j.additionalPlain || ""}`,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      // applyUrl lands on the form itself; hostedUrl is the description page.
      applyUrl: j.applyUrl || (j.hostedUrl ? j.hostedUrl.replace(/\/$/, "") + "/apply" : null),
      postingUrl: j.hostedUrl || j.applyUrl,
      pay: j.salaryRange
        ? {
            min: j.salaryRange.min,
            max: j.salaryRange.max,
            currency: j.salaryRange.currency || "USD",
            interval: j.salaryRange.interval || "year",
          }
        : null,
    };
  });
}

/* --- Ashby --------------------------------------------------------------- *
   https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true
   Best structured compensation data of the four. Always ask for it.        */

export async function ashby(company) {
  const url = `${BASE.ashby}/posting-api/job-board/${company.token}?includeCompensation=true`;
  const data = await getJson(url);
  const jobs = data?.jobs || [];
  return jobs
    .filter((j) => j.isListed !== false)
    .map((j) => ({
      externalId: String(j.id),
      title: j.title || "",
      department: j.department || j.team || "",
      locationRaw: j.location || "",
      remoteFlag: !!j.isRemote,
      html: j.descriptionHtml || "",
      plain: j.descriptionPlain || "",
      postedAt: j.publishedAt || j.updatedAt || null,
      applyUrl: j.applyUrl || j.jobUrl,
      postingUrl: j.jobUrl || j.applyUrl,
      pay: payFromAshby(j),
    }));
}

function payFromAshby(j) {
  const comps = j.compensation?.summaryComponents || [];
  const salary = comps.find((c) => /salary/i.test(c.compensationType || ""));
  if (salary && (salary.minValue != null || salary.maxValue != null)) {
    return {
      min: salary.minValue,
      max: salary.maxValue,
      currency: salary.currencyCode || "USD",
      interval: salary.interval || "1 YEAR",
    };
  }
  // Fall back to the human-readable tier summary, e.g. "$120K – $150K".
  const summary = j.compensation?.compensationTierSummary;
  return summary ? { summaryText: summary } : null;
}

/* --- Workable ------------------------------------------------------------ *
   https://apply.workable.com/api/v1/widget/accounts/{token}?details=true
   Splits description / requirements / benefits into separate HTML fields,
   which maps neatly onto the two buckets the board displays.               */

export async function workable(company) {
  const url = `${BASE.workable}/api/v1/widget/accounts/${company.token}?details=true`;
  const data = await getJson(url);
  const jobs = data?.jobs || [];
  return jobs.map((j) => {
    const city = [j.city, j.state].filter(Boolean).join(", ");
    return {
      externalId: String(j.shortcode || j.id),
      title: j.title || "",
      department: j.department || "",
      locationRaw: city || j.country || "",
      remoteFlag: !!j.telecommuting,
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
    };
  });
}

/* --- registry ------------------------------------------------------------ */

export const ADAPTERS = { greenhouse, lever, ashby, workable };

export const SOURCE_LABEL = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
};
