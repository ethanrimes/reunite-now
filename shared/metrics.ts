import type { VisaCase, PublicProfile } from "./schema";
export const metricLabels = {
  sinceFiling: "Time since filing",
  sinceNvc: "Time since arrival at NVC",
  total: "Filing to final decision",
  filingInterview: "Filing to first interview",
  nvcInterview: "NVC to first interview",
  nvcClosure: "NVC to final decision",
};
export type Metric = keyof typeof metricLabels;
export function orderedEvents(v: VisaCase, now = new Date()) {
  return [...v.events]
    .filter((e) => !!e.date && e.date <= now.toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function caseStatus(v: VisaCase, now = new Date()): "active" | "closed" {
  const e = orderedEvents(v, now);
  const last = e.at(-1);
  return last &&
    ["Approved", "Visa issued", "Final refusal", "Withdrawn"].includes(
      last.type,
    )
    ? "closed"
    : "active";
}
export function metricDays(
  v: VisaCase,
  metric: Metric,
  now = new Date(),
): number | null {
  const events = orderedEvents(v, now);
  const first = (t: string) => events.find((e) => e.type === t)?.date;
  const filing = first("Filed"),
    nvc = first("At NVC"),
    interview = first("Interview");
  const reopened = events.findLastIndex((e) => e.type === "Reopened");
  const closure = events
    .slice(reopened + 1)
    .find((e) =>
      ["Approved", "Visa issued", "Final refusal", "Withdrawn"].includes(
        e.type,
      ),
    )?.date;
  let a: string | undefined, b: string | undefined;
  const today = now.toISOString().slice(0, 10);
  const closed = caseStatus(v, now) === "closed";
  if (metric === "sinceFiling" && !closed) {
    a = filing;
    b = today;
  }
  if (metric === "sinceNvc" && !closed) {
    a = nvc;
    b = today;
  }
  if (closed) {
    if (metric === "total") {
      a = filing;
      b = closure;
    }
    if (metric === "filingInterview") {
      a = filing;
      b = interview;
    }
    if (metric === "nvcInterview") {
      a = nvc;
      b = interview;
    }
    if (metric === "nvcClosure") {
      a = nvc;
      b = closure;
    }
  }
  if (!a || !b || b < a) return null;
  return Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b),
    m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
export function summarize(cases: VisaCase[], metric: Metric, now = new Date()) {
  const values = cases
    .map((c) => metricDays(c, metric, now))
    .filter((v): v is number => v !== null);
  return { count: cases.length, sample: values.length, median: median(values) };
}
export function filterCases(
  profiles: PublicProfile[],
  filters: { post?: string; days?: number; status?: string; category?: string },
  now = new Date(),
) {
  return profiles
    .flatMap((p) =>
      p.cases.map((c) => ({ ...c, updatedAt: c.updatedAt || p.updatedAt })),
    )
    .filter(
      (c) =>
        (!filters.post || c.post === filters.post) &&
        (!filters.days ||
          Date.parse(c.updatedAt) >= +now - filters.days * 86400000) &&
        (!filters.status || caseStatus(c, now) === filters.status) &&
        (!filters.category || c.category === filters.category),
    );
}
