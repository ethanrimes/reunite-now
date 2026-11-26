import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, LoaderCircle } from "lucide-react";
import { useData, useSnapshot, visaSnapshot } from "../../app/api";
import { previewMode } from "../../app/preview";
import { date, External, Modal, PageIntro } from "../../components/ui";
import { getLocale, number, t } from "../../i18n/i18n";
import {
  calendarWait,
  fiveNumberSummary,
  timelineCategories,
  timelineSnapshot,
  waitMetrics,
  type WaitMetric,
  type WaitRow,
  type TimelineRow,
} from "../../../../shared/visa-timelines";
import "./timelines.css";

type Group = { label?: string; options: readonly string[] };
const groups: Group[] = [
  {
    label: "Immediate family",
    options: timelineCategories.filter((c) => /^(IR|CR)-/.test(c)),
  },
  {
    label: "Fiancé visas",
    options: timelineCategories.filter((c) => c.startsWith("K-")),
  },
  {
    label: "Family preference",
    options: timelineCategories.filter((c) => /^F[1-4]/.test(c)),
  },
  {
    label: "Employment-based",
    options: timelineCategories.filter((c) => c.startsWith("EB-")),
  },
  {
    label: "Diversity visas",
    options: timelineCategories.filter((c) => c === "DV"),
  },
];
const metricText: Record<WaitMetric, [string, string]> = {
  nvc: ["Time since arrival at NVC", "NVC arrival date"],
  post: ["Time since arrival at post", "Post arrival date"],
  reinterview: ["221(g) wait for reinterview", "First interview date"],
};
const sources = [
  [
    "VisaMoves",
    "https://visamoves.com/about",
    "Community reports on administrative processing after interview, organized by consulate.",
  ],
  [
    "Track My Visa",
    "https://trackmyvisa.com/",
    "Independent estimates and case updates for applications at USCIS.",
  ],
  [
    "IV Scheduling Status Tool",
    "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/iv-wait-times.html",
    "Check which documentarily complete cases the NVC is scheduling at each post.",
  ],
  [
    "Visa Bulletin",
    "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
    "Official monthly priority-date tables for family-preference and employment visas.",
  ],
  [
    "Immigration.com · Family Based Green Card",
    "https://forums.immigration.com/forums/family-based-green-card-through-marriage-relative.121/",
    "Community discussion of family-based visa cases and applicants’ experiences.",
  ],
] as const;

function Picker({
  label,
  groups,
  selected,
  change,
  searchLabel,
}: {
  label: string;
  groups: Group[];
  selected: string[] | null;
  change: (next: string[] | null) => void;
  searchLabel: string;
}) {
  const [query, setQuery] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function outside(e: PointerEvent) {
      if (details.current?.open && !details.current.contains(e.target as Node))
        details.current.open = false;
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const all = groups.flatMap((group) => group.options);
  const chosen = new Set(selected ?? all);
  const needle = query.trim().toLocaleLowerCase(getLocale());
  const visible = groups.map((group) => ({
    ...group,
    options: group.options.filter((v) =>
      [v, t(v), t(group.label ?? "")].some((s) =>
        s.toLocaleLowerCase(getLocale()).includes(needle),
      ),
    ),
  }));
  return (
    <details
      className="multi-select wait-picker"
      name="timeline-filters"
      ref={details}
      onToggle={(e) => {
        if (e.currentTarget.open) search.current?.focus();
        else setQuery("");
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.open = false;
          e.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>
        {t(label)}
        <span>
          {selected === null
            ? t("All")
            : t("{count} selected", { count: number(chosen.size) })}
          <ChevronDown size={16} />
        </span>
      </summary>
      <div className="multi-options">
        <input
          type="search"
          ref={search}
          value={query}
          aria-label={t(searchLabel)}
          placeholder={t(searchLabel)}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="wait-actions">
          <button className="text-button" onClick={() => change(null)}>
            {t("Select all")}
          </button>
          <button className="text-button" onClick={() => change([])}>
            {t("Deselect all")}
          </button>
        </div>
        <div className="wait-options">
          {!visible.some((group) => group.options.length) && (
            <p>{t("No matches")}</p>
          )}
          {visible.map(
            (group) =>
              group.options.length > 0 && (
                <fieldset key={group.label ?? ""}>
                  {group.label && <legend>{t(group.label)}</legend>}
                  {group.options.map((v) => (
                    <label key={v}>
                      <input
                        type="checkbox"
                        checked={chosen.has(v)}
                        onChange={() => {
                          const next = all.filter((x) =>
                            x === v ? !chosen.has(x) : chosen.has(x),
                          );
                          change(next.length === all.length ? null : next);
                        }}
                      />
                      {t(v)}
                    </label>
                  ))}
                </fieldset>
              ),
          )}
        </div>
      </div>
    </details>
  );
}

function BoxPlot({ rows }: { rows: WaitRow[] }) {
  const summary = useMemo(() => fiveNumberSummary(rows), [rows]);
  if (!summary)
    return (
      <p className="wait-empty">{t("No cases match these filters yet")}</p>
    );
  const [min, q1, median, q3, max] = summary;
  const x = (n: number) =>
    min === max ? 50 : 2 + (96 * (n - min)) / (max - min);
  return (
    <figure className="wait-plot">
      <svg aria-hidden="true" viewBox="0 0 100 48" preserveAspectRatio="none">
        <line x1={x(min)} x2={x(max)} y1="24" y2="24" />
        {[min, max].map((v, i) => (
          <line key={i} x1={x(v)} x2={x(v)} y1="14" y2="34" />
        ))}
        <rect x={x(q1)} y="8" width={x(q3) - x(q1)} height="32" />
        <line className="median" x1={x(median)} x2={x(median)} y1="6" y2="42" />
      </svg>
      <dl>
        {["Shortest", "Q1", "Median wait", "Q3", "Longest"].map((label, i) => (
          <div key={label}>
            <dt>{t(label)}</dt>
            <dd>{t("{days} days", { days: number(summary[i]) })}</dd>
          </div>
        ))}
      </dl>
      <figcaption>
        {t(
          "The box spans the middle half of reported waits. The center mark is the median; the ends show the shortest and longest waits.",
        )}
      </figcaption>
    </figure>
  );
}

function waitLabel(start: string, asOf: string) {
  const units = Object.entries(calendarWait(start, asOf)).map(([unit, value]) =>
    new Intl.NumberFormat(getLocale(), {
      style: "unit",
      unit,
      unitDisplay: "long",
    }).format(value),
  );
  return new Intl.ListFormat(getLocale(), { type: "unit" }).format(units);
}

function Loading() {
  return (
    <p role="status" className="wait-loading">
      <LoaderCircle size={18} />
      {t("Loading…")}
    </p>
  );
}

export default function VisaTimelines() {
  const { profiles, loading, error } = useData();
  const [metric, setMetric] = useState<WaitMetric>("nvc");
  const [days, setDays] = useState(90);
  const [categories, setCategories] = useState<string[] | null>(null);
  const [posts, setPosts] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [activeRow, setActiveRow] = useState<TimelineRow | null>(null);
  const [showSources, setShowSources] = useState(false);
  const remote = useSnapshot(visaSnapshot, !previewMode);
  const sample = useMemo(
    () =>
      previewMode && !loading && !error
        ? timelineSnapshot(profiles)
        : undefined,
    [profiles, loading, error],
  );
  const stats = sample ?? remote?.data;
  const failed = previewMode ? !!error : remote?.error;
  const rows = useMemo(
    () =>
      stats?.metrics[metric].filter(
        (row) =>
          (!days || (row.window !== 0 && row.window <= days)) &&
          (!categories || categories.includes(row.category)) &&
          (!posts || posts.includes(row.post)),
      ) ?? [],
    [stats, metric, days, categories, posts],
  );
  const pending = failed ? (
    <p role="alert">{t("Something went wrong. Please try again.")}</p>
  ) : (
    <Loading />
  );
  return (
    <div className="page-shell wait-page">
      <PageIntro
        eyebrow={t("COMMUNITY VISA DATA")}
        title={t("Visa timelines")}
        text={t(
          "Compare self-reported timelines by visa category and consular post. These are community reports, not State Department estimates.",
        )}
      />
      <div className="wait-filters">
        <Picker
          label="Visa category"
          groups={groups}
          selected={categories}
          change={setCategories}
          searchLabel="Search visa categories"
        />
        <Picker
          label="Consular post"
          groups={[{ options: stats?.posts ?? [] }]}
          selected={posts}
          change={setPosts}
          searchLabel="Search consular posts"
        />
        <label className="field">
          <span>{t("Last updated")}</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value="30">{t("Within 30 days")}</option>
            <option value="60">{t("Within 60 days")}</option>
            <option value="90">{t("Within 90 days")}</option>
            <option value="0">{t("Any time")}</option>
          </select>
        </label>
      </div>
      <section className="wait-panel">
        <h2>{t("Active cases")}</h2>
        <div className="segmented" role="group" aria-label={t("Metric")}>
          {waitMetrics.map((m) => (
            <button
              key={m}
              aria-pressed={metric === m}
              className={metric === m ? "selected" : ""}
              onClick={() => setMetric(m)}
            >
              {t(metricText[m][0])}
            </button>
          ))}
        </div>
        <p className="method-note">
          {t(
            metric === "nvc"
              ? "From the first recorded NVC arrival to today, even if the case has moved on."
              : metric === "post"
                ? "From the first Ready milestone at the consular post to today."
                : "From the first interview to today for a reported 221(g) case with no completed reinterview.",
          )}
        </p>
        {stats ? (
          <>
            <strong>
              {t("{count} active cases in this view", {
                count: number(rows.length),
              })}
            </strong>
            <BoxPlot rows={rows} />
          </>
        ) : (
          !expanded && pending
        )}
        <details
          id="individual-cases"
          open={expanded}
          className="methodology wait-cases"
          onToggle={(e) => setExpanded(e.currentTarget.open)}
        >
          <summary>{t("Individual cases")}</summary>
          {expanded &&
            (!stats ? (
              pending
            ) : rows.length ? (
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label={t("Individual cases")}
              >
                <table>
                  <thead>
                    <tr>
                      {[
                        "Visa category",
                        "Consular post",
                        metricText[metric][1],
                        "Time waiting",
                      ].map((h) => (
                        <th key={h} scope="col">
                          {t(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => setActiveRow(r)}
                          >
                            {r.category} <span>{t("View timeline")}</span>
                          </button>
                        </td>
                        <td>{t(r.post)}</td>
                        <td>
                          <time dateTime={r.start}>{date(r.start)}</time>
                        </td>
                        <td>{waitLabel(r.start, stats.asOf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>{t("No cases match these filters yet")}</p>
            ))}
        </details>
        <p className="method-note">
          {t(
            "Only cases shared for the public timelines table appear here. Each row shows the visa type, consular post, milestone date and wait, without a name.",
          )}
        </p>
      </section>
      {activeRow && stats && rows.includes(activeRow) && (
        <Modal title={t("Visa timeline")} onClose={() => setActiveRow(null)}>
          <p>
            <strong>{activeRow.category}</strong> · {t(activeRow.post)}
          </p>
          <ol className="case-milestones">
            {(
              activeRow.history ?? [
                { type: metricText[metric][1], date: activeRow.start },
              ]
            ).map((event, i) => (
              <li key={i}>
                <time dateTime={event.date}>{date(event.date)}</time>{" "}
                <strong>{t(event.type)}</strong>
              </li>
            ))}
          </ol>
          <p>
            {t("Time waiting")}: {waitLabel(activeRow.start, stats.asOf)}
          </p>
        </Modal>
      )}
      <button className="text-button" onClick={() => setShowSources(true)}>
        <ExternalLink size={16} />
        {t("Other visa data sources")}
      </button>
      {showSources && (
        <Modal
          title={t("Other visa data sources")}
          onClose={() => setShowSources(false)}
        >
          <ul className="wait-sources">
            {sources.map(([name, href, description]) => (
              <li key={href}>
                <External href={href}>{name}</External>
                <p>{t(description)}</p>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
