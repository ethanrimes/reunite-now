import snapshot from "./legislation.json";
import type { Policy } from "./policies";
export const legislation = snapshot;
export type Bill = (typeof snapshot.bills)[number];
export const billLabel = (b: Bill) =>
  `${b.type === "hr" ? "H.R." : "S."} ${b.number}`;
export const legislativeTopics = [
  {
    id: "reducing-visa-delays-act",
    bills: ["119-hr-10711"],
    theme: "Transparency",
    summary:
      "Public reporting on consular staffing, vetting, and post-interview waits.",
  },
  {
    id: "domestic-visa-renewal",
    bills: ["119-hr-10715"],
    theme: "Processing capacity",
    summary:
      "Allow eligible holders of certain work and other nonimmigrant visas to renew inside the United States, avoiding an overseas consular trip.",
  },
  {
    id: "diversity-visa-protection",
    bills: ["119-hr-9457"],
    theme: "Accountability",
    summary:
      "Limit blanket diversity-visa pauses, require notice and public explanations, and protect selectees from specified pause-related losses of eligibility.",
  },
  {
    id: "reuniting-families",
    bills: ["119-hr-6565", "119-s-3419"],
    theme: "Family reunification",
    summary:
      "Recapture unused immigrant visas, change family visa limits, and protect families affected by long queues and age-outs.",
  },
  {
    id: "no-ban-act",
    bills: ["119-hr-924", "119-s-398"],
    theme: "Accountability",
    summary:
      "Limit the use of broad entry restrictions and strengthen nondiscrimination protections and congressional oversight.",
  },
  {
    id: "dignity-act",
    bills: ["119-hr-4393"],
    theme: "Processing capacity",
    summary:
      "A broad immigration package with legal-visa backlog relief, higher per-country caps, age-out protections, and proposed processing resources. Its enforcement provisions also deserve review.",
  },
  {
    id: "healthcare-workforce",
    bills: ["119-s-2759", "119-hr-5283"],
    theme: "Visa availability",
    summary:
      "Recapture unused immigrant visas for nurses and physicians, with provisions for accompanying family members and expedited processing.",
  },
  {
    id: "temporary-family-visitation",
    bills: ["119-s-3440", "119-hr-6670"],
    theme: "Family reunification",
    summary:
      "Create a temporary family-visit visa route, including for some relatives waiting for an immigrant visa, subject to eligibility and sponsorship conditions.",
  },
  {
    id: "american-families-united",
    bills: ["119-hr-2366"],
    theme: "Family reunification",
    summary:
      "Expand case-by-case discretion for certain relatives of US citizens facing immigration barriers. This is family-unity relief, not a general visa wait-time deadline.",
  },
  {
    id: "visa-processing-improvement",
    bills: ["118-s-2632"],
    theme: "Processing capacity",
    summary:
      "Proposed interview-waiver expansion, remote-interview pilots, and responses to excessive interview waits. The 118th Congress ended without enactment.",
  },
  {
    id: "visitor-wait-time-reduction",
    bills: ["118-hr-5127"],
    theme: "Processing capacity",
    summary:
      "Proposed reporting and personnel reassignment at posts with excessive visitor-visa waits. The 118th Congress ended without enactment.",
  },
  {
    id: "visa-paperwork-reduction",
    bills: ["118-hr-9545"],
    theme: "Processing capacity",
    summary:
      "Proposed electronic delivery of visa communications and required domestic-violence information. The 118th Congress ended without enactment.",
  },
  {
    id: "visa-efficiency-security",
    bills: ["118-hr-6542"],
    theme: "Visa availability",
    summary:
      "Proposed changes to employment and family per-country limits and related employment-visa safeguards. The 118th Congress ended without enactment.",
  },
  {
    id: "fairness-high-skilled",
    bills: ["116-hr-1044", "116-s-386"],
    theme: "Visa availability",
    summary:
      "Historical per-country cap reform. The House passed H.R. 1044; the Senate passed an amended version by voice vote. The versions were not reconciled into law.",
  },
  {
    id: "no-ban-2021",
    bills: ["117-hr-1333"],
    theme: "Accountability",
    summary:
      "The earlier NO BAN Act passed the House in 2021 but did not become law. Its recorded vote provides historical context for the current proposal.",
  },
  {
    id: "visa-integrity-fee",
    bills: ["119-hr-1"],
    theme: "Fees & oversight",
    summary:
      "Public Law 119-21 created a nonimmigrant visa integrity fee with a statutory initial floor of $250. Track implementation separately from enactment; this is not a fee-payment instruction.",
    omnibus: true,
  },
  {
    id: "consular-modernization-ndaa",
    bills: ["119-s-1071"],
    theme: "Processing capacity",
    summary:
      "The FY2026 defense authorization law includes a sense of Congress on modernizing and integrating consular information systems (§5120). This is not an enforceable processing deadline.",
    omnibus: true,
  },
];
export const topicForBill = (id: string) =>
  legislativeTopics.find((t) => t.bills.includes(id));
export function memberVote(
  vote: (typeof snapshot.votes)[number],
  bioguide: string,
) {
  return (vote.members as Record<string, string | undefined>)[bioguide] || null;
}
export const additionalPolicies: Policy[] = legislativeTopics
  .filter((x) => x.id !== "reducing-visa-delays-act")
  .map((topic) => {
    const bills = topic.bills.map((id) =>
      snapshot.bills.find((b) => b.id === id)!,
    );
    const b = bills[0],
      historical = b.congress < 119,
      enacted = bills.some((b) => b.latest.text.includes("Became Public Law"));
    return {
      id: topic.id,
      kind: "Legislation",
      title:
        topic.id === "visa-integrity-fee"
          ? "Visa integrity fee · Public Law 119-21"
          : b.title,
      eyebrow: `${bills.map(billLabel).join(" / ")} · ${b.congress}`,
      status: historical
        ? "Historical · not enacted"
        : enacted
          ? "Enacted · implementation watch"
          : "In committee",
      theme: topic.theme,
      summary: topic.summary,
      background: topic.summary,
      goals: [
        topic.omnibus
          ? "Review the visa-related provision separately from the wider legislation."
          : "Compare the proposed changes with the needs of applicants and their families.",
      ],
      updated: snapshot.reviewed,
      timeline: [
        {
          date: b.introduced,
          title: "Introduced",
          text: "Read the original bill and its subsequent actions in the official record.",
        },
        {
          date: b.latest.date,
          title: "Latest recorded action",
          text: historical
            ? "The congressional session has ended. A new bill is needed for the proposal to advance."
            : enacted
              ? "Enacted. Check agency guidance for implementation."
              : "The proposal remains in committee in the reviewed record.",
        },
      ],
      sources: bills.flatMap((b) => [
        { label: billLabel(b) + " · Congress.gov", url: b.url },
        { label: "GovInfo · official bill record", url: b.source },
      ]),
      contribute: historical
        ? "Ask your representatives whether they support reintroducing these proposals."
        : "Ask your representatives about the visa provisions, their position, and the next steps. Inclusion here is not an endorsement of every provision.",
    };
  });
