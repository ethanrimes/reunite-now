import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, PenLine, Camera, CalendarDays } from "lucide-react";
import { t } from "./i18n";
import { ScrollRail } from "./scroll-rail";
import { date } from "./ui";
import { PolicyTimeline } from "./policy-timeline";
import { policies } from "../../shared/policies";
import { participation, policyEvents, reviewedAt } from "../../shared/campaign";

export function GovernmentTimeline() {
  const [filter, setFilter] = useState("All");
  const [newest, setNewest] = useState(true);
  const events = policyEvents.filter(
    (e) => filter === "All" || e.kind === filter,
  );
  if (newest) events.reverse();
  return (
    <section className="section government-timeline" id="policy-timeline">
      <div className="section-heading">
        <div>
          <h2>{t("The decisions behind the delays.")}</h2>
          <p>
            {t(
              "Restrictions, processing changes and court rulings that shaped the wait.",
            )}
          </p>
        </div>
        <span className="reviewed-date">
          {t("Sources checked")} {date(reviewedAt)}
        </span>
      </div>
      <div className="timeline-tools">
        <div className="segmented" aria-label={t("Filter policy timeline")}>
          {["All", "Restriction", "Processing change", "Court ruling"].map(
            (kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={filter === kind}
                className={filter === kind ? "selected" : ""}
                onClick={() => setFilter(kind)}
              >
                {t(kind)}
              </button>
            ),
          )}
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => setNewest(!newest)}
        >
          {newest ? t("Newest first") : t("Oldest first")} ↕
        </button>
      </div>
      <PolicyTimeline key={`${filter}-${newest}`} events={events} />
      <p className="method-note">
        {t(
          "Selected documented events, reviewed on the date above. A past pause is not necessarily in force today; follow each source for its scope and updates.",
        )}
      </p>
    </section>
  );
}
export function Participate() {
  const icons = [PenLine, CalendarDays, Camera];
  return (
    <section className="section participation" id="take-part">
      <div className="section-heading">
        <h2>{t("Make the case for change.")}</h2>
        <p>
          {t(
            "A signature shows support. A timeline documents the wait. A story makes the cost visible.",
          )}
        </p>
      </div>
      <div className="participation-grid">
        {participation.map((item, i) => {
          const Icon = icons[i];
          return (
            <article key={item.to}>
              <Icon size={24} />
              <h3>{t(item.title)}</h3>
              <p>{t(item.text)}</p>
              <Link className="text-button" to={item.to}>
                {t(item.action)} <ArrowUpRight size={17} />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
export function SupportActions() {
  return (
    <section className="section action-preview">
      <div className="section-heading">
        <div>
          <h2>{t("Action you can support.")}</h2>
          <p>
            {t(
              "Follow the legislation, contact the people working on these cases, and add your voice.",
            )}
          </p>
        </div>
        <Link className="text-button" to="/policies">
          {t("All initiatives")} <ArrowUpRight size={18} />
        </Link>
      </div>
      <ScrollRail id="support-actions" title={t("Actions to support")}>
        {policies
          .filter(
            (policy) =>
              !policy.status.startsWith("Historical") &&
              !policy.status.startsWith("Enacted"),
          )
          .map((policy) => (
            <article className="support-card" key={policy.id}>
              <span className="tag">{t(policy.kind)}</span>
              <h3>{t(policy.title)}</h3>
              <p>{t(policy.summary)}</p>
              <span className="event-status">{t(policy.status)}</span>
              <Link className="text-button" to={`/policies/${policy.id}`}>
                {t("How to help & latest updates")} <ArrowUpRight size={17} />
              </Link>
            </article>
          ))}
      </ScrollRail>
    </section>
  );
}
