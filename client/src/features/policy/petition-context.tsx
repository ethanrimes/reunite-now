import { useState, type CSSProperties } from "react";
import { getLocale, t } from "../../i18n/i18n";
import { Minus, Plus } from "lucide-react";
import { SectionControls } from "./section-controls";
import timeline from "./petition-timeline.en.json";
import "../../styles/petition-context.css";

export function PetitionContext() {
  const [visiblePeriods, setVisiblePeriods] = useState(2);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const nextPeriod = timeline.periods[visiblePeriods];

  const dateFormat = new Intl.DateTimeFormat(getLocale(), {
    dateStyle: "long",
    timeZone: "UTC",
  });

  return (
    <section
      className="section petition-context"
      id="why-the-wait"
      aria-labelledby="why-the-wait-title"
    >
      <header className="policy-intro">
        <h2 id="why-the-wait-title">{t(timeline.heading)}</h2>
        <p>
          {t(timeline.intro.text)
            .split(/(\{statistic\}|\{publication\})/)
            .map((part) => {
              if (part === "{statistic}")
                return (
                  <strong key={part}>{t(timeline.intro.statistic)}</strong>
                );
              if (part === "{publication}")
                return (
                  <strong key={part}>{t(timeline.intro.publication)}</strong>
                );
              return part;
            })}
        </p>
      </header>
      <div id="policy-periods" className="policy-trail">
        {timeline.periods.slice(0, visiblePeriods).map((period, row) => (
          <ol
            key={period.label}
            aria-label={t(period.label)}
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
                      <time dateTime={event.date}>
                        {dateFormat.format(new Date(event.date))}:{" "}
                      </time>
                      <span className="petition-stop-title">
                        {t(event.title)}
                      </span>
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
                    <p>{t(event.body)}</p>
                    {event.sources.map((source) => (
                      <p className="policy-source" key={source.url}>
                        {t(source.label)}:{" "}
                        <a href={source.url} dir="ltr">
                          {source.url}
                        </a>
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
        collapseLabel={t("Collapse timeline")}
        contentId="policy-periods"
        moreLabel={
          nextPeriod && t("Show {period}", { period: t(nextPeriod.label) })
        }
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
