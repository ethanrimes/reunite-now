import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { PolicyEvent } from "../../shared/campaign";
import { t } from "./i18n";
import { useLanguage } from "./language";
import { date, External } from "./ui";
import { ScrollRail } from "./scroll-rail";

export function PolicyTimeline({ events }: { events: PolicyEvent[] }) {
  const language = useLanguage();
  const [active, setActive] = useState<string | null>(null);
  const [position, setPosition] = useState({
    left: 16,
    top: 16,
    ready: false,
    maxHeight: 600,
  });
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const card = useRef<HTMLElement>(null);
  const suppressFocus = useRef(false);
  const event = events.find((item) => item.date === active);
  const close = () => {
    if (card.current?.contains(document.activeElement)) {
      suppressFocus.current = true;
      buttons.current.get(active!)?.focus({ preventScroll: true });
      suppressFocus.current = false;
    }
    setActive(null);
  };
  useLayoutEffect(() => {
    if (!active || !card.current) return;
    const place = () => {
      const button = buttons.current.get(active);
      const panel = card.current;
      if (!button || !panel) return;
      const rect = button.getBoundingClientRect();
      const rail = button.closest(".scroll-rail")!.getBoundingClientRect();
      const point = button
        .querySelector(".policy-point")!
        .getBoundingClientRect();
      // Dismiss when the selected point scrolls out of view.
      if (
        point.right <= rail.left ||
        point.left >= rail.right ||
        point.top < 16 ||
        point.bottom > window.innerHeight - 16
      ) {
        setActive(null);
        return;
      }
      const gap = 12;
      const left = Math.max(
        16,
        Math.min(
          rect.left + rect.width / 2 - panel.offsetWidth / 2,
          window.innerWidth - panel.offsetWidth - 16,
        ),
      );
      const roomBelow = window.innerHeight - point.bottom - gap - 16;
      const roomAbove = point.top - gap - 16;
      const useBelow =
        roomBelow >= panel.scrollHeight || roomBelow >= roomAbove;
      const maxHeight = Math.max(120, useBelow ? roomBelow : roomAbove);
      const top = useBelow
        ? point.bottom + gap
        : Math.max(
            16,
            point.top - Math.min(panel.scrollHeight, maxHeight) - gap,
          );
      setPosition({ left, top, ready: true, maxHeight });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(card.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [active, language]);
  useEffect(() => {
    if (!active) return;
    const dismiss = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        !card.current?.contains(target) &&
        ![...buttons.current.values()].some((button) => button.contains(target))
      )
        setActive(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [active]);
  return (
    <>
      <p className="timeline-hint">
        {t("Hover, tap, or focus on an event to read what changed.")}
      </p>
      <div className="policy-line">
        <ScrollRail
          id="government-events"
          title={t("Government policy timeline")}
        >
          {events.map((item, index) => (
            <div className="policy-stop" key={item.date} data-kind={item.kind}>
              <button
                ref={(node) => {
                  if (node) buttons.current.set(item.date, node);
                  else buttons.current.delete(item.date);
                }}
                type="button"
                className="policy-stop-button"
                aria-expanded={active === item.date}
                aria-controls={
                  active === item.date ? "policy-event-details" : undefined
                }
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setActive(item.date);
                }}
                onFocus={() => {
                  if (!suppressFocus.current) setActive(item.date);
                }}
                onClick={() => setActive(item.date)}
                onKeyDown={(e) => {
                  if (e.key === "Tab" && !e.shiftKey && active === item.date) {
                    e.preventDefault();
                    card.current
                      ?.querySelector<HTMLButtonElement>("button")
                      ?.focus();
                    return;
                  }
                  const rtl =
                    e.currentTarget.closest('[dir="rtl"]') ||
                    document.documentElement.dir === "rtl";
                  let next = index;
                  if (e.key === "ArrowRight") next += rtl ? -1 : 1;
                  else if (e.key === "ArrowLeft") next += rtl ? 1 : -1;
                  else if (e.key === "Home") next = 0;
                  else if (e.key === "End") next = events.length - 1;
                  else return;
                  e.preventDefault();
                  buttons.current
                    .get(
                      events[Math.max(0, Math.min(events.length - 1, next))]
                        .date,
                    )
                    ?.focus();
                }}
              >
                <time dateTime={item.date}>{date(item.date)}</time>
                <span className="policy-point" aria-hidden="true" />
                <span className="event-kind">{t(item.kind)}</span>
                <span className="policy-stop-title">{t(item.title)}</span>
              </button>
            </div>
          ))}
        </ScrollRail>
      </div>
      {event &&
        createPortal(
          <article
            ref={card}
            id="policy-event-details"
            className="policy-event-popover"
            aria-labelledby="policy-event-title"
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              if (
                e.shiftKey &&
                e.target === card.current?.querySelector("button")
              ) {
                e.preventDefault();
                buttons.current.get(active!)?.focus({ preventScroll: true });
              } else if (
                !e.shiftKey &&
                e.target === card.current?.querySelector("a")
              ) {
                const index = events.findIndex((item) => item.date === active);
                const next = events[index + 1];
                if (next) {
                  e.preventDefault();
                  buttons.current.get(next.date)?.focus();
                } else close();
              }
            }}
            style={{
              left: position.left,
              top: position.top,
              maxHeight: position.maxHeight,
              visibility: position.ready ? "visible" : "hidden",
            }}
          >
            <button
              className="icon-button policy-event-close"
              type="button"
              aria-label={t("Close event details")}
              onClick={close}
            >
              <X size={18} />
            </button>
            <div key={event.date} className="policy-event-content">
              <span className="event-kind">{t(event.kind)}</span>
              <time dateTime={event.date}>{date(event.date)}</time>
              <h3 id="policy-event-title">{t(event.title)}</h3>
              <p>{t(event.text)}</p>
              <div className="event-status">{t(event.status)}</div>
              <External href={event.source.url}>
                {t(event.source.label)}
              </External>
            </div>
          </article>,
          document.body,
        )}
    </>
  );
}
