import { BillRecord } from "./legislation";
import { t } from "../../i18n/i18n";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Search, Check } from "lucide-react";
import {
  PageIntro,
  External,
  Empty,
  date,
} from "../../components/ui";
import { policies } from "../../../../shared/policies";

export function Policies() {
  const [kind, setKind] = useState("All");
  const [theme, setTheme] = useState("All");
  const [period, setPeriod] = useState("All");
  const [q, setQ] = useState("");
  const items = policies.filter(
    (p) =>
      (kind === "All" || p.kind === kind) &&
      (theme === "All" || p.theme === theme) &&
      (period === "All" ||
        (period === "Historical") === p.status.startsWith("Historical")) &&
      `${t(p.title)} ${p.eyebrow} ${t(p.summary)}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow={t("POLICY & ACTION")}
        title={<>{t("Policy & legal cases")}</>}
        text={t(
          "Track legislation and lawsuits affecting visa processing. Read the background, check the sources, and find ways to get involved.",
        )}
      />
      <div className="toolbar">
        <div className="segmented">
          {["All", "Legislation", "Legal case"].map((x) => (
            <button
              key={x}
              className={kind === x ? "selected" : ""}
              onClick={() => setKind(x)}
            >
              {x === "All"
                ? t("All initiatives")
                : x === "Legal case"
                  ? t("Legal cases")
                  : t(x)}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            aria-label={t("Search initiatives")}
            placeholder={t("Search initiatives")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select
          aria-label={t("Filter by advocacy goal")}
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="All">{t("All")}</option>
          {[...new Set(policies.map((p) => p.theme))].map((x) => (
            <option key={x} value={x}>
              {t(x)}
            </option>
          ))}
        </select>
      </div>
      <label className="period-filter">
        {t("Congressional period")}
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="All">{t("All")}</option>
          <option value="Current">{t("Current Congress & legal cases")}</option>
          <option value="Historical">{t("Historical legislation")}</option>
        </select>
      </label>
      <div className="policy-grid three">
        {items.map((p) => (
          <Link key={p.id} to={`/policies/${p.id}`} className="policy-card">
            <div className="card-top">
              <span className="tag">{t(p.kind)}</span>
              <ArrowUpRight />
            </div>
            <div className="eyebrow">{t(p.eyebrow)}</div>
            <h3>{t(p.title)}</h3>
            <p>{t(p.summary)}</p>
            <div className="card-bottom">
              <span className="status-dot" />
              {t(p.status)}
            </div>
            <small>
              {t("Reviewed ")}
              {date(p.updated)}
            </small>
          </Link>
        ))}
      </div>
      {!items.length && (
        <Empty title={t("No matching initiatives")}>
          {t("Try a different search or filter.")}
        </Empty>
      )}
      <p className="method-note">
        {t(
          "Updates are editorially reviewed snapshots, not a live court docket. Each initiative links to its sources and shows when it was reviewed. Litigation summaries are general information, not legal advice.",
        )}
      </p>
    </div>
  );
}
export function PolicyDetail() {
  const { id } = useParams();
  const p = policies.find((p) => p.id === id);
  if (!p)
    return (
      <div className="page-shell">
        <Empty title={t("Initiative not found")}>
          {t("Return to ")}
          <Link to="/policies">{t("policy & action")}</Link>.
        </Empty>
      </div>
    );
  return (
    <div className="page-shell">
      <Link className="back-link" to="/policies">
        {t("← All initiatives")}
      </Link>
      <PageIntro eyebrow={t(p.eyebrow)} title={t(p.title)} text={t(p.summary)}>
        <span className="tag">{t(p.status)}</span>
      </PageIntro>
      <div className="detail-grid">
        <article>
          <section>
            <h2>{t("Background")}</h2>
            <p className="large-copy">{t(p.background)}</p>
          </section>
          {p.goals.length > 0 && (
            <section>
              <h2>{t("Goals")}</h2>
              <ul className="check-list">
                {p.goals.map((g) => (
                  <li key={g}>
                    <Check size={18} />
                    {t(g)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <BillRecord topicId={p.id} />
          <section>
            <h2>{t("Timeline & updates")}</h2>
            <ol className="timeline">
              {p.timeline.map((entry, i) => (
                <li key={i}>
                  <time>{date(entry.date)}</time>
                  <div>
                    <strong>{t(entry.title)}</strong>
                    <p>{t(entry.text)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </article>
        <aside>
          {p.contribute && (
            <div className="side-card">
              <span className="eyebrow">{t("HOW TO HELP")}</span>
              <h3>{t("Get involved")}</h3>
              <p>{t(p.contribute)}</p>
              {p.contact && (
                <External href={p.contact.url}>{t(p.contact.label)}</External>
              )}
            </div>
          )}
          <div className="side-card light">
            <h3>{t("Sources")}</h3>
            {p.sources.map((s) => (
              <External key={s.url} href={s.url}>
                {t(s.label)}
              </External>
            ))}
            <small>
              {t("Reviewed ")}
              {date(p.updated)}
              {t(". Recheck sources before acting.")}
            </small>
          </div>
        </aside>
      </div>
    </div>
  );
}
