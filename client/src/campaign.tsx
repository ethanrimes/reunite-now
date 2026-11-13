import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  PenLine,
  Camera,
  CalendarDays,
} from "lucide-react";
import { t } from "./i18n";
import { date, External } from "./ui";
import { policies } from "../../shared/policies";
import { participation, policyEvents, reviewedAt } from "../../shared/campaign";

export function ScrollRail({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const el = ref.current!;
    const update = () =>
      setEdges({
        start: el.scrollLeft < 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [children]);
  const move = (direction: number) => {
    const el = ref.current!;
    el.scrollBy({
      left: direction * el.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  return (
    <>
      <div className="rail-controls">
        <span>{t("Scroll to explore")}</span>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Previous items")}
          aria-controls={id}
          disabled={edges.start}
          onClick={() => move(-1)}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Next items")}
          aria-controls={id}
          disabled={edges.end}
          onClick={() => move(1)}
        >
          <ArrowRight size={18} />
        </button>
      </div>
      <div
        ref={ref}
        id={id}
        className="scroll-rail"
        role="region"
        aria-label={title}
        tabIndex={0}
      >
        {children}
      </div>
    </>
  );
}
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
      <ScrollRail
        id="government-events"
        title={t("Government policy timeline")}
      >
        {events.map((event) => (
          <article className="event-card" key={event.date}>
            <time dateTime={event.date}>{date(event.date)}</time>
            <span className="event-kind">{t(event.kind)}</span>
            <h3>{t(event.title)}</h3>
            <p>{t(event.text)}</p>
            <span className="event-status">{t(event.status)}</span>
            <External href={event.source.url}>{t(event.source.label)}</External>
          </article>
        ))}
      </ScrollRail>
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
