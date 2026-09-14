/* ============================================================================
   companies.js — the source list
   ----------------------------------------------------------------------------
   This is the actual asset of the business. The code is replaceable; a curated
   list of 400 SaaS companies that hire CS people is not.

   Each entry:
     ats       "greenhouse" | "lever" | "ashby" | "workable"
     token     the board slug in the ATS URL (see below)
     name      display name on the board
     industry  shown next to the company name — ATS feeds never provide this
     stack     optional fallback tools, used only if none are found in the text

   HOW TO FIND A TOKEN
     Greenhouse  job-boards.greenhouse.io/TOKEN      or boards.greenhouse.io/TOKEN
     Lever       jobs.lever.co/TOKEN
     Ashby       jobs.ashbyhq.com/TOKEN
     Workable    apply.workable.com/TOKEN

   Open any company's careers page, look at where "Apply" sends you, and the
   slug is right there in the URL. That is the entire research process.

   The list below is a STARTER SET to get you running today. Tokens change when
   companies migrate ATS, so run `npm run verify` before you trust it — it pings
   every board and tells you which ones are dead, so you can prune and replace.
   ========================================================================== */

export const COMPANIES = [
  // ---- Greenhouse ------------------------------------------------------
  { ats: "greenhouse", token: "figma", name: "Figma", industry: "Design software" , site: "https://www.figma.com" },
  { ats: "greenhouse", token: "databricks", name: "Databricks", industry: "Data platform" , site: "https://www.databricks.com" },
  { ats: "greenhouse", token: "airtable", name: "Airtable", industry: "Productivity" , site: "https://www.airtable.com" },
  { ats: "greenhouse", token: "gitlab", name: "GitLab", industry: "Developer tools" , site: "https://about.gitlab.com" },
  { ats: "greenhouse", token: "hashicorp", name: "HashiCorp", industry: "Infrastructure" , site: "https://www.hashicorp.com" },
  { ats: "greenhouse", token: "cloudflare", name: "Cloudflare", industry: "Internet infrastructure" , site: "https://www.cloudflare.com" },
  { ats: "greenhouse", token: "samsara", name: "Samsara", industry: "IoT / fleet" , site: "https://www.samsara.com" },
  { ats: "greenhouse", token: "amplitude", name: "Amplitude", industry: "Product analytics" , site: "https://amplitude.com" },
  { ats: "greenhouse", token: "benchling", name: "Benchling", industry: "Life sciences" , site: "https://www.benchling.com" },
  { ats: "greenhouse", token: "checkr", name: "Checkr", industry: "Background checks" , site: "https://checkr.com" },
  { ats: "greenhouse", token: "gusto", name: "Gusto", industry: "Payroll / HR" , site: "https://gusto.com" },
  { ats: "greenhouse", token: "instacart", name: "Instacart", industry: "Grocery delivery" , site: "https://www.instacart.com" },
  { ats: "greenhouse", token: "lattice", name: "Lattice", industry: "HR software" , site: "https://lattice.com" },
  { ats: "greenhouse", token: "mixpanel", name: "Mixpanel", industry: "Product analytics" , site: "https://mixpanel.com" },
  { ats: "greenhouse", token: "sentry", name: "Sentry", industry: "Developer tools" , site: "https://sentry.io" },
  { ats: "greenhouse", token: "vimeo", name: "Vimeo", industry: "Video" , site: "https://vimeo.com" },
  { ats: "greenhouse", token: "webflow", name: "Webflow", industry: "Web builder" , site: "https://webflow.com" },
  { ats: "greenhouse", token: "grammarly", name: "Grammarly", industry: "Writing software" , site: "https://www.grammarly.com" },
  { ats: "greenhouse", token: "flexport", name: "Flexport", industry: "Logistics" , site: "https://www.flexport.com" },
  { ats: "greenhouse", token: "airbnb", name: "Airbnb", industry: "Travel" , site: "https://www.airbnb.com" },

  // ---- Lever -----------------------------------------------------------
  { ats: "lever", token: "attentive", name: "Attentive", industry: "SMS marketing" , site: "https://www.attentive.com" },
  { ats: "lever", token: "verkada", name: "Verkada", industry: "Physical security" , site: "https://www.verkada.com" },
  { ats: "lever", token: "kajabi", name: "Kajabi", industry: "Creator platform" , site: "https://kajabi.com" },
  { ats: "lever", token: "matterport", name: "Matterport", industry: "3D capture" , site: "https://matterport.com" },
  { ats: "lever", token: "spotify", name: "Spotify", industry: "Audio streaming" , site: "https://www.spotify.com" },
  { ats: "lever", token: "showpad", name: "Showpad", industry: "Sales enablement" , site: "https://www.showpad.com" },
  { ats: "lever", token: "bevy", name: "Bevy", industry: "Community software" , site: "https://bevy.com" },
  { ats: "lever", token: "netlify", name: "Netlify", industry: "Web infrastructure" , site: "https://www.netlify.com" },

  // ---- Ashby -----------------------------------------------------------
  { ats: "ashby", token: "ramp", name: "Ramp", industry: "Corporate cards" , site: "https://ramp.com" },
  { ats: "ashby", token: "linear", name: "Linear", industry: "Issue tracking" , site: "https://linear.app" },
  { ats: "ashby", token: "vanta", name: "Vanta", industry: "Compliance" , site: "https://www.vanta.com" },
  { ats: "ashby", token: "deel", name: "Deel", industry: "Global payroll" , site: "https://www.deel.com" },
  { ats: "ashby", token: "clay", name: "Clay", industry: "GTM data" , site: "https://www.clay.com" },
  { ats: "ashby", token: "posthog", name: "PostHog", industry: "Product analytics" , site: "https://posthog.com" },
  { ats: "ashby", token: "runway", name: "Runway", industry: "AI video" , site: "https://runwayml.com" },
  { ats: "ashby", token: "mercury", name: "Mercury", industry: "Business banking" , site: "https://mercury.com" },
  { ats: "ashby", token: "replit", name: "Replit", industry: "Developer tools" , site: "https://replit.com" },
  { ats: "ashby", token: "warp", name: "Warp", industry: "Developer tools" , site: "https://www.warp.dev" },

  // ---- Workable --------------------------------------------------------
  { ats: "workable", token: "workable", name: "Workable", industry: "Recruiting software" , site: "https://www.workable.com" },
  { ats: "workable", token: "epignosis", name: "Epignosis", industry: "Learning software" , site: "https://www.epignosishq.com" },
  { ats: "workable", token: "blueground", name: "Blueground", industry: "Furnished rentals" , site: "https://www.theblueground.com" },
];

/* Convenience: add your own without editing the array above. */
export function withExtra(extra = []) {
  return [...COMPANIES, ...extra];
}
