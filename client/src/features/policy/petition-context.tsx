import { useState, type CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";
import { SectionControls } from "./section-controls";
import timeline from "./petition-timeline.en.json";
import "../../styles/petition-context.css";

export function PetitionContext() {
  const [visiblePeriods, setVisiblePeriods] = useState(2);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const nextPeriod = timeline.periods[visiblePeriods];

  return (
    <section
      className="section petition-context"
      id="why-the-wait"
      lang="en"
      dir="ltr"
      aria-labelledby="why-the-wait-title"
    >
      <header className="policy-intro">
        <h2 id="why-the-wait-title">{timeline.heading}</h2>
        <p>
          {timeline.intro.before}
          <strong>{timeline.intro.emphasis}</strong>
          {timeline.intro.after}
        </p>
      </header>
      <div id="policy-periods" className="policy-trail">
        {timeline.periods.slice(0, visiblePeriods).map((period, row) => (
          <ol
            key={period.label}
            aria-label={period.label}
            className="policy-row"
            style={{ "--stops": period.events.length } as CSSProperties}
          >
            {period.events.map((event, index) => {
              const expanded = openDate === event.date;
              const column =
                row % 2 === 0 ? index + 1 : period.events.length - index;
              const panelId = "policy-" + event.date;
              return (
                <li
                  key={event.date}
                  className="petition-stop"
                  style={{ "--column": column } as CSSProperties}
                >
                  <h3>
                    <button
                      type="button"
                      id={panelId + "-toggle"}
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setOpenDate(expanded ? null : event.date)}
                    >
                      <time dateTime={event.date}>{event.dateLabel}: </time>
                      <span className="petition-stop-title">{event.title}</span>
                      {expanded ? (
                        <Minus aria-hidden="true" />
                      ) : (
                        <Plus aria-hidden="true" />
                      )}
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    className="policy-reading"
                    role="region"
                    aria-labelledby={panelId + "-toggle"}
                    hidden={!expanded}
                  >
                    <p>{event.body}</p>
                    {event.sources.map((source) => (
                      <p className="policy-source" key={source.url}>
                        {source.label}: <a href={source.url}>{source.url}</a>
                      </p>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        ))}
      </div>
      <SectionControls
        canCollapse={visiblePeriods > 1}
        onCollapse={() => {
          setVisiblePeriods(1);
          setOpenDate(null);
        }}
        noun="timeline"
        contentId="policy-periods"
        moreLabel={nextPeriod && "Show " + nextPeriod.label}
        onMore={() => {
          setVisiblePeriods(visiblePeriods + 1);
          requestAnimationFrame(() =>
            document
              .getElementById("policy-" + nextPeriod.events[0].date + "-toggle")
              ?.focus(),
          );
        }}
      />
    </section>
  );
}
