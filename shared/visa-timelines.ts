import { median, orderedEvents, type CaseReport } from "./metrics";
import { visaCategories } from "./schema";

export const waitMetrics = ["nvc", "post", "reinterview"] as const;
export type WaitMetric = (typeof waitMetrics)[number];
// K visas are deliberately included; "Other" cannot be classified reliably.
export const timelineCategories = visaCategories.filter((c) =>
  /^(IR-|CR-|K-|F[1-4]|EB-|DV$)/.test(c),
);
export type WaitRow = {
  category: string;
  post: string;
  start: string;
  days: number;
};
type ReportedCase = CaseReport["cases"][number];
export type TimelineCase = Pick<WaitRow, "category" | "post"> & {
  starts: Partial<Record<WaitMetric, string>>;
  window: number;
  history?: ReportedCase["events"];
};
const dayMs = 86400000;

function waitStart(
  events: ReturnType<typeof orderedEvents>,
  metric: WaitMetric,
) {
  const lastDecision = events.findLast((e) =>
    [
      "Approved",
      "Visa issued",
      "Final refusal",
      "Withdrawn",
      "Reopened",
    ].includes(e.type),
  );
  if (lastDecision && lastDecision.type !== "Reopened") return;
  if (metric !== "reinterview")
    return events.find(
      (e) => e.type === (metric === "nvc" ? "At NVC" : "Ready"),
    )?.date;

  const cycle = events.slice(
    events.findLastIndex((e) => e.type === "Reopened") + 1,
  );
  const refusal = cycle.find(
    (e) => e.type === "Administrative processing / 221(g)",
  );
  if (!refusal) return;
  const interviews = cycle.filter((e) => e.type === "Interview");
  if (
    interviews.length !== 1 ||
    interviews[0].date > refusal.date ||
    cycle.some((e) => e.type === "Reinterview")
  )
    return;
  return interviews[0].date;
}

export function timelineSnapshot(profiles: CaseReport[], now = new Date()) {
  const asOf = now.toISOString().slice(0, 10);
  const posts = new Set<string>();
  const cases: TimelineCase[] = [];
  const durations: Record<WaitMetric, number[]> = {
    nvc: [],
    post: [],
    reinterview: [],
  };
  for (const profile of profiles) {
    for (const c of profile.cases) {
      const events = orderedEvents(c, now);
      const age = (+now - Date.parse(c.updatedAt || profile.updatedAt)) / dayMs;
      const starts: TimelineCase["starts"] = {};
      if (timelineCategories.includes(c.category)) {
        for (const metric of waitMetrics) {
          const start = waitStart(events, metric);
          if (!start) continue;
          starts[metric] = start;
          durations[metric].push(waitDays(start, asOf));
        }
      }
      posts.add(c.post);
      cases.push({
        category: c.category,
        post: c.post,
        starts,
        window: [30, 60, 90].find((limit) => age <= limit) ?? 0,
        ...(c.shareTimelineHistory === true
          ? { history: events.map(({ type, date }) => ({ type, date })) }
          : {}),
      });
    }
  }
  const overview = waitMetrics.map((metric) => ({
    metric,
    count: durations[metric].length,
    medianDays: median(durations[metric]),
  }));
  return { asOf, posts: [...posts].sort(), cases, overview };
}

export function waitDays(start: string, asOf: string) {
  return (Date.parse(asOf) - Date.parse(start)) / dayMs;
}

export function metricRows(
  snapshot: ReturnType<typeof timelineSnapshot>,
  metric: WaitMetric,
) {
  return snapshot.cases
    .flatMap(({ starts, ...entry }) => {
      const start = starts[metric];
      return start
        ? [{ ...entry, start, days: waitDays(start, snapshot.asOf) }]
        : [];
    })
    .sort(
      (a, b) =>
        b.days - a.days ||
        a.category.localeCompare(b.category) ||
        a.post.localeCompare(b.post),
    );
}

export function visaTimelines(
  profiles: CaseReport[],
  metric: WaitMetric,
  days: number,
  now = new Date(),
) {
  const snapshot = timelineSnapshot(
    profiles.map((p) => ({
      ...p,
      cases: p.cases.filter(
        (c) =>
          !days ||
          (+now - Date.parse(c.updatedAt || p.updatedAt)) / dayMs <= days,
      ),
    })),
    now,
  );
  const rows = metricRows(snapshot, metric).map(
    ({ window: _, history: _history, ...row }) => row,
  );
  return {
    asOf: snapshot.asOf,
    posts: [
      ...new Set(profiles.flatMap((p) => p.cases.map((c) => c.post))),
    ].sort(),
    rows,
  };
}

// Linear interpolation at (n - 1) * p; whiskers show the full reported range.
export function fiveNumberSummary(rows: WaitRow[]) {
  if (!rows.length) return null;
  const values = rows.map((r) => r.days).sort((a, b) => a - b);
  return [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const index = (values.length - 1) * p,
      lo = Math.floor(index);
    return values[lo] + (values[Math.ceil(index)] - values[lo]) * (index - lo);
  });
}

export function calendarWait(start: string, asOf: string) {
  const from = new Date(start),
    end = new Date(asOf);
  let months =
    (end.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    from.getUTCMonth();
  const anniversary = (n: number) => {
    const month = from.getUTCMonth() + n,
      year = from.getUTCFullYear();
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return Date.UTC(year, month, Math.min(from.getUTCDate(), last));
  };
  if (anniversary(months) > +end) months--;
  return {
    year: Math.floor(months / 12),
    month: months % 12,
    day: (+end - anniversary(months)) / dayMs,
  };
}
