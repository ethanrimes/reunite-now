import test from "node:test";
import assert from "node:assert/strict";
import {
  rolesFor,
  relationshipsFor,
  milestonesFor,
  applyTemplate,
  mayHavePauseHistory,
} from "../shared/visa-workflow";
import {
  profileSchema,
  profileWriteSchema,
  caseSchema,
  type VisaCase,
} from "../shared/schema";
import { caseStatus } from "../shared/metrics";
import {
  legislation,
  memberVote,
  legislativeTopics,
} from "../shared/legislation";
const base: VisaCase = {
  id: "case",
  applicantName: "Sample",
  country: "Colombia",
  category: "K-1",
  post: "Bogota",
  relationship: "Spouse / partner",
  events: [{ id: "filed", type: "Filed", date: "2025-01-01", note: "" }],
};
test("role and visa category constrain relationships without restricting a relative helping an applicant", () => {
  assert.deepEqual(relationshipsFor("IR-5", "Petitioner"), ["Parent"]);
  assert.deepEqual(relationshipsFor("F4", "Petitioner"), ["Sibling"]);
  assert.deepEqual(relationshipsFor("F2A", "Petitioner"), [
    "Spouse / partner",
    "Child",
  ]);
  assert.deepEqual(relationshipsFor("EB-2", "Applicant"), ["Self"]);
  assert.ok(
    relationshipsFor("IR-5", "Other relationship to the applicant").includes(
      "Sibling",
    ),
  );
  assert.ok(!rolesFor("K-1", true).includes("Applicant"));
  assert.ok(!rolesFor("B-1/B-2", false).includes("Petitioner"));
  assert.equal(
    caseSchema.safeParse({
      ...base,
      role: "Petitioner",
      relationship: "Parent",
    }).success,
    false,
  );
});
test("templates distinguish petition, nonimmigrant and KCC routes and preserve entered facts", () => {
  assert.ok(!milestonesFor("K-1").includes("Documentarily qualified"));
  assert.ok(!milestonesFor("DV").includes("At NVC"));
  assert.ok(milestonesFor("DV").includes("At KCC"));
  assert.ok(!milestonesFor("F-1").includes("NOA1"));
  assert.ok(!milestonesFor("H-1B").includes("At NVC"));
  let n = 0;
  const v = {
    ...base,
    events: [
      ...base.events,
      { id: "blank", type: "NOA1" as const, date: "", note: "" },
      {
        id: "note",
        type: "Interview" as const,
        date: "",
        note: "Appointment pending",
      },
    ],
  };
  const result = applyTemplate(v, "DV", () => String(++n));
  assert.deepEqual(result.events[0], v.events[0]);
  assert.ok(result.events.some((e) => e.id === "note"));
  assert.ok(!result.events.some((e) => e.id === "blank"));
  assert.equal(
    caseStatus({
      ...base,
      events: milestonesFor("K-1").map((type) => ({
        id: type,
        type,
        date: "",
        note: "",
      })),
    }),
    "active",
  );
  assert.ok(!result.events.some((e) => e.type === "Policy-related refusal"));
  assert.ok(mayHavePauseHistory("IR-1", "Colombia"));
  assert.ok(!mayHavePauseHistory("B-1/B-2", "Colombia"));
  assert.ok(!mayHavePauseHistory("K-1", "Colombia"));
});
test("legacy profiles stay readable but saving requires involvement, role and confirmed nationality", () => {
  const profile = {
    name: "Sample User",
    legalStatus: "US citizen",
    country: "Colombia",
    city: "Bogota",
    personallyInvolved: true,
    signed: true,
    publicConsent: true,
    adultConsent: true,
    reminders: false,
    cases: [],
  };
  assert.ok(profileSchema.safeParse(profile).success);
  assert.ok(!profileWriteSchema.safeParse(profile).success);
  assert.ok(
    profileWriteSchema.safeParse({ ...profile, personallyInvolved: false })
      .success,
  );
  assert.ok(
    !profileWriteSchema.safeParse({ ...profile, cases: [base] }).success,
  );
  const updated = { ...base, nationality: "Colombia", role: "Petitioner" };
  assert.ok(
    profileWriteSchema.safeParse({ ...profile, cases: [updated] }).success,
  );
  assert.ok(
    !profileWriteSchema.safeParse({
      ...profile,
      personallyInvolved: false,
      cases: [updated],
    }).success,
  );
});
test("vote records use official IDs and distinguish absence, abstention and sponsorship", () => {
  assert.equal(legislation.bills.length, 22);
  assert.equal(legislativeTopics.length, 17);
  assert.equal(legislation.votes.length, 6);
  for (const v of legislation.votes) {
    assert.ok(Object.keys(v.members).length >= 100);
    assert.ok(legislation.bills.some((b) => b.id === v.bill));
    assert.equal(memberVote(v, "NOT_A_MEMBER"), null);
  }
  const vote = legislation.votes.find(
    (v) => v.bill === "119-hr-1" && v.chamber === "Senate",
  )!;
  assert.equal(memberVote(vote, "C000127"), "Nay"); // Maria Cantwell
  assert.equal(memberVote(vote, "S001230"), null); // House member, not a senator
  assert.ok(!legislation.votes.some((v) => v.bill === "119-hr-10711"));
  assert.ok(
    legislation.bills
      .find((b) => b.id === "119-hr-10711")!
      .sponsors.includes("S001230"),
  );
  const hr1044 = legislation.bills.find((b) => b.id === "116-hr-1044")!;
  assert.ok(hr1044.actions.some((a) => a.text.includes("Voice Vote")));
  assert.ok(
    !legislation.votes.some(
      (v) => v.bill === "116-hr-1044" && v.chamber === "Senate",
    ),
  );
});
