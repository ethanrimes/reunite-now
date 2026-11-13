import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { t, languageDirection } from "./i18n";
import { useLanguage } from "./language";

export function ScrollRail({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id: string;
}) {
  const rtl = languageDirection(useLanguage()) === "rtl";
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const el = ref.current!;
    const update = () =>
      setEdges({
        start: Math.abs(el.scrollLeft) < 4,
        end: Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 4,
      });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [children, rtl]);
  const move = (direction: number) => {
    const el = ref.current!;
    el.scrollBy({
      left: direction * (rtl ? -1 : 1) * el.clientWidth * 0.8,
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
          {rtl ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Next items")}
          aria-controls={id}
          disabled={edges.end}
          onClick={() => move(1)}
        >
          {rtl ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
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
