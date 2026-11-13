export type Policy = {
  id: string;
  kind: "Legislation" | "Legal case";
  title: string;
  eyebrow: string;
  status: string;
  theme: string;
  summary: string;
  background: string;
  goals: string[];
  updated: string;
  timeline: { date: string; title: string; text: string }[];
  sources: { label: string; url: string }[];
  contact?: { label: string; url: string };
  contribute: string;
};
export const policies: Policy[] = [
  {
    id: "reducing-visa-delays-act",
    kind: "Legislation",
    title: "Reducing Visa Delays Act",
    eyebrow: "H.R. 10711 · 119th Congress",
    status: "In committee",
    theme: "Transparency",
    summary:
      "A clearer picture of visa wait times. A plan to give consular teams the resources they need.",
    background:
      "Introduced by Rep. Suhas Subramanyam on October 1, 2026, H.R. 10711 proposes reporting on consular staffing and technology, a review of social-media vetting, monthly post-interview wait-time publication, and a staffing strategy. It is a proposal, not enacted law.",
    goals: [
      "Publish monthly post-interview processing times by post and visa category, with explanations.",
      "Report to Congress on staffing, technology, resources, and the effects of social-media vetting.",
      "Develop a strategy to increase consular staffing and reduce delays.",
    ],
    updated: "2026-11-11",
    timeline: [
      {
        date: "2026-09-30",
        title: "Legislative package announced",
        text: "Rep. Subramanyam announced three bills addressing visa delays and emergency responses.",
      },
      {
        date: "2026-10-01",
        title: "Introduced in the House",
        text: "H.R. 10711 was referred to the Judiciary and Foreign Affairs committees.",
      },
    ],
    sources: [
      {
        label: "Official bill text · GovInfo",
        url: "https://www.govinfo.gov/content/pkg/BILLS-119hr10711ih/html/BILLS-119hr10711ih.htm",
      },
      {
        label: "Actions and votes · Congress.gov",
        url: "https://www.congress.gov/bill/119th-congress/house-bill/10711/all-actions",
      },
      {
        label: "Sponsor’s announcement",
        url: "https://subramanyam.house.gov/media/press-releases/rep-subramanyam-announces-legislation-reduce-visa-processing-backlogs-and",
      },
    ],
    contact: {
      label: "Contact Rep. Subramanyam",
      url: "https://subramanyam.house.gov/contact",
    },
    contribute:
      "Ask your House representative to review and cosponsor H.R. 10711. Describe how delays affect your family and why consistent reporting matters. Petition signatures here are not automatically sent to Congress.",
  },
  {
    id: "clinic-v-rubio",
    kind: "Legal case",
    title: "CLINIC v. Rubio",
    eyebrow: "1:26-cv-00858 · Southern District of New York",
    status: "Active litigation",
    theme: "Accountability",
    summary:
      "Challenging categorical barriers to immigrant visas and seeking lawful, individual decisions.",
    background:
      "This litigation challenges the 75-country immigrant visa policy and related public-charge practices. The court vacated the challenged pause on August 21, 2026. Relief does not guarantee a visa or eliminate independent grounds of inadmissibility. NILC’s case page was updated November 9, 2026; consult the linked filings for the current procedural position.",
    goals: [
      "Restore individualized adjudication under immigration law.",
      "Seek implementation of relief for refusals based solely on the challenged policy.",
      "Challenge unlawful public-charge barriers to immigrant visa processing.",
    ],
    updated: "2026-11-11",
    timeline: [
      {
        date: "2026-01-21",
        title: "Challenged policy took effect",
        text: "The State Department stopped issuing immigrant visas under the challenged 75-country policy.",
      },
      {
        date: "2026-08-21",
        title: "Court vacated the policy",
        text: "The court set aside the policy and sole-policy refusals; other legal grounds may still apply.",
      },
      {
        date: "2026-09-30",
        title: "Applicant roadmap published",
        text: "CLINIC’s roadmap, hosted by NILC, explains the ruling and limits of relief.",
      },
      {
        date: "2026-11-06",
        title: "Amended complaint filed",
        text: "Plaintiffs challenged an expanded worldwide public-charge visa-processing regime. The allegations and requested relief are described in the amended complaint.",
      },
    ],
    sources: [
      {
        label: "Case updates and filings · NILC",
        url: "https://www.nilc.org/litigation/clinic-v-rubio/",
      },
      {
        label: "Applicant roadmap · NILC / CLINIC",
        url: "https://www.nilc.org/resources/clinic-v-rubio-the-75-country-visa-pause-was-vacated-what-happens-now/",
      },
      {
        label: "Questions and contact details · NILC",
        url: "https://www.nilc.org/resources/questions-and-answers-about-the-75-country-visa-ban-lawsuit/",
      },
    ],
    contact: {
      label: "BlanketVisaBanLitigation@nilc.org",
      url: "mailto:BlanketVisaBanLitigation@nilc.org",
    },
    contribute:
      "NILC’s FAQ provides this email for affected people with questions. Keep notices, communications, and dates. Contact counsel directly before sending sensitive records; publishing a story here does not submit it to counsel or join the lawsuit.",
  },
  {
    id: "syed-v-trump",
    kind: "Legal case",
    title: "Syed v. Trump",
    eyebrow: "75-country pause litigation",
    status: "Status needs verification",
    theme: "Accountability",
    summary:
      "A separate class-action effort concerning immigrant visa applicants affected by the 75-country pause.",
    background:
      "Red Eagle Law has discussed Syed v. Trump as a class-action challenge to the 75-country suspension in the Central District of California. We have not independently verified the latest docket orders. The linked counsel resources describe the project; they are not a promise of relief or an invitation to join.",
    goals: [
      "Challenge the 75-country suspension through a separate litigation strategy.",
      "Seek relief for affected applicants, subject to court decisions on scope and class certification.",
    ],
    updated: "2026-11-11",
    timeline: [
      {
        date: "2026-08-17",
        title: "Counsel discussed pending motions",
        text: "Counsel’s published update discussed preliminary-injunction and class-certification motions. Later procedural developments require docket verification.",
      },
    ],
    sources: [
      {
        label: "Counsel’s lawsuit overview",
        url: "https://redeaglelaw.com/75-country-pause-lawsuit",
      },
      {
        label: "Counsel’s published update",
        url: "https://t.me/s/redeaglelaw?before=2054",
      },
    ],
    contact: {
      label: "Contact Red Eagle Law",
      url: "https://redeaglelaw.com/contact-us",
    },
    contribute:
      "Use counsel’s official contact page for current status and participation questions. Reunite Now does not collect legal fees, enroll plaintiffs, or send stories to the legal team.",
  },
  {
    id: "medani-v-trump",
    kind: "Legal case",
    title: "Medani v. Trump",
    eyebrow: "5:26-cv-06332 · Northern District of California",
    status: "Implementation litigation",
    theme: "Accountability",
    summary:
      "Challenging the diversity visa pauses and pursuing compliance with court-ordered processing.",
    background:
      "This case concerns FY-2026 diversity visa applicants affected by processing holds. The State Department says its diversity visa issuance pause ended under the August 28 order. Later orders addressed implementation. Counsel lists further filings through November 9; consult those documents for individual eligibility and deadlines.",
    goals: [
      "Restore processing for affected diversity visa applicants.",
      "Seek compliance with court orders and reporting on implementation.",
    ],
    updated: "2026-11-12",
    timeline: [
      {
        date: "2026-08-28",
        title: "Preliminary relief granted",
        text: "The State Department confirms that the diversity visa issuance pause is no longer in effect following the court order.",
      },
      {
        date: "2026-09-10",
        title: "Enforcement order",
        text: "The court addressed compliance with its earlier order to resume ordinary adjudication.",
      },
      {
        date: "2026-11-09",
        title: "Further order listed by counsel",
        text: "Counsel links a November 9 order and the preceding request for clarification. Read the documents for the current scope of relief.",
      },
    ],
    sources: [
      {
        label: "Court order · GovInfo",
        url: "https://www.govinfo.gov/content/pkg/USCOURTS-cand-5_26-cv-06332/pdf/USCOURTS-cand-5_26-cv-06332-1.pdf",
      },
      {
        label: "State Department notice",
        url: "https://travel.state.gov/en/newsroom/visas/2025/diversity-visa-issuance-updated-guidance.html",
      },
      {
        label: "Counsel’s updates and filings",
        url: "https://redeaglelaw.com/medani-v-trump",
      },
    ],
    contact: {
      label: "medani@redeaglelaw.com",
      url: "mailto:medani@redeaglelaw.com",
    },
    contribute:
      "Affected applicants can share information through class counsel’s linked page. Earlier processing windows have passed; ask counsel about your circumstances rather than assuming enrollment or visa issuance is available.",
  },
];
