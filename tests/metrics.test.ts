import test from "node:test";
import assert from "node:assert/strict";
import { caseStatus, metricDays, median, filterCases } from "../shared/metrics";
import {
  visaTimelines,
  timelineSnapshot,
  calendarWait,
  fiveNumberSummary,
} from "../shared/visa-timelines";
import {
  caseSchema,
  profileSchema,
  type VisaCase,
  type PublicProfile,
} from "../shared/schema";
const now = new Date("2026-11-11T12:00:00Z");
test("timeline samples use shared active immigrant and K cases with a dated milestone, longest first", () => {
  const a = { ...visa([["At NVC", "2026-11-11"]]), shareTimelineRow: true };
  const b = {
    ...a,
    ...visa([
      ["At NVC", "2026-10-12"],
      ["Ready", "2026-11-01"],
    ]),
    category: "F1" as const,
  };
  const profiles = [
    {
      updatedAt: now.toISOString(),
      cases: [
        a,
        b,
        { ...b, category: "F-1" as const },
        { ...b, category: "Other" as const },
        { ...b, shareTimelineRow: undefined },
        { ...b, updatedAt: "2020-01-01" },
        {
          ...a,
          events: [
            ...a.events,
            { id: "x", type: "Approved" as const, date: "2026-11-11" },
          ],
        },
      ],
    },
  ];
  const nvc = visaTimelines(profiles, "nvc", 30, now);
  assert.deepEqual(nvc.rows, [
    { category: "F1", post: "Bogotá", start: "2026-10-12", days: 30 },
    { category: "K-1", post: "Bogotá", start: "2026-11-11", days: 0 },
  ]);
  assert.deepEqual(fiveNumberSummary(nvc.rows), [0, 7.5, 15, 22.5, 30]);
  const post = visaTimelines(profiles, "post", 30, now);
  assert.deepEqual(fiveNumberSummary(post.rows), [10, 10, 10, 10, 10]);
  assert.equal(fiveNumberSummary([]), null);
  const snapshot = timelineSnapshot(profiles, now);
  for (const days of [0, 30, 60, 90]) {
    for (const metric of ["nvc", "post", "reinterview"] as const) {
      const visible = snapshot.metrics[metric]
        .filter((row) => !days || (row.window > 0 && row.window <= days))
        .map(({ window: _, ...row }) => row);
      assert.deepEqual(
        visible,
        visaTimelines(profiles, metric, days, now).rows,
      );
    }
  }
});
test("221(g) counts from the interview only while a reinterview is pending", () => {
  const run = (extra: [string, string][]) =>
    visaTimelines(
      [
        {
          updatedAt: now.toISOString(),
          cases: [
            {
              ...visa([
                ["Interview", "2026-09-01"],
                ["Administrative processing / 221(g)", "2026-09-04"],
                ...extra,
              ]),
              shareTimelineRow: true,
            },
          ],
        },
      ],
      "reinterview",
      0,
      now,
    ).rows;
  assert.equal(run([["Reinterview", "2026-12-01"]])[0].start, "2026-09-01");
  for (const event of ["Interview", "Reinterview", "Approved", "Reopened"])
    assert.deepEqual(run([[event, "2026-10-01"]]), []);
});
test("completed histories need separate sharing and contain only milestone dates and types", () => {
  const c = visa([
    ["Interview", "2026-12-01"],
    ["At NVC", "2026-10-12"],
    ["Filed", "2026-09-01"],
  ]);
  function rows(shareTimelineRow: boolean, shareTimelineHistory: boolean) {
    return timelineSnapshot(
      [
        {
          updatedAt: now.toISOString(),
          cases: [{ ...c, shareTimelineRow, shareTimelineHistory }],
        },
      ],
      now,
    ).metrics.nvc;
  }
  assert.deepEqual(rows(false, true), []);
  assert.equal("history" in rows(true, false)[0], false);
  assert.deepEqual(rows(true, true)[0].history, [
    { type: "Filed", date: "2026-09-01" },
    { type: "At NVC", date: "2026-10-12" },
  ]);
});
test("calendar waits use real month lengths and leap years", () => {
  assert.deepEqual(calendarWait("2024-02-29", "2025-03-01"), {
    year: 1,
    month: 0,
    day: 1,
  });
  assert.deepEqual(calendarWait("2026-01-31", "2026-02-28"), {
    year: 0,
    month: 1,
    day: 0,
  });
  assert.deepEqual(calendarWait("2026-10-31", "2026-11-01"), {
    year: 0,
    month: 0,
    day: 1,
  });
});
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
  c.events.push({ id: "4", type: "Approved", date: "2026-04-01" });
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
