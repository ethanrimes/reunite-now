import type { VisaCase, VisaEvent } from "./schema";
export const caseRoles = [
  "Petitioner",
  "Applicant",
  "Other relationship to the applicant",
] as const;
export type CaseRole = (typeof caseRoles)[number];
const allRelationships = [
  "Self",
  "Spouse / partner",
  "Child",
  "Parent",
  "Sibling",
  "Other",
] as const;
export function relationshipsFor(
  category: string,
  role?: CaseRole,
  citizen = false,
): string[] {
  if (role === "Applicant") return citizen ? [] : ["Self"];
  if (role === "Petitioner") {
    if (["K-1", "CR-1", "IR-1"].includes(category)) return ["Spouse / partner"];
    if (["K-2", "IR-2", "F1", "F2B", "F3"].includes(category)) return ["Child"];
    if (category === "IR-5") return ["Parent"];
    if (category === "F4") return ["Sibling"];
    if (category === "F2A") return ["Spouse / partner", "Child"];
  }
  return allRelationships.filter((r) => r !== "Self");
}
export function rolesFor(category: string, citizen: boolean): CaseRole[] {
  // A visitor/student/exchange/DV applicant has no family or employer visa petitioner.
  const noPetition = ["B-1/B-2", "F-1", "J-1", "DV"].includes(category);
  return caseRoles.filter(
    (r) =>
      !(citizen && r === "Applicant") && !(noPetition && r === "Petitioner"),
  );
}
export function milestonesFor(category: string): VisaEvent["type"][] {
  if (category === "DV")
    return ["Filed", "At KCC", "Interview", "Approved", "Visa issued"];
  if (["B-1/B-2", "F-1", "J-1"].includes(category))
    return ["Filed", "Interview", "Approved", "Visa issued"];
  if (["H-1B", "L-1", "O-1"].includes(category))
    return [
      "Filed",
      "NOA1",
      "NOA2",
      "Visa application submitted",
      "Interview",
      "Approved",
      "Visa issued",
    ];
  if (category === "Other")
    return ["Filed", "Interview", "Approved", "Visa issued"];
  return [
    "Filed",
    "NOA1",
    "NOA2",
    "At NVC",
    ...(["K-1", "K-2"].includes(category)
      ? []
      : (["Documentarily qualified"] as const)),
    "In transit",
    "Ready",
    "Interview",
    "Approved",
    "Visa issued",
  ];
}
export function milestoneLabel(category: string, type: string) {
  if (type !== "Filed") return type;
  if (category === "DV") return "DS-260 submitted";
  if (["B-1/B-2", "F-1", "J-1"].includes(category)) return "DS-160 submitted";
  return "Petition / application filed";
}
export function applyTemplate(
  value: VisaCase,
  category: VisaCase["category"],
  id: () => string,
): VisaCase {
  // Only undated, unannotated suggestions can be replaced. Never discard a recorded milestone.
  const recorded = value.events.filter((e) => e.date || e.note);
  const events = [
    ...recorded,
    ...milestonesFor(category)
      .filter((type) => !recorded.some((e) => e.type === type))
      .map((type) => ({ id: id(), type, date: "", note: "" })),
  ];
  return { ...value, category, events };
}
export const pauseSource =
  "https://travel.state.gov/en/newsroom/visas/2026/immigrant-visa-processing-updates-for-nationalities-at-high-risk-of-public-benefits-usage.html";
const pauseCountries = new Set(
  "Afghanistan|Albania|Algeria|Antigua and Barbuda|Armenia|Azerbaijan|Bahamas|The Bahamas|Bangladesh|Barbados|Belarus|Belize|Bhutan|Bosnia and Herzegovina|Brazil|Myanmar|Burma|Cambodia|Cameroon|Cabo Verde|Cape Verde|Colombia|Ivory Coast|Cote d’Ivoire|Cuba|Democratic Republic of the Congo|Dominica|Egypt|Eritrea|Ethiopia|Fiji|Gambia|The Gambia|Georgia|Ghana|Grenada|Guatemala|Guinea|Haiti|Iran|Iraq|Jamaica|Jordan|Kazakhstan|Kosovo|Kuwait|Kyrgyzstan|Kyrgyz Republic|Laos|Lebanon|Liberia|Libya|Moldova|Mongolia|Montenegro|Morocco|Nepal|Nicaragua|Nigeria|North Macedonia|Macedonia|Pakistan|Republic of the Congo|Russia|Rwanda|Saint Kitts and Nevis|Saint Lucia|Saint Vincent and the Grenadines|Senegal|Sierra Leone|Somalia|South Sudan|Sudan|Syria|Tanzania|United Republic of Tanzania|Thailand|Togo|Tunisia|Uganda|Uruguay|Uzbekistan|Yemen".split(
    "|",
  ),
);
export function mayHavePauseHistory(category: string, nationality: string) {
  return (
    ![
      "K-1",
      "K-2",
      "B-1/B-2",
      "F-1",
      "J-1",
      "H-1B",
      "L-1",
      "O-1",
      "Other",
    ].includes(category) && pauseCountries.has(nationality)
  );
}
