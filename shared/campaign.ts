// Editorial snapshots. Dates describe the event; reviewedAt describes our source check.
export const reviewedAt = "2026-11-12";
export type PolicyEvent = {
  date: string;
  kind: "Restriction" | "Court ruling" | "Processing change";
  title: string;
  text: string;
  status: string;
  source: { label: string; url: string };
};
export const policyEvents: PolicyEvent[] = [
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
];
