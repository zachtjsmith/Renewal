/* ============================================================================
   classify.js — deciding what belongs on the board
   ----------------------------------------------------------------------------
   A niche board dies from false positives. "Software Engineer, Customer
   Success Platform" is an engineering job. "Account Executive" is sales.
   "Customer Support Specialist" is support, not success. All three will show
   up in a naive keyword match, so exclusions run before inclusions here.
   ========================================================================== */

/* --- hard exclusions: checked first, on the TITLE only -------------------- */

const EXCLUDE_TITLE = [
  // other functions that happen to contain our keywords
  /\b(software|staff|senior staff|principal|backend|front-?end|full-?stack|platform|data|ml|qa|test|security|devops|site reliability|sre)\s+engineer\b/i,
  /\bengineer(ing)?\s+(manager|lead|director)\b/i,
  /\b(product|program|project|engineering|marketing|brand|content|community|social)\s+manager\b/i,
  /\b(ux|ui|product|graphic|visual|web)\s+designer\b/i,
  /\b(data|business|financial|research|marketing)\s+analyst\b/i,
  /\baccount executive\b/i,
  /\b(sdr|bdr|sales development|business development)\b/i,
  /\bsales\s+(rep|representative|manager|director|lead|engineer|associate)\b/i,
  /\brecruiter\b|\btalent\b|\bpeople partner\b/i,
  /\b(accounting|accounts payable|accounts receivable|payroll)\b/i,
  /\baccount(ing)? (clerk|assistant|coordinator, finance)\b/i,
  // support roles — adjacent, but a different job and a different board
  /\b(technical support|customer support|support)\s+(engineer|specialist|representative|rep|agent|advisor|analyst)\b/i,
  /\bhelp ?desk\b|\bservice desk\b|\bcall cent(er|re)\b/i,
  /\b(tier|level)\s*[123]\b/i,
  // not employment
  /\bintern(ship)?\b|\bco-?op\b|\bapprentice\b|\bcontract(or)?\b|\bfreelance\b|\btemp(orary)?\b|\bvolunteer\b/i,
];

/* --- inclusions, most specific first ------------------------------------- */

const FAMILY_RULES = [
  {
    family: "CS Operations",
    patterns: [
      /\b(customer success|cs|client success|revenue|post-?sales)\s*(ops|operations)\b/i,
      /\b(ops|operations)\s*(manager|analyst|lead|specialist|director)\b.*\b(customer success|client success|post-?sales)\b/i,
      /\bcs ?ops\b/i,
      /\bcustomer (experience|success) (systems|platform|enablement|programs?|strategy)\b/i,
    ],
  },
  {
    family: "Renewals",
    patterns: [
      /\brenewals?\b/i,
      /\bretention (manager|specialist|lead)\b/i,
      /\bsubscription (manager|specialist)\b/i,
    ],
  },
  {
    family: "Onboarding",
    patterns: [
      /\bonboarding\b/i,
      /\bimplementation (manager|specialist|consultant|lead|engineer)\b/i,
      /\b(customer|client) (launch|activation|deployment)\b/i,
      /\bprofessional services (consultant|manager)\b/i,
    ],
  },
  {
    family: "Leadership",
    // A bare "Lead" is deliberately NOT here. In CS, "Client Success Lead" is
    // usually a senior individual contributor, not a people manager — only
    // "Team Lead", "Head of", "Director" and above reliably mean reports.
    patterns: [
      /\b(vp|vice president|head|director|senior director|chief)\b.*\b(customer success|client success|customer experience|account management|post-?sales|customer)\b/i,
      /\b(customer success|client success|account management)\b.*\b(director|vp|vice president|head of)\b/i,
      /\b(team|group)\s+lead\b.*\b(customer|client) success\b/i,
      /\b(customer|client) success\b.*\b(team|group)\s+lead\b/i,
      /\bmanager,? (customer success|client success|account management)\b/i,
      /\b(customer success|client success) (manager of managers|senior manager)\b/i,
    ],
  },
  {
    family: "Account Management",
    patterns: [
      /\b(strategic|enterprise|technical|senior|key|global|named|partner|channel)?\s*account (manager|management|director|lead)\b/i,
      /\bclient (partner|director|relationship manager)\b/i,
      /\brelationship manager\b/i,
      /\bpartner (success|manager)\b/i,
    ],
  },
  {
    family: "Customer Success",
    patterns: [
      /\b(customer|client) success\b/i,
      /\bcsm\b/i,
      /\bcustomer (experience|engagement|advocacy|outcomes) (manager|lead|specialist)\b/i,
      /\bcustomer success (architect|consultant|advisor|engineer|associate|specialist)\b/i,
      /\bvalue (consultant|engineer)\b/i,
      /\bcustomer (growth|retention) manager\b/i,
    ],
  },
];

/* --- seniority ----------------------------------------------------------- */

const SENIORITY = [
  { level: "Executive", re: /\b(chief|cco|vp|vice president|head of)\b/i },
  { level: "Director", re: /\b(senior director|director)\b/i },
  { level: "Manager", re: /\b(manager of|senior manager|team lead|people manager)\b/i },
  { level: "Senior", re: /\b(senior|sr\.?|staff|principal|lead|strategic|enterprise)\b/i },
  { level: "Entry", re: /\b(associate|junior|jr\.?|coordinator|entry|i\b|analyst)\b/i },
];

export function seniority(title) {
  for (const s of SENIORITY) if (s.re.test(title)) return s.level;
  return "Mid";
}

/* --- segment ------------------------------------------------------------- */

/**
 * Market segment — ONLY when the posting says so. Returns null otherwise.
 *
 * This used to fall back on book size and then default to "Mid-Market", which
 * meant most listings displayed a segment nobody had written down. A null that
 * the UI hides is better than a plausible guess the reader will believe.
 */
export function segment(title, text) {
  const t = String(title || "");
  const body = String(text || "").slice(0, 6000);

  if (/\b(enterprise|strategic accounts?|global accounts?|major accounts?|key accounts?)\b/i.test(t)) return "Enterprise";
  if (/\bmid-?market\b/i.test(t)) return "Mid-Market";
  if (/\b(smb|small business|small-?to-?medium)\b/i.test(t)) return "SMB";

  // Body mentions must be about the book, not a passing reference.
  const scoped = /\b(book|portfolio|segment|accounts?|customers?|clients?)\b[^.\n]{0,60}/gi;
  let m;
  while ((m = scoped.exec(body)) !== null) {
    const win = body.slice(Math.max(0, m.index - 80), m.index + m[0].length + 40);
    if (/\bmid-?market\b/i.test(win)) return "Mid-Market";
    if (/\benterprise\b/i.test(win)) return "Enterprise";
    if (/\b(smb|small business)\b/i.test(win)) return "SMB";
  }
  return null;
}

/* --- the main gate ------------------------------------------------------- */

/**
 * Decide whether a posting belongs on the board.
 * @returns {{ keep: boolean, family?: string, reason?: string }}
 */
export function classify({ title, department = "", text = "" }) {
  const t = String(title || "").trim();
  if (!t) return { keep: false, reason: "no title" };

  for (const re of EXCLUDE_TITLE) {
    if (re.test(t)) return { keep: false, reason: "excluded title: " + re.source.slice(0, 40) };
  }

  for (const rule of FAMILY_RULES) {
    if (rule.patterns.some((p) => p.test(t))) {
      return { keep: true, family: rule.family, reason: "title match" };
    }
  }

  // Department is a weaker signal: only trust it when the title is also
  // customer-facing, otherwise a whole CS department's designers get in.
  const dept = String(department || "");
  const deptIsCS = /\b(customer success|client success|customer experience|account management|post-?sales|renewals|customer operations)\b/i.test(dept);
  const titleIsCustomerFacing = /\b(customer|client|account|success|renewal|onboarding|adoption|retention)\b/i.test(t);
  if (deptIsCS && titleIsCustomerFacing) {
    for (const rule of FAMILY_RULES) {
      if (rule.patterns.some((p) => p.test(t + " " + dept))) {
        return { keep: true, family: rule.family, reason: "department + title" };
      }
    }
    return { keep: true, family: "Customer Success", reason: "department fallback" };
  }

  return { keep: false, reason: "no CS signal" };
}
