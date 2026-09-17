/* ============================================================================
   classify.js — deciding what belongs on the board
   ----------------------------------------------------------------------------
   Three tiers, checked in this order:

     1. EXCLUDE_TITLE    other functions that happen to contain our keywords.
                         Runs first and always wins.
     2. FAMILY_RULES     titles that are unambiguously customer success.
                         First match wins, so the order of families matters.
     3. DEPARTMENT_GATED generic titles that only count when the posting says
                         they sit in a customer-facing org.

   A niche board dies from false positives. "Software Engineer, Customer
   Success Platform" is an engineering job, "Account Executive" is sales, and
   "Customer Service Representative" is a call centre — all three show up in a
   naive keyword match, which is why exclusions run before inclusions.
   ========================================================================== */

/* --- 1. hard exclusions: checked first, on the TITLE only ----------------- */

const EXCLUDE_TITLE = [
  // other functions that happen to contain our keywords
  /\b(software|staff|senior staff|principal|backend|front-?end|full-?stack|platform|data|ml|qa|test|security|devops|site reliability|sre|sales|solutions|solution|support)\s+engineer\b/i,
  /\bengineer(ing)?\s+(manager|lead|director)\b/i,
  /\b(product|program|project|engineering|marketing|brand|content|community|social|events?|product marketing)\s+manager\b/i,
  /\b(ux|ui|product|graphic|visual|web)\s+designer\b/i,
  /\b(data|business|financial|research|marketing|security|systems)\s+analyst\b/i,
  /\baccount executive\b/i,
  /\b(sdr|bdr|sales development|business development)\b/i,
  /\bsales\s+(rep|representative|manager|director|lead|associate|specialist|consultant)\b/i,
  /\brecruiter\b|\btalent\b|\bpeople partner\b|\bhr business partner\b/i,
  /\b(accounting|accounts payable|accounts receivable|payroll|bookkeep)/i,

  // support and call-centre roles — adjacent, but a different job and a
  // different board. Note "customer service" is excluded while "client
  // services" is kept: in SaaS they mean genuinely different functions.
  /\b(technical support|customer support|product support|support)\s+(engineer|specialist|representative|rep|agent|advisor|analyst|associate|coordinator|manager|lead|supervisor)\b/i,
  /\bcustomer service\s+(representative|rep|agent|associate|advisor|advocate|specialist|coordinator|manager|supervisor|lead|director|trainee|assistant)\b/i,
  /\bcustomer care\s+(representative|rep|agent|associate|advisor|specialist|coordinator)\b/i,
  /\b(patient|member) services?\s+(representative|rep|coordinator|assistant)\b/i,
  /\bhelp ?desk\b|\bservice desk\b|\bcall cent(er|re)\b|\bcontact cent(er|re)\b/i,
  /\b(tier|level)\s*[123]\b/i,

  // not the kind of employment this board lists
  /\bintern(ship)?\b|\bco-?op\b|\bapprentice\b|\bcontract(or)?\b|\bfreelance\b|\btemp(orary)?\b|\bvolunteer\b|\bfellow(ship)?\b/i,
];

/* --- 2. inclusions, most specific family first --------------------------- *
   Order matters: "Customer Success Operations Manager" must reach CS
   Operations before the broad Customer Success rule swallows it.            */

const FAMILY_RULES = [
  {
    family: "CS Operations",
    patterns: [
      /\b(customer success|cs|client success|client services?|post-?sales|customer)\s*(ops|operations)\b/i,
      /\bcs ?ops\b/i,
      /\b(ops|operations)\s*(manager|analyst|lead|specialist|director|associate)\b.*\b(customer success|client success|post-?sales)\b/i,
      /\bcustomer (experience|success)\s+(systems|platform|enablement|programs?|strategy|analytics|insights|operations)\b/i,
      /\b(customer success|client success)\s+(program|project)\s+manager\b/i,
    ],
  },
  {
    family: "Renewals",
    patterns: [
      /\brenewals?\b/i,
      /\bretention\s+(manager|specialist|lead|analyst|director|associate)\b/i,
      /\bsubscription\s+(manager|specialist|analyst)\b/i,
      /\bchurn\s+(manager|specialist|analyst)\b/i,
    ],
  },
  {
    family: "Onboarding",
    patterns: [
      /\bonboarding\b/i,
      /\bimplementation\s+(manager|specialist|consultant|lead|engineer|analyst|coordinator|director|architect|associate)\b/i,
      /\b(customer|client|merchant|partner|user|member|provider|seller)\s+(launch|activation|deployment|implementation|integration)\b/i,
      /\bprofessional services\s+(consultant|manager|engineer|specialist|director|analyst)\b/i,
      /\b(deployment|activation|launch|integration)\s+(manager|specialist|consultant)\b/i,
      /\btechnical\s+(implementation|onboarding|delivery)\b/i,
      /\b(delivery|engagement)\s+consultant\b/i,
    ],
  },
  {
    family: "Leadership",
    // A bare "Lead" is deliberately NOT here. In CS, "Client Success Lead" is
    // usually a senior individual contributor, not a people manager — only
    // "Team Lead", "Head of", "Director" and above reliably mean reports.
    patterns: [
      /\b(vp|svp|evp|vice president|head|director|senior director|chief)\b.*\b(customer|client|merchant|member|partner|user)\s*(success|experience|services?|outcomes?|operations|engagement|advocacy|retention)\b/i,
      /\b(customer|client)\s*(success|experience|services?|outcomes?)\b.*\b(director|vp|svp|evp|vice president|head of)\b/i,
      /\bchief (customer|client|revenue retention) officer\b/i,
      /\bhead of (customer|client|post-?sales|retention|renewals?|accounts?)\b/i,
      /\b(team|group)\s+lead\b.*\b(customer|client)\s*success\b/i,
      /\b(customer|client)\s*success\b.*\b(team|group)\s+lead\b/i,
      /\b(senior )?manager,?\s+(of\s+)?(customer|client|merchant|partner)\s*(success|experience|services?|operations|outcomes?)\b/i,
      /\b(customer|client) success\s+(manager of managers|senior manager)\b/i,
      /\bdirector,?\s+(of\s+)?(account management|renewals?|onboarding|implementation)\b/i,
    ],
  },
  {
    family: "Account Management",
    patterns: [
      /\b(strategic|enterprise|technical|senior|key|global|named|partner|channel|corporate|commercial|mid-?market|smb|major)?\s*account\s+(manager|management|director|lead|partner|executive director)\b/i,
      /\b(client|customer)\s+(partner|director)\b/i,
      /\b(client|customer|partner)\s+(relations|relationship)\s+(manager|specialist|lead|director)\b/i,
      /\b(partner|channel|alliance)\s+manager\b/i,   // NB: not 'Partner Success Manager' — that's CS
      /\bbook of business manager\b/i,
    ],
  },
  {
    family: "Customer Success",
    patterns: [
      // The broad net. Covers merchant / member / seller / provider / partner
      // success — industry-specific names for the same job. Marketplaces,
      // healthtech and ecommerce platforms all use these instead of "customer".
      /\b(customer|client|merchant|member|seller|provider|partner|user|practice|subscriber|advertiser|brand|dealer|franchise|borrower|policyholder)\s+success\b/i,
      /\bcsm\b/i,
      /\bcustomer success\b/i,
      /\bclient services?\b/i,

      // outcome- and value-framed variants
      /\b(customer|client)\s+outcomes?\s+(manager|lead|specialist|director|consultant)\b/i,
      /\b(business\s+)?value\s+(consultant|engineer|manager|advisor|architect|realization)\b/i,
      /\bvalue realization\b/i,

      // experience / adoption / advocacy variants
      /\b(customer|client|member|user)\s+(experience|engagement|advocacy|adoption|growth|retention|enablement|education|insights|marketing)\s+(manager|lead|specialist|consultant|partner|director|associate|analyst|architect)\b/i,
      /\bcx\s+(manager|lead|specialist|director|consultant)\b/i,
      /\b(adoption|advocacy|enablement)\s+(manager|specialist|consultant)\b/i,
      /\btechnical success\s+(manager|engineer|consultant)\b/i,
      /\b(customer|client)\s+(advocate|champion)\b/i,
    ],
  },
];

/* --- 3. department-gated titles ------------------------------------------ *
   Titles that are a CS role ONLY when the posting says they sit in a CS org.
   "Project Coordinator" is a genuine onboarding role inside a Customer Success
   team and a construction job everywhere else — the words carry no signal on
   their own. Matching them unconditionally across hundreds of companies would
   bury the board in roles that have nothing to do with customer success.     */

const DEPARTMENT_GATED = [
  {
    family: "Onboarding",
    patterns: [
      /\bproject\s+(coordinator|manager|specialist|lead)\b/i,
      /\bprogram\s+(coordinator|manager)\b/i,
      /\bdelivery\s+(coordinator|manager|lead)\b/i,
      /\b(solutions?|technical|senior)\s+consultant\b/i,
      /\bengagement\s+(manager|director|lead)\b/i,
    ],
  },
  {
    family: "CS Operations",
    patterns: [
      /\b(revenue|business|sales)\s+operations\b/i,
      /\boperations\s+(analyst|manager|specialist|coordinator)\b/i,
      /\bsystems\s+(administrator|analyst)\b/i,
    ],
  },
  {
    family: "Customer Success",
    patterns: [
      /\bmarketing\s+coordinator\b/i,
      /\b(engagement|relationship|account|client|customer)\s+coordinator\b/i,
      /\bcoordinator\b/i,
      /\bassociate\b/i,
      /\bspecialist\b/i,
      /\banalyst\b/i,
    ],
  },
];

/* Departments that make a generic title count as customer success. */
const CS_DEPARTMENT =
  /\b(customer success|client success|client services?|customer experience|account management|post-?sales|renewals?|customer operations|professional services|customer care|customer engagement|merchant success|partner success|member success|revenue|go-?to-?market|gtm)\b/i;

/* --- seniority ----------------------------------------------------------- */

const SENIORITY = [
  { level: "Executive", re: /\b(chief|cco|vp|svp|evp|vice president|head of)\b/i },
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

  const dept = String(department || "");
  const deptIsCS = CS_DEPARTMENT.test(dept);

  // Generic titles that only count inside a customer success org.
  if (deptIsCS) {
    for (const rule of DEPARTMENT_GATED) {
      if (rule.patterns.some((p) => p.test(t))) {
        return { keep: true, family: rule.family, reason: `generic title, rescued by department "${dept}"` };
      }
    }
  }

  // Department is a weaker signal: only trust it when the title is also
  // customer-facing, otherwise a whole CS department's designers get in.
  const titleIsCustomerFacing =
    /\b(customer|client|account|success|renewal|onboarding|adoption|retention|merchant|member|partner|subscriber)\b/i.test(t);
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
