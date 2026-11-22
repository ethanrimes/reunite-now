// Editorial snapshots. Dates describe the event; reviewedAt describes our source check.
export const reviewedAt = "2026-11-21";
export type PolicyEvent = {
  date: string;
  kind:
    | "Restriction"
    | "Court ruling"
    | "Court filing"
    | "Legislation"
    | "Processing change";
  title: string;
  text: string;
  status: string;
  source: { label: string; url: string };
};
export const news = {
  gomes: {
    date: "2026-07-31",
    kind: "Court ruling",
    title: "De Moura Gomes v. Rubio",
    text: "A D.C. judge ordered a fresh decision on a Brazilian investor’s EB-5 application within 60 days after a consular officer found it complete. The order applied to this family.",
    status: "Individual adjudication",
    source: {
      label: "Court opinion",
      url: "https://www.govinfo.gov/content/pkg/USCOURTS-dcd-1_26-cv-01883/pdf/USCOURTS-dcd-1_26-cv-01883-0.pdf",
    },
  },
  castillo: {
    date: "2026-10-14",
    kind: "Court ruling",
    title: "Castillo v. Rubio",
    text: "After an interview in El Salvador was postponed, a federal judge gave the State Department seven days to schedule Mr. Rivera Castillo’s interview and 30 days to hold it.",
    status: "Individual interview order",
    source: {
      label: "Court opinion",
      url: "https://law.justia.com/cases/federal/district-courts/illinois/ilndce/1:2026cv11422/508117/24/",
    },
  },
  stay: {
    date: "2026-10-19",
    kind: "Court ruling",
    title: "Appeal changes relief for earlier refusals",
    text: "A Second Circuit judge temporarily stayed the order requiring reconsideration of refusals based solely on the pause. The order striking down the 75-country policy stayed in effect.",
    status: "CLINIC v. Rubio",
    source: {
      label: "Appeals court order",
      url: "https://www.courtlistener.com/docket/74793181/50/catholic-legal-immigration-network-inc-v-rubio/",
    },
  },
  castilloClosed: {
    date: "2026-11-06",
    kind: "Court ruling",
    title: "Castillo case closes after visa issuance",
    text: "The plaintiffs reported visa issuance on October 29. On November 6 the court dismissed the case without prejudice at their request.",
    status: "Case closed",
    source: {
      label: "Court docket",
      url: "https://dockets.justia.com/docket/illinois/ilndce/1:2026cv11422/508117",
    },
  },
  aila: {
    date: "2026-11-17",
    kind: "Processing change",
    title: "What consulates ask before the interview",
    text: "AILA published examples of public-charge questions sent to applicants at six posts, including Kingston, Dakar and Madrid. The examples show what applicants at those posts received.",
    status: "Consular processing",
    source: {
      label: "AILA",
      url: "https://www.aila.org/library/sample-public-charge-questions-from-consular-posts",
    },
  },
  medani: {
    date: "2026-11-18",
    kind: "Court filing",
    title: "Medani plaintiffs seek enforcement",
    text: "Counsel for FY-2026 diversity visa applicants filed a motion to enforce the court’s order. Counsel lists a hearing for January 21, 2027.",
    status: "Medani v. Trump",
    source: {
      label: "Counsel’s updates and filings",
      url: "https://redeaglelaw.com/medani-v-trump",
    },
  },
  bill: {
    date: "2026-11-19",
    kind: "Legislation",
    title: "Reducing Visa Delays Act gains a cosponsor",
    text: "Rep. María Elvira Salazar joined Rep. Suhas Subramanyam as the first cosponsor of H.R. 10711. The bill remains before the House Judiciary and Foreign Affairs committees.",
    status: "In committee",
    source: {
      label: "GovInfo · official bill record",
      url: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr10711.xml",
    },
  },
  clinic: {
    date: "2026-11-20",
    kind: "Court filing",
    title: "CLINIC plaintiffs outline their next motion",
    text: "In a joint letter, plaintiffs proposed filing for preliminary relief on November 23 over the expanded public-charge procedures. The letter asks for a briefing schedule.",
    status: "CLINIC v. Rubio",
    source: {
      label: "Joint letter · ECF 138",
      url: "https://storage.courtlistener.com/recap/gov.uscourts.nysd.657161/gov.uscourts.nysd.657161.138.0.pdf",
    },
  },
} satisfies Record<string, PolicyEvent>;

export const policyEvents: PolicyEvent[] = [
  ...Object.values(news),
  {
    date: "2025-11-06",
    kind: "Processing change",
    title: "Broader public-charge screening",
    text: "CLINIC reports that a State Department cable expanded the factors officers consider in public-charge decisions. Those changes are now challenged in court.",
    status: "Challenged in CLINIC v. Rubio",
    source: {
      label: "CLINIC analysis",
      url: "https://www.cliniclegal.org/resources/ground-inadmissibility-and-deportability/public-charge/new-state-department-public-charge",
    },
  },
  {
    date: "2025-12-23",
    kind: "Restriction",
    title: "Diversity visa issuance paused",
    text: "The State Department announced a pause on diversity visa issuance for a screening review. Its updated notice says the pause ended under a court order on August 28, 2026.",
    status: "Pause later vacated",
    source: {
      label: "State Department notice",
      url: "https://travel.state.gov/en/newsroom/visas/2025/diversity-visa-issuance-updated-guidance.html",
    },
  },
  {
    date: "2026-01-01",
    kind: "Restriction",
    title: "Entry and visa restrictions expanded",
    text: "Proclamation 10998 imposed full or partial restrictions covering 39 countries and Palestinian Authority travel documents, with exceptions. These restrictions are separate from the later 75-country pause.",
    status: "Separate proclamation restrictions",
    source: {
      label: "State Department notice",
      url: "https://travel.state.gov/en/newsroom/visas/2026/suspension-of-visa-issuance-to-foreign-nationals-to-protect-the-security-of-the-united-states.html",
    },
  },
  {
    date: "2026-01-21",
    kind: "Restriction",
    title: "75-country immigrant visa pause begins",
    text: "The State Department stopped issuing immigrant visas to nationals of 75 countries under its public-charge review. The policy did not cover tourist visas.",
    status: "Vacated August 21, 2026",
    source: {
      label: "State Department notice",
      url: "https://travel.state.gov/en/newsroom/visas/2026/immigrant-visa-processing-updates-for-nationalities-at-high-risk-of-public-benefits-usage.html",
    },
  },
  {
    date: "2026-08-21",
    kind: "Court ruling",
    title: "Court sets aside the 75-country pause",
    text: "The CLINIC ruling vacated the policy and refusals based solely on it. Cases must receive individual consideration; the ruling does not guarantee a visa.",
    status: "Return to individual adjudication",
    source: {
      label: "CLINIC applicant roadmap",
      url: "https://www.nilc.org/resources/clinic-v-rubio-the-75-country-visa-pause-was-vacated-what-happens-now/",
    },
  },
  {
    date: "2026-08-28",
    kind: "Court ruling",
    title: "Diversity visa pause set aside",
    text: "The State Department says the diversity visa issuance pause is no longer in effect following the Medani order. Further implementation disputes followed.",
    status: "Medani v. Trump",
    source: {
      label: "State Department notice",
      url: "https://travel.state.gov/en/newsroom/visas/2025/diversity-visa-issuance-updated-guidance.html",
    },
  },
  {
    date: "2026-09-08",
    kind: "Processing change",
    title: "Training extends interview cancellations",
    text: "NILC reports that the government acknowledged worldwide immigrant visa appointment cancellations through September for public-charge training, without a fixed timetable for reconsidering affected cases.",
    status: "Timetable and progress sought",
    source: {
      label: "NILC case update",
      url: "https://www.nilc.org/litigation/clinic-v-rubio/",
    },
  },
  {
    date: "2026-09-10",
    kind: "Processing change",
    title: "Resume processing—with new requirements",
    text: "CLINIC reports that a new cable directed posts to resume adjudication while requiring public-charge training and an applicant worksheet. Its later guidance describes interviews resuming under the new requirements.",
    status: "Public reporting still needed",
    source: {
      label: "CLINIC analysis",
      url: "https://www.cliniclegal.org/resources/ground-inadmissibility-and-deportability/public-charge/new-state-department-public-charge",
    },
  },
];

export const participation = [
  {
    title: "Sign for congressional oversight",
    text: "We especially need US citizens to sign and ask their members of Congress to demand answers. Supporters of other citizenships are welcome too.",
    action: "Sign the petition",
    to: "/login?intent=sign",
    icon: "signature",
  },
  {
    title: "Add your visa timeline",
    text: "Your dates help build a community record of real waits by visa category and consular post. Keep it current, even when nothing has changed.",
    action: "Add a timeline",
    to: "/account",
    icon: "timeline",
  },
  {
    title: "Share your story and photos",
    text: "Show what the delay means for your family: time apart, missed milestones, travel and extra costs. Share only what you have permission to publish.",
    action: "Share your story",
    to: "/account#story",
    icon: "story",
  },
  {
    title: "Ask the CLINIC legal team",
    text: "If the pause affected you or a family member, NILC lists a litigation email for questions. Ask how to share your experience before sending documents.",
    action: "Find the litigation contact",
    to: "https://www.nilc.org/resources/questions-and-answers-about-the-75-country-visa-ban-lawsuit/",
    icon: "mail",
  },
  {
    title: "Report a consular delay",
    text: "Red Eagle Law is collecting interest in a potential group lawsuit. Its form asks for your post, visa category and interview date, if available.",
    action: "Open the interest form",
    to: "https://fs11.formsite.com/HVzA9z/7rkawruze1/index",
    icon: "mail",
  },
  {
    title: "Share a frontline provider’s experience",
    text: "Protecting Immigrant Families asks providers how public-charge rules affect the families they serve. Its form explains consent and asks you to omit client identifiers.",
    action: "Open the provider form",
    to: "https://pifcoalition.org/forms/story-collection-form/",
    icon: "mail",
  },
];
