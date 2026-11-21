/* ============================================================================
   fixtures/server.js — a fake ATS, for testing the pipeline without network
   ----------------------------------------------------------------------------
     node ingest/fixtures/server.js &
     ATS_BASE_GREENHOUSE=http://localhost:871 ATS_BASE_LEVER=http://localhost:871 \
     ATS_BASE_ASHBY=http://localhost:871 ATS_BASE_WORKABLE=http://localhost:871 \
     ATS_BASE_SMARTRECRUITERS=http://localhost:871 ATS_BASE_RECRUITEE=http://localhost:871 \
     node ingest/build.js --demo

   Responses copy the real payload shapes, and include deliberate traps:
     - the same role posted in three cities         → must merge into one
     - the same role on two different ATSes         → must merge into one
     - a Senior and a non-Senior CSM at one company → must stay two
     - a foreign role only detectable by country    → must be dropped
     - an evergreen "Talent Pool" post              → must be dropped
     - a board-root apply link                      → must be dropped
   ========================================================================== */

import http from "node:http";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const body = ({ intro, does, wants, pay = "" }) => `
<p>${intro}</p>
<h3>What you'll do</h3>
<ul>${does.map((d) => `<li>${d}</li>`).join("")}</ul>
<h3>What you'll bring</h3>
<ul>${wants.map((w) => `<li>${w}</li>`).join("")}</ul>
<h3>Benefits</h3>
<ul><li>Unlimited PTO and full health coverage</li></ul>
<p>${pay}</p>`;

// One description, reused across three city postings — as real companies do.
const MULTI_CITY = body({
  intro: "Northloop is hiring customer success managers to own a book of mid-market engineering teams from kickoff through renewal, carrying the retention number personally.",
  does: [
    "Own a book of 45 mid-market accounts through onboarding, adoption and renewal",
    "Run quarterly business reviews with engineering leadership",
    "Partner with product on the feedback loop from customers to roadmap",
  ],
  wants: ["3+ years in customer success at a B2B SaaS company", "Comfortable in technical conversations"],
  pay: "The base salary range for this role is $115,000 - $140,000.",
});

/* --- Greenhouse: list (no content) + per-job detail ---------------------- */
const GH_JOBS = [
  { id: 5001, title: "Senior Customer Success Manager", location: { name: "Remote - United States" }, days: 1,
    content: body({
      intro: "Own a book of 38 mid-market accounts representing $4.1M ARR and carry them from kickoff through renewal.",
      does: ["Run the full post-sale lifecycle for a book of 38 accounts", "Carry a gross retention target of 94%", "Build health scores in Gainsight"],
      wants: ["5+ years in customer success at a B2B SaaS company", "You have personally owned a renewal number"],
      pay: "The base salary range for this role is $130,000 - $160,000 plus a 15% annual bonus. Experience with Gainsight and Salesforce is a plus.",
    }) },
  { id: 5002, title: "Staff Software Engineer, Customer Success Platform", location: { name: "San Francisco, CA" }, days: 2, content: "<p>Build the platform. $190,000 - $240,000.</p>" },
  { id: 5003, title: "Customer Success Manager", location: { name: "London, UK" }, days: 3, content: "<p>London role.</p>" },
  { id: 5004, title: "Customer Success Manager, SMB", location: { name: "Remote - US" }, days: 4,
    content: "<p>Northloop is growing its SMB customer success team and we are looking for someone who enjoys working at volume across a pooled book of accounts through onboarding, adoption and renewal.</p><p>Most of your week is spent in one-to-many programs rather than scheduled calls: lifecycle email, office hours, webinars and in-app campaigns.</p>" },
  { id: 5005, title: "Client Success Lead", location: { name: "Denver, CO" }, days: 2, url: "https://boards.greenhouse.io/northloop",
    content: "<p>Lead client success. Salary $110,000 - $130,000.</p>" },
  // same role, three cities → one listing with three locations
  { id: 5006, title: "Customer Success Manager - New York", location: { name: "New York, NY" }, days: 5, content: MULTI_CITY },
  { id: 5007, title: "Customer Success Manager - Austin", location: { name: "Austin, TX" }, days: 6, content: MULTI_CITY },
  { id: 5008, title: "Customer Success Manager (Remote)", location: { name: "Remote - US" }, days: 4, content: MULTI_CITY },
  // new family
  { id: 5009, title: "Business Development Representative", location: { name: "Chicago, IL" }, days: 1,
    content: body({
      intro: "Book first meetings with mid-market engineering leaders for our account executives, working inbound and outbound pipeline.",
      does: ["Research and prospect into target accounts", "Qualify inbound leads within one business day"],
      wants: ["1+ year in a sales development or customer-facing role"],
      pay: "Base salary of $60,000 - $70,000 with $85,000 - $95,000 OTE.",
    }) },
  // evergreen: no opening behind it
  { id: 5010, title: "Customer Success Manager - Talent Pool", location: { name: "Remote - US" }, days: 300, content: "<p>Join our talent community.</p>" },
];
const ghPublic = (j) => ({
  id: j.id, title: j.title, location: j.location,
  absolute_url: j.url || `https://boards.greenhouse.io/northloop/jobs/${j.id}`,
  first_published: daysAgo(j.days), updated_at: daysAgo(j.days),
});

/* --- Lever --------------------------------------------------------------- */
const LEVER = [
  {
    id: "2f8c1b3e-9a4d-4c21-bb77-1a2b3c4d5e6f", text: "Enterprise Account Manager",
    categories: { department: "Account Management", location: "Chicago, IL", commitment: "Full-time" },
    workplaceType: "hybrid", country: "US",
    hostedUrl: "https://jobs.lever.co/parcelay/2f8c1b3e-9a4d-4c21-bb77-1a2b3c4d5e6f",
    createdAt: Date.now() - 2 * 86400000,
    description: "<p>Twelve enterprise logistics accounts worth $9.8M ARR, three of them Fortune 500.</p>",
    descriptionPlain: "Twelve enterprise logistics accounts worth $9.8M ARR, three of them Fortune 500.",
    lists: [
      { text: "Responsibilities", content: "<li>Own commercial relationships for 12 enterprise accounts</li><li>Drive multi-year renewals and expansion</li>" },
      { text: "Requirements", content: "<li>5+ years in enterprise account management with a quota</li>" },
    ],
    salaryRange: { min: 110000, max: 130000, currency: "USD", interval: "per-year-salary" },
  },
  {
    id: "7a1d2c4e-5b6f-4788-9c01-2d3e4f5a6b7c", text: "Account Executive, Mid-Market",
    categories: { department: "Sales", location: "Remote" }, country: "US",
    hostedUrl: "https://jobs.lever.co/parcelay/7a1d2c4e-5b6f-4788-9c01-2d3e4f5a6b7c",
    createdAt: Date.now() - 86400000, description: "<p>Close new logos. $90,000 - $110,000 base.</p>",
  },
  {
    // German role; only the structured country gives it away
    id: "9b2e3d5f-6c7a-4899-8d12-3e4f5a6b7c8d", text: "Customer Success Manager",
    categories: { department: "Customer Success", location: "Stuttgart" }, country: "DE",
    hostedUrl: "https://jobs.lever.co/parcelay/9b2e3d5f-6c7a-4899-8d12-3e4f5a6b7c8d",
    createdAt: Date.now() - 86400000, description: "<p>Stuttgart office. Salary €60,000 - €75,000.</p>",
  },
];

/* --- Ashby --------------------------------------------------------------- */
const RENEWALS_HTML = body({
  intro: "A dedicated renewals desk sitting between customer success and finance. Contract-heavy and negotiation-heavy.",
  does: ["Own a $12M renewal base across roughly 90 mid-market contracts", "Negotiate uplifts and multi-year terms with procurement"],
  wants: ["3+ years in renewals, sales or commercial customer success"],
  pay: "Base $95,000 - $115,000 with $150,000 - $180,000 OTE.",
});
const ASHBY = {
  apiVersion: "1",
  jobs: [
    {
      id: "3c9e7f11-2a4b-4d8e-9f01-5b6c7d8e9f01", title: "Customer Success Operations Manager",
      department: "Customer Success", location: "San Francisco", isRemote: false, workplaceType: "OnSite", isListed: true,
      publishedAt: daysAgo(5), jobUrl: "https://jobs.ashbyhq.com/havenpoint/3c9e7f11-2a4b-4d8e-9f01-5b6c7d8e9f01",
      address: { postalAddress: { addressCountry: "United States" } },
      descriptionHtml: body({
        intro: "The systems role behind a 24-person customer success organisation. You will own the tooling, the reporting and the segmentation.",
        does: ["Administer Gainsight end to end", "Build the retention reporting layer"],
        wants: ["3+ years in CS Ops, RevOps or Sales Ops", "You write your own SQL"],
      }),
      compensation: { summaryComponents: [{ compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 115000, maxValue: 140000 }] },
    },
    {
      id: "4d0f8a22-3b5c-4e9f-a012-6c7d8e9f0a12", title: "Renewals Manager",
      department: "Customer Success", location: "Remote", isRemote: true, workplaceType: "Remote", isListed: true,
      publishedAt: daysAgo(7), jobUrl: "https://jobs.ashbyhq.com/havenpoint/4d0f8a22-3b5c-4e9f-a012-6c7d8e9f0a12",
      descriptionHtml: RENEWALS_HTML,
      compensation: { summaryComponents: [{ compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 95000, maxValue: 115000 }] },
    },
    {
      // Ashby says isRemote for hybrid roles; workplaceType must win
      id: "6f2b0c44-5d7e-4a01-c234-8e9f0a1b2c34", title: "Implementation Manager",
      department: "Customer Success", location: "Boston, MA", isRemote: true, workplaceType: "Hybrid", isListed: true,
      publishedAt: daysAgo(3), jobUrl: "https://jobs.ashbyhq.com/havenpoint/6f2b0c44-5d7e-4a01-c234-8e9f0a1b2c34",
      descriptionHtml: body({
        intro: "Run implementations for insurance carriers adopting our platform, three days a week in our Boston office.",
        does: ["Lead 15 concurrent implementations"], wants: ["2+ years in implementation or onboarding"],
      }),
    },
    { id: "5e1a9b33-4c6d-4fa0-b123-7d8e9f0a1b23", title: "Customer Success Manager", isListed: false,
      jobUrl: "https://jobs.ashbyhq.com/havenpoint/5e1a9b33-4c6d-4fa0-b123-7d8e9f0a1b23", descriptionHtml: "<p>Hidden.</p>" },
  ],
};

/* --- Workable ------------------------------------------------------------ */
const WORKABLE = {
  name: "Quillstone",
  jobs: [
    {
      id: "wk-1", shortcode: "ABC123", title: "Customer Onboarding Specialist", department: "Customer Success",
      city: "Denver", state: "CO", country: "United States", telecommuting: true, published_on: daysAgo(6),
      url: "https://apply.workable.com/quillstone/j/ABC123/", application_url: "https://apply.workable.com/quillstone/j/ABC123/apply/",
      description: "<p>Run 25 concurrent implementations for law firms and in-house legal teams.</p><ul><li>Hit a 45-day median time to first value</li></ul>",
      requirements: "<ul><li>2+ years in onboarding or project delivery</li></ul>",
      benefits: "<p>The salary range for this role is $72,000 - $88,000 per year.</p>",
    },
    { id: "wk-2", shortcode: "DEF456", title: "Customer Support Specialist", department: "Support", city: "Denver", state: "CO",
      country: "United States", published_on: daysAgo(3), url: "https://apply.workable.com/quillstone/j/DEF456/", description: "<p>Answer tickets.</p>" },
    {
      // Greek city not on any blocklist: only the country field catches it
      id: "wk-3", shortcode: "GHI789", title: "Account Manager", department: "Sales", city: "Thessaloniki",
      country: "Greece", published_on: daysAgo(2), url: "https://apply.workable.com/quillstone/j/GHI789/",
      description: "<p>Manage a book of Greek SMB accounts.</p>",
    },
  ],
};

/* --- SmartRecruiters: list + detail --------------------------------------- */
const SR = [
  { id: "744000011111111", name: "Customer Success Manager", location: { city: "Chicago", region: "IL", country: "us", remote: false },
    department: { label: "Customer Success" }, releasedDate: daysAgo(2),
    jobAd: { sections: {
      jobDescription: { title: "Job Description", text: "<p>Own a portfolio of 60 enterprise payment clients and drive adoption of new products.</p><ul><li>Lead quarterly business reviews</li><li>Coordinate escalations across product and support</li></ul>" },
      qualifications: { title: "Qualifications", text: "<ul><li>4+ years in customer success or account management</li></ul>" },
      additionalInformation: { title: "Additional Information", text: "<p>The base pay range for this position is $98,000 - $126,000.</p>" },
    } } },
  { id: "744000022222222", name: "Senior Software Engineer", location: { city: "Chicago", region: "IL", country: "us" }, department: { label: "Engineering" }, releasedDate: daysAgo(1) },
  { id: "744000033333333", name: "Key Account Manager", location: { city: "", region: "", country: "us", remote: true },
    department: { label: "Sales" }, releasedDate: daysAgo(4),
    jobAd: { sections: { jobDescription: { title: "Job Description", text: "<p>Grow our largest merchant relationships across North America.</p><ul><li>Own 20 key accounts</li></ul>" } } } },
];

/* --- Recruitee: same Renewals role as Ashby (a company mid-migration) ------ */
const RECRUITEE = {
  offers: [
    { id: 90001, title: "Renewals Manager", status: "published", location: "Remote", remote: true, country_code: "US",
      department: "Customer Success", published_at: daysAgo(9),
      careers_url: "https://havenpoint.recruitee.com/o/renewals-manager",
      careers_apply_url: "https://havenpoint.recruitee.com/o/renewals-manager/c/new",
      description: "<p>A dedicated renewals desk sitting between customer success and finance. Contract-heavy and negotiation-heavy.</p><ul><li>Own a $12M renewal base across roughly 90 mid-market contracts</li><li>Negotiate uplifts and multi-year terms with procurement</li></ul>",
      requirements: "<ul><li>3+ years in renewals, sales or commercial customer success</li></ul><p>Base $95,000 - $115,000 with $150,000 - $180,000 OTE.</p>" },
    { id: 90002, title: "Customer Success Associate", status: "published", location: "Portland, OR", country_code: "US",
      department: "Customer Success", published_at: daysAgo(3),
      careers_url: "https://havenpoint.recruitee.com/o/customer-success-associate",
      careers_apply_url: "https://havenpoint.recruitee.com/o/customer-success-associate/c/new",
      description: "<p>Help new policyholders get set up and successful in their first ninety days with our platform.</p><ul><li>Run onboarding calls for new accounts</li></ul>",
      salary: { min: 58000, max: 66000, currency: "USD", period: "year" } },
  ],
};


/* --- BambooHR: split list/detail, free-text compensation ----------------- */
const BAMBOO = [
  { id: 4101, jobOpeningName: "Customer Support Manager", departmentLabel: "Customer Experience",
    location: { city: "Raleigh", state: "NC", country: "United States" }, isRemote: false,
    detail: { datePosted: daysAgo(4), compensation: "$95,000 - $118,000 per year",
      description: "<p>Lead a team of nine support specialists covering a 24/5 queue for our restaurant customers.</p><ul><li>Own first-response and resolution targets across chat, email and phone</li><li>Coach specialists through escalations and quarterly reviews</li><li>Partner with product on the top ten recurring defect themes</li></ul><p>You have run a support team of at least five people.</p>" } },
  // front-line: must be excluded, and must never cost a detail request
  { id: 4102, jobOpeningName: "Customer Support Specialist", departmentLabel: "Customer Experience",
    location: { city: "Raleigh", state: "NC", country: "United States" }, detail: { description: "<p>Answer tickets.</p>" } },
  // core CS at BambooHR, so the adapter stays exercised with the core-only settings
  { id: 4104, jobOpeningName: "Client Success Manager", departmentLabel: "Client Success",
    location: { city: "Charlotte", state: "NC", country: "United States" }, isRemote: false,
    detail: { datePosted: daysAgo(2), compensation: "$78,000 - $92,000 per year",
      description: "<p>Own a book of 70 restaurant groups from go-live through renewal, running quarterly reviews with owners and operators.</p><ul><li>Drive adoption of online ordering and loyalty modules</li><li>Partner with support on escalations across your book</li></ul>" } },
  { id: 4103, jobOpeningName: "Director of Customer Service", departmentLabel: "Customer Experience",
    location: { city: "", state: "", country: "United States" }, isRemote: true,
    detail: { datePosted: daysAgo(8),
      description: "<p>Own the service organisation end to end: support, onboarding and the customer care desk.</p><ul><li>Manage three managers and a team of thirty</li><li>Set the service level targets and report them to the executive team</li></ul>" } },
];

/* --- Breezy: single response, Account Executive now in scope ------------- */
const BREEZY = [
  { id: "b-7001", name: "Account Executive, Mid-Market", department: "Sales",
    location: { city: "Nashville", state: { name: "TN" }, country: { name: "United States" }, is_remote: false },
    published_date: daysAgo(3), url: "https://tessellate.breezy.hr/p/b-7001-account-executive-mid-market",
    description: "<p>Close new mid-market logos for our scheduling platform, working closely with the customer success team on handoff.</p><ul><li>Carry a $750,000 annual quota</li><li>Run full-cycle deals from discovery through close</li></ul><p>The base salary range for this role is $80,000 - $95,000.</p>" },
  { id: "b-7002", name: "Customer Success Manager", department: "Customer Success",
    location: { city: "Nashville", state: { name: "TN" }, country: { name: "United States" }, is_remote: true },
    published_date: daysAgo(6), url: "https://tessellate.breezy.hr/p/b-7002-customer-success-manager",
    description: "<p>Own a book of 55 mid-market accounts through onboarding, adoption and renewal for our scheduling platform.</p><ul><li>Carry a net revenue retention target</li><li>Run quarterly reviews with operations leaders</li></ul>" },
];

/* --- routing ------------------------------------------------------------- */
const send = (res, obj) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  let m;

  if ((m = p.match(/^\/v1\/boards\/[^/]+\/jobs\/(\d+)$/))) {
    const j = GH_JOBS.find((x) => String(x.id) === m[1]);
    return j ? send(res, { ...ghPublic(j), content: esc(j.content), departments: [{ name: "Customer Success" }] }) : (res.writeHead(404), res.end());
  }
  if (/^\/v1\/boards\/[^/]+\/jobs\/?$/.test(p)) return send(res, { jobs: GH_JOBS.map(ghPublic), meta: { total: GH_JOBS.length } });
  if (p.startsWith("/v0/postings/")) return send(res, LEVER);
  if (p.startsWith("/posting-api/job-board/")) return send(res, ASHBY);
  if (p.startsWith("/api/v1/widget/accounts/")) return send(res, WORKABLE);
  if ((m = p.match(/^\/v1\/companies\/([^/]+)\/postings\/(\d+)$/))) {
    const j = SR.find((x) => x.id === m[2]);
    return j ? send(res, { ...j, company: { identifier: m[1], name: "Visalia Payments" } }) : (res.writeHead(404), res.end());
  }
  if ((m = p.match(/^\/v1\/companies\/([^/]+)\/postings\/?$/))) {
    const off = Number(url.searchParams.get("offset") || 0);
    const content = SR.slice(off, off + 100).map(({ jobAd, ...rest }) => ({ ...rest, company: { identifier: m[1], name: "Visalia Payments" } }));
    return send(res, { offset: off, limit: 100, totalFound: SR.length, content });
  }
  if ((m = p.match(/^\/careers\/(\d+)\/detail$/))) {
    const j = BAMBOO.find((x) => String(x.id) === m[1]);
    return j ? send(res, { result: { jobOpening: j.detail } }) : (res.writeHead(404), res.end());
  }
  if (p === "/careers/list") {
    return send(res, { companyName: "Skilletware", result: BAMBOO.map(({ detail, ...rest }) => rest) });
  }
  if (p === "/json") return send(res, BREEZY);

  if (p.startsWith("/api/offers")) return send(res, RECRUITEE);

  res.writeHead(404); res.end("no fixture");
});

const PORT = Number(process.env.PORT || 871);
server.listen(PORT, () => console.log(`fixture ATS listening on :${PORT}`));
