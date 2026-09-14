# Going live

Three guides in one file:

1. [Launch the site](#1-launch-the-site) — start to finish
2. [Publish a newsletter](#2-publish-a-newsletter)
3. [Add free resource videos](#3-add-free-resource-videos)

---

# 1. Launch the site

## You do not need to install anything

The short version: **everything below can be done in a web browser.** You never
have to open a terminal, and you never have to install Node or Git.

- Your files live on **GitHub**, which has a built-in text editor.
- The job ingest runs on **GitHub Actions** — their computers, not yours.
- The site is built and hosted by **Netlify** — also their computers.

Pick a route:

| | **Route A — browser only** | **Route B — on your machine** |
|---|---|---|
| Install anything? | No | Node + Git |
| Preview before publishing | No, you see it live ~90s after saving | Yes, instantly |
| Speed of a small edit | ~90 seconds | ~1 second |
| Everything else | Identical | Identical |

**Start with Route A.** If you find yourself making a lot of small visual
tweaks and waiting 90 seconds each time is annoying, switch to Route B later.
Nothing about the project changes — it's the same files either way.

---

## ROUTE A — Launch from your browser

### A1. Put the files on GitHub

1. Sign up at [github.com](https://github.com) (free).
2. Click **+** (top right) → **New repository**. Name it `renewal`. Leave
   everything else alone and click **Create repository**.
3. On the next screen click **uploading an existing file**.
4. Unzip the project on your computer, open the `renewal` folder, select
   **everything inside it**, and drag it onto the page.
5. Click **Commit changes**.

> **Careful:** drag the *contents* of the folder, not the folder itself. You
> should see `index.html`, `package.json`, `src`, `ingest` and so on at the top
> level of the repo. If you see a single `renewal` folder, delete it and redo
> the upload.

> **Hidden files:** GitHub's uploader skips folders starting with a dot, so
> `.github` may not appear. If it's missing, create it by hand: **Add file →
> Create new file**, type `.github/workflows/ingest.yml` as the filename (the
> slashes create the folders), paste the contents from the zip, and commit.

### A2. Switch on the robot

**Settings → Actions → General → Workflow permissions → Read and write
permissions → Save.**

Without this the ingest can't publish the board it builds.

### A3. Get real jobs

First, check which company boards still work:

**Actions → Refresh job board → Run workflow → mode: `verify` → Run workflow.**

Wait a minute, then click into the run and open the log. You'll see each
company reported alive or dead. Tokens go stale when a company changes ATS.

Now fix the list: open `ingest/companies.js` in GitHub, click the **pencil
icon**, delete any dead entries, and add your own:

```js
{ ats: "greenhouse", token: "figma", name: "Figma",
  industry: "Design software", site: "https://www.figma.com" },
```

To find a token, open a company's careers page and look at where Apply sends you:

| ATS | The URL looks like | Token is |
|---|---|---|
| Greenhouse | `job-boards.greenhouse.io/`**`figma`** | `figma` |
| Lever | `jobs.lever.co/`**`netlify`** | `netlify` |
| Ashby | `jobs.ashbyhq.com/`**`ramp`** | `ramp` |
| Workable | `apply.workable.com/`**`acme`** | `acme` |

`industry` and `site` are yours to fill in — no ATS provides either. `site` is
what the "Company site" button uses.

Commit, then run the workflow again with mode `ingest`. Open the log:

```
  ok   Figma                    47 postings → 2 listed
  FAIL Kajabi                   HTTP 404

  1,240 postings seen across 40 boards in 38s
  31 matched customer success, 29 after dedupe

  dropped:
     1180  not a CS role
        4  apply link was a jobs list, not this role

  22 of 29 listings publish a salary (76%).
```

**Keeping 2–3% is normal and correct.** Most roles at a SaaS company are
engineering. If you're keeping 30%, something is wrong.

> **Your real job here:** get that company list from 40 to 300. Start with
> every SaaS company you've worked at, sold to, or interviewed with. An hour of
> this beats any list you could buy, and it's the part competitors can't copy.

### A4. Make it yours

Open `src/App.jsx` in GitHub, click the pencil, and edit the `BRAND` block at
the very top:

```js
const BRAND = {
  name: "renewal",
  line: "Customer success jobs, nothing invented.",
  contactEmail: "you@yourdomain.com",
  etsyShop: "https://...",
};
```

A little further down, set your shop vendor:

```js
const SHOP = { vendor: "YOURNAME", ... };   // your Gumroad username
```

Also edit `index.html` — the `<title>` and description are what Google shows.

### A5. Publish

1. Go to [netlify.com](https://netlify.com) → sign in with GitHub.
2. **Add new site → Import an existing project → GitHub →** pick your repo.
3. Netlify reads `netlify.toml` and fills in the settings itself. Don't change
   them. Click **Deploy**.

Ninety seconds later you're live at something like
`renewal-board-a1b2c3.netlify.app`.

From now on, **every commit redeploys automatically** — including the robot's
nightly job refresh. That's the whole operating loop.

**Custom domain:** buy one anywhere (~$12/year), then Netlify → **Domain
settings → Add a domain** and follow the DNS steps. HTTPS is automatic and free.

### A6. Everyday operation, all in the browser

| To do this | Go here |
|---|---|
| Refresh the jobs now | Actions → Run workflow → `ingest` |
| Check for dead company boards | Actions → Run workflow → `verify` |
| Add companies | Edit `ingest/companies.js` |
| Post a newsletter issue | Edit `public/content.json` |
| Add a resource video | Edit `public/content.json` |
| Feature a paid listing | Edit `featured.json` |
| Change wording or prices | Edit `src/App.jsx` |

---

## ROUTE B — On your machine

Only worth it if you're making lots of small visual changes and want instant
preview. Install [Node 20+](https://nodejs.org) and [Git](https://git-scm.com), then:

```bash
npm install
npm run dev      # preview at localhost:5173
npm run ingest   # refresh jobs
npm run verify   # check company boards
npm test         # 125 checks
npm run build    # production build
```

Then push to GitHub and connect Netlify exactly as in A1 and A5 above.

---

## Collect submitted listings

The "Submit a free listing" form currently opens a pre-filled email. That works,
but submissions get buried in your inbox. Ten minutes to fix properly:

1. Sign up at [formspree.io](https://formspree.io) (free tier is plenty).
2. Create a form. Copy the endpoint — `https://formspree.io/f/xyzabc`.
3. In `src/App.jsx` (GitHub web editor is fine), find `LISTING_ENDPOINT` near
   the top and paste it in:
   ```js
   const LISTING_ENDPOINT = "https://formspree.io/f/xyzabc";
   ```
4. Commit and push.

Submissions now arrive as clean JSON emails. The form already validates the
apply link and requires a salary range, so what reaches you is usable.

---

## Launch checklist

Work through this before telling anyone:

- [ ] The ingest run kept a sensible number of roles
- [ ] Clicked Apply on 5 listings — every one landed on that exact job
- [ ] Clicked Company site on 3 listings — landed on the company, not the ATS
- [ ] Searched something specific, got sensible results
- [ ] Paged to page 2 and back
- [ ] Opened the site on your phone
- [ ] `BRAND.contactEmail` is an address you actually read
- [ ] Submitted a test listing through your own form
- [ ] Every Buy button on Templates goes to a live product page
- [ ] Newsletter signup is wired to a real provider (see below)
- [ ] GitHub Action ran green at least once
- [ ] Workflow permissions are set to read and write

---

## What to do in week one

Launching is the easy part. In rough order of value:

1. **Get to 300 companies.** A board with 29 roles isn't a destination. This is
   grunt work and it's the whole moat.
2. **Wire the newsletter properly** (next section). The list is the only asset
   you own — the board is rented from other people's ATS feeds.
3. **Post where CS people are.** r/CustomerSuccess, Gain Grow Retain, CS
   Insider, the Customer Success Collective Slack. Lead with the thing that's
   actually different: *nothing on this board is estimated.*
4. **Don't sell ads yet.** Get traffic first. A rate card with no audience
   behind it burns the relationship with the first advertiser you pitch.

---

# 2. Publish a newsletter

Two parts: sending the email, and listing it on the site.

## Sending it

The site does **not** send email. You need a provider. Any of these is fine:

| Provider | Free tier | Notes |
|---|---|---|
| **Beehiiv** | 2,500 subscribers | Built for newsletters, good referral tools |
| **Buttondown** | 100 subscribers | Cheapest, plain, writer-friendly |
| **ConvertKit** | 10,000 subscribers | Best if you're also selling products |
| **Substack** | Unlimited | Free, but they own the relationship |

Given you sell templates, **ConvertKit** or **Beehiiv** make the most sense.

### Connect the signup form

Right now the signup box just says thanks — it doesn't store anything. Fix it:

1. In your provider, find the **form endpoint** or **embed code** and copy the
   URL it posts to.
2. In `src/App.jsx`, find `RailNewsletter` and `NewsletterPage`. Both call
   `onSub()`. Replace that call with a POST to your endpoint:

   ```js
   await fetch("https://your-provider-endpoint", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ email }),
   });
   onSub();
   ```

3. Test with your own address before pushing.

If you'd rather not touch code: most providers give you a hosted signup page.
Point the button at that instead.

## Listing an issue on the site

**Option A — by hand (works in the browser).** Open `public/content.json` on
GitHub, click the pencil, and add an entry at the top of `issues`. Skip to
Option B below for the exact shape. This takes about thirty seconds per issue
and needs nothing installed.

**Option B — automatic (needs a terminal).** Every provider publishes an RSS
feed of sent issues. Point the included script at yours:

```bash
NEWSLETTER_FEED=https://yourpub.beehiiv.com/feed npm run newsletter
git add public/content.json && git commit -m "New issue" && git push
```

That's the whole workflow after every send. Feed URLs:

- Beehiiv — `https://yourpub.beehiiv.com/feed`
- Substack — `https://yourpub.substack.com/feed`
- Buttondown — `https://buttondown.com/yourname/rss`
- ConvertKit — `https://yourname.ck.page/posts/feed`
- Ghost — `https://yoursite.com/rss/`

The script pulls the title, date, link and an excerpt, strips the HTML, numbers
the issues, and writes them to `public/content.json`. It only touches the
`issues` array — your resources are left alone.

To avoid typing the URL each time, edit `NEWSLETTER_FEED` at the top of
`ingest/fetch-newsletter.js`.

**The shape of an issue entry** — for either option, add this to the top of
the `issues` array in `public/content.json`:

```json
{
  "n": 15,
  "date": "2026-09-18",
  "title": "The book size question nobody answers honestly",
  "teaser": "What 40 accounts actually means at three company sizes.",
  "url": "https://yourpub.beehiiv.com/p/book-size"
}
```

Commit and push. Live in about a minute.

- `n` is the issue number — highest first.
- `date` is `YYYY-MM-DD`. The site formats it for display.
- `url` empty means the title isn't clickable. Fine for an issue you haven't
  published yet.

---

# 3. Add free resource videos

Resources live in the same file — `public/content.json`, under `resources`.

## Step 1 — Upload the video

Put it on **YouTube** or **Loom**. Don't host video files yourself; they're
enormous and it'll wreck your load times.

On YouTube, set it to **Unlisted** if you only want it reachable from your site,
or **Public** if you want the YouTube search traffic too. Public is usually the
better call — it's a second discovery channel.

## Step 2 — Copy the link

Any of these formats work:

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
https://www.youtube.com/shorts/dQw4w9WgXcQ
```

The site pulls the thumbnail automatically. You don't need to make one.

## Step 3 — Add it to content.json

Find the group you want it in (or add a new one) and append an item:

```json
{
  "goal": "Get interviews",
  "items": [
    {
      "kind": "Video",
      "len": "12 min",
      "title": "Rewriting a CSM resume around retention numbers",
      "desc": "A line-by-line edit of a real resume that was getting no callbacks.",
      "url": "https://youtu.be/dQw4w9WgXcQ"
    }
  ]
}
```

Field by field:

| Field | What it does |
|---|---|
| `kind` | `Video`, `Guide`, or `Template`. Videos get a green tag and a thumbnail. |
| `len` | Shown as a small tag — `12 min`, `8 min read`. Optional. |
| `title` | The headline. Keep it to one line. |
| `desc` | One or two sentences on what they'll get. |
| `url` | Where it opens. **Leave empty and the card shows "Coming soon"** — useful for listing planned content without a dead link. |

## Step 4 — Publish

**In the browser:** on GitHub, open `public/content.json`, click the pencil
icon, paste your new item into the list, and click **Commit changes**.

**On your machine:**

```bash
git add public/content.json && git commit -m "Add resume video" && git push
```

Either way Netlify redeploys automatically. Check the site in about a minute.

### Adding a whole new section

Append another object to `resources`:

```json
{
  "goal": "Negotiate your offer",
  "items": [ ... ]
}
```

The `goal` is the section heading. Sections render in file order, so put the
most useful one first.

### A note on ordering

Resources are grouped by *what someone is trying to do*, not by content type.
That's deliberate — a laid-off CSM lands on that page with a specific problem,
and "Get interviews" finds them faster than "Videos" does. Keep that framing as
you add more.

---

## Everyday operations

Everything has a browser route and a terminal route. Use whichever suits you.

| Task | In the browser | In a terminal |
|---|---|---|
| Refresh the jobs | Actions → Run workflow → `ingest` | `npm run ingest` |
| Find dead company boards | Actions → Run workflow → `verify` | `npm run verify` |
| Drop salary-less roles | Actions → Run workflow → `ingest-strict` | `npm run ingest -- --strict` |
| Post a newsletter issue | Edit `public/content.json` | `npm run newsletter` |
| Add a resource video | Edit `public/content.json` | same |
| Feature a paid listing | Edit `featured.json` | same |
| Preview a change | Commit, wait ~90s | `npm run dev` |
| Check nothing broke | The Action runs tests for you | `npm test` |

The nightly Action runs the tests and a build before publishing, so a mistake
in `companies.js` or `content.json` gets caught before it reaches the live site
rather than after.
