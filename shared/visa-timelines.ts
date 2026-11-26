import { orderedEvents, type CaseReport } from "./metrics";
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
export type TimelineRow = WaitRow & {
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

function collectWaits(
  profiles: CaseReport[],
  requested: readonly WaitMetric[],
  days: number,
  now = new Date(),
) {
  const asOf = now.toISOString().slice(0, 10);
  const posts = new Set<string>();
  const metrics: Record<WaitMetric, TimelineRow[]> = {
    nvc: [],
    post: [],
    reinterview: [],
  };
  const today = Date.parse(asOf);
  for (const profile of profiles) {
    for (const c of profile.cases) {
      if (
        c.shareTimelineRow !== true ||
        !timelineCategories.includes(c.category)
      )
        continue;
      posts.add(c.post);
      const age = (+now - Date.parse(c.updatedAt || profile.updatedAt)) / dayMs;
      if (days && !(age <= days)) continue;
      const events = orderedEvents(c, now);
      const history =
        c.shareTimelineHistory === true
          ? events.map(({ type, date }) => ({ type, date }))
          : undefined;
      for (const metric of requested) {
        const start = waitStart(events, metric);
        if (!start) continue;
        metrics[metric].push({
          category: c.category,
          post: c.post,
          start,
          days: (today - Date.parse(start)) / dayMs,
          window: [30, 60, 90].find((limit) => age <= limit) ?? 0,
          ...(history ? { history } : {}),
        });
      }
    }
  }
  for (const metric of requested)
    metrics[metric].sort(
      (a, b) =>
        b.days - a.days ||
        a.category.localeCompare(b.category) ||
        a.post.localeCompare(b.post),
    );
  return { asOf, posts: [...posts].sort(), metrics };
}

export function visaTimelines(
  profiles: CaseReport[],
  metric: WaitMetric,
  days: number,
  now = new Date(),
) {
  const result = collectWaits(profiles, [metric], days, now);
  return {
    asOf: result.asOf,
    posts: result.posts,
    rows: result.metrics[metric].map(
      ({ window: _, history: _history, ...row }) => row,
    ),
  };
}

export function timelineSnapshot(profiles: CaseReport[], now = new Date()) {
  return collectWaits(profiles, waitMetrics, 0, now);
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
