import {
  filterCases,
  summarize,
  type CaseReport,
  type Metric,
} from "./metrics";
import type { PublicProfile, PublicStory } from "./schema";

export type PlaceCount = Pick<
  PublicProfile,
  "country" | "state" | "district"
> & { count: number };
export type StoryCard = Pick<
  PublicStory,
  "id" | "title" | "country" | "name"
> & { cover: string | null };
export type StoryPage = { cards: StoryCard[]; next: string | null };

export function visaStatistics(
  profiles: CaseReport[],
  filters: { post: string; days: number; category: string; status: string },
  metric: Metric,
) {
  const cases = filterCases(profiles, filters);
  const groups = <T>(
    key: (item: (typeof cases)[number]) => string | undefined,
    reduce: (items: typeof cases) => T,
  ) => {
    const buckets = new Map<string, typeof cases>();
    for (const item of cases) {
      const name = key(item);
      if (!name) continue;
      if (!buckets.has(name)) buckets.set(name, []);
      buckets.get(name)!.push(item);
    }
    return Object.fromEntries(
      Array.from(buckets, ([name, items]) => [name, reduce(items)]),
    );
  };
  const metrics: Metric[] =
    filters.status === "active"
      ? ["sinceFiling", "sinceNvc"]
      : ["total", "filingInterview", "nvcInterview", "nvcClosure"];
  return {
    posts: [
      ...new Set(profiles.flatMap((p) => p.cases.map((c) => c.post))),
    ].sort(),
    count: cases.length,
    postCount: new Set(cases.map((c) => c.post)).size,
    countries: groups(
      (c) => c.nationality,
      (items) => summarize(items, metric),
    ),
    categories: groups(
      (c) => c.category,
      (items) => ({
        count: items.length,
        metrics: Object.fromEntries(
          metrics.map((m) => [m, summarize(items, m)]),
        ),
      }),
    ),
  };
}
