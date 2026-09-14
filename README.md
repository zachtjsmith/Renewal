# Renewal — a customer success job board

Pulls CS, AM, onboarding, renewals and CS Ops roles from public applicant
tracking systems every morning, keeps only the ones with a published salary,
and writes them to `public/jobs.json` for the site to read.

No database, no server, no monthly bill. A JSON file rebuilt nightly.

---

**New here? Read [GOING-LIVE.md](GOING-LIVE.md)** — it walks through launching
the site, publishing a newsletter, and adding resource videos, step by step.

## Run it

```bash
npm install       # once
npm run dev       # local preview at localhost:5173
npm test          # 125 checks on parsing, classification and the pipeline
npm run verify    # pings every board token, tells you which are dead
npm run ingest    # fetch everything, write public/jobs.json
npm run newsletter # sync issues from your newsletter RSS feed
npm run build     # production build into dist/
```

Node 20 or newer.

Useful flags:

```bash
npm run ingest -- --loose          # keep roles with no published salary
npm run ingest -- --max-age=90     # widen the freshness window from 45 days
npm run ingest -- --limit=5        # only hit the first 5 boards, for debugging
npm run ingest -- --global         # turn off the US/Canada geography filter
```

---

## Your first hour

**1. Fix the company list.** `ingest/companies.js` ships with ~40 boards as a
starter. Tokens go stale when companies switch ATS, so run `npm run verify`
first and delete anything reported dead. Then grow the list — this is the real
asset of the business, not the code.

To find a token, open a company's careers page and look at where Apply sends you:

| ATS | URL you'll see | Token |
|---|---|---|
| Greenhouse | `job-boards.greenhouse.io/**figma**` | `figma` |
| Lever | `jobs.lever.co/**netlify**` | `netlify` |
| Ashby | `jobs.ashbyhq.com/**ramp**` | `ramp` |
| Workable | `apply.workable.com/**acme**` | `acme` |

Add the entry, set `industry` yourself (no ATS provides it), and you're done.

**2. Run the ingest.** Expect to keep roughly 1–3% of everything you fetch.
400 boards is a few hundred live CS roles. That is a healthy niche board.

**3. Deploy.** Push to GitHub, connect the repo to Netlify or Vercel, point it
at `src/App.jsx`. The included Action reruns the ingest every morning and
commits the new `jobs.json`, which triggers a redeploy automatically.

---

## How a posting becomes a listing

```
ATS JSON  →  adapter  →  classify  →  salary  →  normalize  →  dedupe  →  jobs.json
```

**Classify** (`ingest/lib/classify.js`) runs exclusions before inclusions,
because a naive keyword match on "customer success" pulls in
`Software Engineer, Customer Success Platform`, `Account Executive` and
`Customer Support Specialist` — three different jobs, none of them yours.

**Salary** (`ingest/lib/parse.js`) takes structured data when the ATS provides
it (Ashby and Lever usually do) and scrapes the body text when it doesn't
(Greenhouse and Workable usually don't). It is deliberately conservative and
will return nothing rather than guess: it rejects ARR figures, quota numbers,
funding rounds and customer-savings claims, all of which look like salaries
to a lazy regex.

**Nothing is ever estimated.** If a posting doesn't publish a range, the listing
shows "See job listing" rather than a guess. Same rule for book size, market
segment and tooling: absent in the posting means absent on the board. City,
state and remote/hybrid are always shown.

Run `npm run ingest -- --strict` if you'd rather drop salary-less roles entirely.
That's the stronger editorial position and it costs you listings — it's a
business call, not a technical one.

---

## Fields no other board has

Pulled out of the description text, because employers bury them:

- **Book of business** — `38 accounts / $4.1M ARR`, but only when the posting
  ties the number to the role. "We serve 10,000 customers" and "we passed $50M
  ARR" are company marketing and are rejected.
- **Stack** — only tools the posting actually names. Ambiguous words (Front,
  Linear, Segment) need a nearby cue, and a company is never tagged with its
  own product.
- **Segment** — Enterprise / Mid-Market / SMB, only when stated. No guessing
  from book size, and no default.
- **Family** — which of the six CS job types it actually is.

## Apply links

`applyUrl` is validated as a deep link — a URL with a real path. A posting whose
apply link is only a company homepage is dropped, because an Apply button that
lands someone on a homepage is worse than no button at all.

Lever and Ashby expose a separate application URL and the adapters prefer it
over the description page. The "Company site" button is a different field
(`companySite`) that comes from `site` in `ingest/companies.js` — ATS domains
are never used for it, so nobody gets sent to Greenhouse's homepage.

---

## Selling ad space

`featured.json` is the paid inventory. Add an entry, rerun the ingest, and that
role is pinned to the top of the board with the amber treatment:

```json
{ "matches": [{ "company": "Ramp", "titleContains": "Customer Success" }] }
```

Delete it after 30 days. When you're doing enough volume to hate doing that by
hand, have your Stripe webhook write to this file instead.

The two rail slots are in `AD_SLOTS` in `src/App.jsx`. Flip `sold: true` and
drop in the advertiser's creative. Keeping it at two slots forever is what lets
you charge $299 instead of $29.

Rate card, all set in `AD_PACKAGES`: featured listing **$99**, newsletter
sponsor **$199** an issue, board rail **$299** a month, resource sponsor
**$499** a quarter.

---

## Submitted listings

The "Submit a free listing" button on the Advertise tab opens a real form. It
validates the apply link and **enforces the salary range before anything can be
sent**, so the board's rule is applied at the point of entry rather than by you
later.

With `LISTING_ENDPOINT` left empty it opens a pre-filled email, so it works on
day one with no backend. Paste a Formspree, Basin or Netlify Forms URL into that
constant and submissions POST as JSON instead — nothing else needs changing.

---

## The shop

Products live in `PRODUCTS` and `BUNDLE` in `src/App.jsx`; cover images in
`public/images/covers/`. Checkout is Gumroad — set `SHOP.vendor` to your
username once and all nine buttons follow. To move to Etsy or Stripe, rewrite
`SHOP.buildUrl` and nothing else changes.

---

## Staying on the right side of the line

Everything here uses **public, documented, unauthenticated endpoints** that
these vendors publish specifically so job boards can consume them. That is a
supported use, not a workaround.

The ingest identifies itself with a real User-Agent, caps concurrency at 5, and
sleeps 250ms between calls. Leave those alone. A nightly run of a few hundred
boards is invisible to them; an aggressive one gets you blocked.

**Don't scrape LinkedIn or Indeed.** It breaks their terms of service, the
markup changes constantly, and you'll be IP-banned inside two months. If you
want volume beyond ATS feeds, license it — Adzuna, Coresignal and Jooble all
sell legitimate API access, and USAJOBS is free for government roles.

---

## Testing without hitting live APIs

```bash
node ingest/fixtures/server.js &
ATS_BASE_GREENHOUSE=http://localhost:871 \
ATS_BASE_LEVER=http://localhost:871 \
ATS_BASE_ASHBY=http://localhost:871 \
ATS_BASE_WORKABLE=http://localhost:871 \
node ingest/build.js --demo
```

The fixture server mimics all four APIs, including Greenhouse's escaped HTML
and Ashby's compensation block. Use it when changing a parser.

---

## Files

```
index.html            page shell, title and meta description
vite.config.js        build config
netlify.toml          Netlify deploy settings (vercel.json for Vercel)
src/main.jsx          React entry point
src/App.jsx           the site
public/jobs.json      generated nightly — do not edit by hand
public/content.json   newsletter issues + free resources — edit this freely
public/images/covers/ product cover images
featured.json         paid placements
ingest/
  companies.js        the board list — your actual asset
  adapters.js         one function per ATS
  build.js            orchestrator, writes public/jobs.json
  test.js             96 checks, run before every deploy
  lib/parse.js        HTML, salary, book size, stack, location
  lib/classify.js     what counts as a CS role
  lib/normalize.js    raw posting → listing, plus dedupe
  fetch-newsletter.js sync issues from an RSS feed
  fixtures/server.js  fake ATS for offline testing
```

## Pagination

The board shows 10 roles per page with a Next/Previous control and a page count
beneath it. Change `PAGE_SIZE` in `src/App.jsx` if you want a different number.
Changing any filter returns you to page 1.
