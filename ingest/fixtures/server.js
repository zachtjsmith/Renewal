/* ============================================================================
   fixtures/server.js — a fake ATS, for testing the pipeline without network
   ----------------------------------------------------------------------------
     node ingest/fixtures/server.js &
     ATS_BASE_GREENHOUSE=http://localhost:871 \
     ATS_BASE_LEVER=http://localhost:871 \
     ATS_BASE_ASHBY=http://localhost:871 \
     ATS_BASE_WORKABLE=http://localhost:871 \
     node ingest/build.js --demo

   Responses copy the real payload shapes, including Greenhouse's escaped HTML
   and Ashby's compensation block. Useful for debugging a parser change without
   hammering live APIs.
   ========================================================================== */

import http from "node:http";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const body = (opts) => `
<p>${opts.intro}</p>
<h3>What you'll do</h3>
<ul>${opts.does.map((d) => `<li>${d}</li>`).join("")}</ul>
<h3>What you'll bring</h3>
<ul>${opts.wants.map((w) => `<li>${w}</li>`).join("")}</ul>
<h3>Benefits</h3>
<ul><li>Unlimited PTO and full health coverage</li></ul>
<p>${opts.pay}</p>`;

/* --- Greenhouse ---------------------------------------------------------- */
const GH = {
  jobs: [
    {
      id: 5001,
      title: "Senior Customer Success Manager",
      departments: [{ name: "Customer Success" }],
      location: { name: "Remote - United States" },
      absolute_url: "https://boards.greenhouse.io/northloop/jobs/5001",
      first_published: daysAgo(1),
      content: esc(body({
        intro: "Own a book of 38 mid-market accounts representing $4.1M ARR and carry them from kickoff through renewal.",
        does: [
          "Run the full post-sale lifecycle for a book of 38 accounts",
          "Carry a gross retention target of 94% and a $600K expansion goal",
          "Build and defend health scores in Gainsight, escalating risk early",
        ],
        wants: [
          "4+ years in customer success at a B2B SaaS company",
          "You have personally owned a renewal number, not supported one",
        ],
        pay: "The base salary range for this role is $130,000 - $160,000 plus a 15% annual bonus. Experience with Gainsight, Salesforce and SQL is a plus.",
      })),
    },
    {
      id: 5002,
      title: "Staff Software Engineer, Customer Success Platform",
      departments: [{ name: "Customer Success" }],
      location: { name: "San Francisco, CA" },
      absolute_url: "https://boards.greenhouse.io/northloop/jobs/5002",
      first_published: daysAgo(2),
      content: esc("<p>Build the internal platform our CS team uses. $190,000 - $240,000.</p>"),
    },
    {
      id: 5003,
      title: "Customer Success Manager",
      departments: [{ name: "Customer Success" }],
      location: { name: "London, UK" },
      absolute_url: "https://boards.greenhouse.io/northloop/jobs/5003",
      first_published: daysAgo(3),
      content: esc("<p>Great role. Salary £70,000 - £85,000.</p>"),
    },
    {
      id: 5005,
      title: "Client Success Lead",
      departments: [{ name: "Customer Success" }],
      location: { name: "Denver, CO" },
      absolute_url: "https://boards.greenhouse.io/northloop",
      first_published: daysAgo(2),
      content: esc("<p>Lead client success. Salary $110,000 - $130,000.</p>"),
    },
    {
      id: 5004,
      title: "Customer Success Manager, SMB",
      departments: [{ name: "Customer Success" }],
      location: { name: "Remote - US" },
      absolute_url: "https://boards.greenhouse.io/northloop/jobs/5004",
      first_published: daysAgo(4),
      // A realistic "thin" posting: no headings, no salary, no tooling named.
      content: esc("<p>Northloop is growing its SMB customer success team and we are looking for someone who enjoys working at volume. You will support a pooled book of accounts through onboarding, adoption and renewal, working alongside two other CSMs on the segment.</p><p>Most of your week is spent in one-to-many programs rather than scheduled calls: lifecycle email, office hours, webinars and in-app campaigns. When an account shows expansion signal you hand it to the sales team with context.</p><p>This is a good first customer success role, or a good fit if you have done enterprise work and want volume without the account politics. Competitive compensation and benefits.</p>"),
    },
  ],
};

/* --- Lever --------------------------------------------------------------- */
const LEVER = [
  {
    id: "2f8c1b3e-9a4d-4c21-bb77-1a2b3c4d5e6f",
    text: "Enterprise Account Manager",
    categories: { department: "Account Management", location: "Chicago, IL", commitment: "Full-time" },
    workplaceType: "hybrid",
    hostedUrl: "https://jobs.lever.co/parcelay/2f8c1b3e-9a4d-4c21-bb77-1a2b3c4d5e6f",
    createdAt: Date.now() - 2 * 86400000,
    description: "<p>Twelve enterprise logistics accounts worth $9.8M ARR, three of them Fortune 500.</p>",
    descriptionPlain: "Twelve enterprise logistics accounts worth $9.8M ARR, three of them Fortune 500.",
    lists: [
      { text: "Responsibilities", content: "<li>Own commercial relationships for 12 enterprise accounts</li><li>Drive multi-year renewals and expansion into new business units</li>" },
      { text: "Requirements", content: "<li>5+ years in enterprise account management with a quota</li><li>Experience with Salesforce and Clari</li>" },
    ],
    additional: "<p>Hybrid, three days a week in our Chicago office.</p>",
    salaryRange: { min: 110000, max: 130000, currency: "USD", interval: "per-year-salary" },
  },
  {
    id: "7a1d2c4e-5b6f-4788-9c01-2d3e4f5a6b7c",
    text: "Account Executive, Mid-Market",
    categories: { department: "Sales", location: "Remote" },
    hostedUrl: "https://jobs.lever.co/parcelay/7a1d2c4e-5b6f-4788-9c01-2d3e4f5a6b7c",
    createdAt: Date.now() - 1 * 86400000,
    description: "<p>Close new logos. $90,000 - $110,000 base.</p>",
    salaryRange: { min: 90000, max: 110000, currency: "USD", interval: "per-year-salary" },
  },
];

/* --- Ashby --------------------------------------------------------------- */
const ASHBY = {
  apiVersion: "1",
  jobs: [
    {
      id: "3c9e7f11-2a4b-4d8e-9f01-5b6c7d8e9f01",
      title: "Customer Success Operations Manager",
      department: "Customer Success",
      location: "San Francisco",
      isRemote: false,
      isListed: true,
      publishedAt: daysAgo(5),
      jobUrl: "https://jobs.ashbyhq.com/havenpoint/3c9e7f11-2a4b-4d8e-9f01-5b6c7d8e9f01",
      descriptionHtml: body({
        intro: "The systems role behind a 24-person customer success organisation. You will own the tooling, the reporting and the segmentation.",
        does: [
          "Administer Gainsight end to end including rules, playbooks and scorecards",
          "Build the retention reporting layer the executive team actually trusts",
        ],
        wants: [
          "3+ years in CS Ops, RevOps or Sales Ops",
          "You write your own SQL rather than waiting on the data team",
        ],
        pay: "Customers typically save $40,000 - $90,000 a year with our platform.",
      }),
      descriptionPlain: "",
      compensation: {
        compensationTierSummary: "$115K – $140K • Offers Equity",
        summaryComponents: [
          { compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 115000, maxValue: 140000 },
          { compensationType: "Equity", interval: "NONE", currencyCode: "USD" },
        ],
      },
    },
    {
      id: "4d0f8a22-3b5c-4e9f-a012-6c7d8e9f0a12",
      title: "Renewals Manager",
      department: "Customer Success",
      location: "Remote",
      isRemote: true,
      isListed: true,
      publishedAt: daysAgo(7),
      jobUrl: "https://jobs.ashbyhq.com/havenpoint/4d0f8a22-3b5c-4e9f-a012-6c7d8e9f0a12",
      descriptionHtml: body({
        intro: "A dedicated renewals desk sitting between customer success and finance. Contract-heavy and negotiation-heavy.",
        does: [
          "Own a $12M renewal base across roughly 90 mid-market contracts",
          "Negotiate uplifts, multi-year terms and paper exceptions with procurement",
        ],
        wants: ["3+ years in renewals, sales or commercial customer success"],
        pay: "Base $95,000 - $115,000 with $150,000 - $180,000 OTE.",
      }),
      compensation: { summaryComponents: [{ compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 95000, maxValue: 115000 }] },
    },
    {
      id: "5e1a9b33-4c6d-4fa0-b123-7d8e9f0a1b23",
      title: "Customer Success Manager",
      department: "Customer Success",
      location: "Remote",
      isRemote: true,
      isListed: false, // unlisted — must be skipped
      publishedAt: daysAgo(2),
      jobUrl: "https://jobs.ashbyhq.com/havenpoint/5e1a9b33-4c6d-4fa0-b123-7d8e9f0a1b23",
      descriptionHtml: "<p>Hidden role. $100,000 - $120,000.</p>",
    },
  ],
};

/* --- Workable ------------------------------------------------------------ */
const WORKABLE = {
  name: "Quillstone",
  jobs: [
    {
      id: "wk-1",
      shortcode: "ABC123",
      title: "Customer Onboarding Specialist",
      department: "Customer Success",
      city: "Denver",
      state: "CO",
      country: "United States",
      telecommuting: true,
      published_on: daysAgo(6),
      url: "https://apply.workable.com/quillstone/j/ABC123/",
      application_url: "https://apply.workable.com/quillstone/j/ABC123/apply/",
      description: "<p>Run 25 concurrent implementations for law firms and in-house legal teams.</p><ul><li>Hit a 45-day median time to first value</li><li>Own the onboarding playbook and template library</li></ul>",
      requirements: "<ul><li>2+ years in onboarding, implementation or project delivery</li><li>Familiarity with Rocketlane or Asana</li></ul>",
      benefits: "<p>The salary range for this role is $72,000 - $88,000 per year.</p>",
    },
    {
      id: "wk-2",
      shortcode: "DEF456",
      title: "Customer Support Specialist",
      department: "Support",
      city: "Denver",
      state: "CO",
      country: "United States",
      telecommuting: true,
      published_on: daysAgo(3),
      url: "https://apply.workable.com/quillstone/j/DEF456/",
      description: "<p>Answer tickets. $50,000 - $60,000.</p>",
    },
  ],
};

/* --- routing ------------------------------------------------------------- */
const server = http.createServer((req, res) => {
  const url = req.url || "";
  let payload = null;
  if (url.includes("/v1/boards/")) payload = GH;
  else if (url.includes("/v0/postings/")) payload = LEVER;
  else if (url.includes("/posting-api/job-board/")) payload = ASHBY;
  else if (url.includes("/api/v1/widget/accounts/")) payload = WORKABLE;

  if (!payload) { res.writeHead(404); return res.end("no fixture"); }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
});

const PORT = Number(process.env.PORT || 871);
server.listen(PORT, () => console.log(`fixture ATS listening on :${PORT}`));
