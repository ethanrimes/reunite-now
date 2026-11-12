import { t, getLocale } from "./i18n";
import { useEffect, useRef, type ReactNode } from "react";
import { X, ArrowUpRight } from "lucide-react";
import type { VisaEvent } from "../../shared/schema";
export function External({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      className="external"
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel="noreferrer"
    >
      {children}
      <ArrowUpRight size={15} />
    </a>
  );
}
export function PageIntro({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  text: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-intro">
      <div>
        <div className="eyebrow">{t(eyebrow)}</div>
        <h1>{typeof title === "string" ? t(title) : title}</h1>
        <p>{t(text)}</p>
      </div>
      {children}
    </header>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-top">
        <span className="eyebrow">
          {typeof title === "string" ? t(title) : title}
        </span>
        <button
          className="icon-button"
          aria-label={t("Close dialog")}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Timeline({ events }: { events: VisaEvent[] }) {
  return (
    <ol className="timeline">
      {[...events]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => (
          <li key={e.id}>
            <time>{date(e.date)}</time>
            <div>
              <strong>{t(e.type)}</strong>
              {e.date > new Date().toISOString().slice(0, 10) && (
                <span className="tag">{t("Scheduled")}</span>
              )}
              {e.note && <p>{e.note}</p>}
            </div>
          </li>
        ))}
    </ol>
  );
}
export function date(s: string) {
  return new Date(s.length === 10 ? `${s}T12:00:00Z` : s).toLocaleDateString(
    getLocale(),
    { month: "short", day: "numeric", year: "numeric" },
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">↗</span>
      <h3>{typeof title === "string" ? t(title) : title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{t(label)}</span>
      {children}
      {hint && <small>{t(hint)}</small>}
    </label>
  );
}
