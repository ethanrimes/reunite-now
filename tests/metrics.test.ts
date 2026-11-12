import test from "node:test";
import assert from "node:assert/strict";
import { caseStatus, metricDays, median, filterCases } from "../shared/metrics";
import {
  caseSchema,
  profileSchema,
  type VisaCase,
  type PublicProfile,
} from "../shared/schema";
const now = new Date("2026-11-11T12:00:00Z");
function visa(events: [string, string][]): VisaCase {
  return {
    id: "case-1",
    applicantName: "Test applicant",
    relationship: "Spouse / partner",
    country: "Colombia",
    category: "K-1",
    post: "Bogotá",
    events: events.map(([type, date], i) => ({
      id: String(i),
      type,
      date,
      note: "",
    })),
  } as VisaCase;
}
test("administrative processing and policy refusals remain active", () => {
  for (const type of [
    "Administrative processing / 221(g)",
    "Policy-related refusal",
  ]) {
    const c = visa([
      ["Filed", "2026-01-01"],
      [type, "2026-06-01"],
    ]);
    assert.equal(caseStatus(c, now), "active");
    assert.equal(metricDays(c, "sinceFiling", now), 314);
    assert.equal(metricDays(c, "total", now), null);
  }
});
test("scheduled interviews do not count as completed interviews or close a case", () => {
  const c = visa([
    ["Filed", "2026-01-01"],
    ["At NVC", "2026-03-01"],
    ["Interview", "2026-12-01"],
  ]);
  assert.equal(caseStatus(c, now), "active");
  assert.equal(metricDays(c, "filingInterview", now), null);
  assert.equal(metricDays(c, "sinceNvc", now), 255);
});
test("closed-case metrics use first interview and initial approval, not issuance", () => {
  const c = visa([
    ["Filed", "2026-01-01"],
    ["At NVC", "2026-02-01"],
    ["Interview", "2026-03-01"],
    ["Interview", "2026-04-01"],
    ["Approved", "2026-05-01"],
    ["Visa issued", "2026-05-10"],
  ]);
  assert.equal(caseStatus(c, now), "closed");
  assert.equal(metricDays(c, "total", now), 120);
  assert.equal(metricDays(c, "filingInterview", now), 59);
  assert.equal(metricDays(c, "nvcInterview", now), 28);
  assert.equal(metricDays(c, "nvcClosure", now), 89);
  assert.equal(metricDays(c, "sinceFiling", now), null);
});
test("reopened cases are active and later closure uses the new decision", () => {
  const c = visa([
    ["Filed", "2026-01-01"],
    ["Final refusal", "2026-02-01"],
    ["Reopened", "2026-03-01"],
  ]);
  assert.equal(caseStatus(c, now), "active");
  c.events.push({ id: "4", type: "Approved", date: "2026-04-01", note: "" });
  assert.equal(metricDays(c, "total", now), 90);
});
test("zero-day durations are retained; missing dates are excluded", () => {
  assert.equal(
    metricDays(
      visa([
        ["Filed", "2026-01-01"],
        ["Approved", "2026-01-01"],
      ]),
      "total",
      now,
    ),
    0,
  );
  assert.equal(
    metricDays(visa([["Approved", "2026-01-01"]]), "total", now),
    null,
  );
  assert.equal(median([0, 2, 4, 6]), 3);
  assert.equal(median([]), null);
});
test("validation rejects impossible dates, future non-interviews and pre-filing events", () => {
  assert.equal(
    caseSchema.safeParse(visa([["Filed", "2026-02-30"]])).success,
    false,
  );
  assert.equal(
    caseSchema.safeParse(visa([["Approved", "2099-01-01"]])).success,
    false,
  );
  assert.equal(
    caseSchema.safeParse(
      visa([
        ["Filed", "2026-02-01"],
        ["At NVC", "2026-01-01"],
      ]),
    ).success,
    false,
  );
  assert.equal(
    caseSchema.safeParse(
      visa([
        ["Filed", "2026-01-01"],
        ["Interview", "2099-01-01"],
      ]),
    ).success,
    true,
  );
});
test("recency uses case confirmation and category/post/status combine", () => {
  const c = visa([["Filed", "2026-01-01"]]);
  c.updatedAt = "2026-11-01T00:00:00Z";
  const p = { cases: [c], updatedAt: "2026-01-01T00:00:00Z" } as PublicProfile;
  assert.equal(
    filterCases(
      [p],
      { post: "Bogotá", days: 30, status: "active", category: "K-1" },
      now,
    ).length,
    1,
  );
  assert.equal(filterCases([p], { post: "London" }, now).length, 0);
});
