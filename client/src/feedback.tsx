import { useState, type FormEvent } from "react";
import { feedbackMessageLimit, maintainerEmail } from "../../shared/feedback";
import { api } from "./api";
import { t } from "./i18n";
import { previewMode } from "./preview";
import { Field, Notice } from "./ui";

export function Feedback() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setSending(true);
    setError("");
    setSent(false);
    try {
      await api("/feedback", {
        method: "POST",
        body: JSON.stringify({
          email: fields.get("email"),
          message: fields.get("message"),
        }),
      });
      form.reset();
      setSent(true);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "";
      setError(
        detail === "Too many messages. Please try again in 15 minutes." ||
          detail ===
            "Enter a valid email address and a message of up to 4,000 characters."
          ? detail
          : "We couldn’t confirm your message was sent. Try again or email the maintainer directly.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-shell narrow">
      <header className="page-intro">
        <div>
          <h1>{t("Project feedback")}</h1>
          <p>
            {t(
              "Report a bug, suggest a feature, ask a question, or send a request or complaint. Your message goes privately to Ethan Kallett, the project maintainer.",
            )}
          </p>
        </div>
      </header>
      {previewMode ? (
        <a href="/feedback" className="button">
          {t("Use the project feedback form")}
        </a>
      ) : (
        <form
          onSubmit={submit}
          onChange={() => {
            setSent(false);
            setError("");
          }}
        >
          <Field
            label={t("Email address")}
            hint={t("The maintainer can reply to you at this address.")}
          >
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              readOnly={sending}
            />
          </Field>
          <Field
            label={t("Your message")}
            hint={t(
              "Please leave out visa case numbers and identity documents.",
            )}
          >
            <textarea
              name="message"
              rows={7}
              maxLength={feedbackMessageLimit}
              required
              readOnly={sending}
            />
          </Field>
          <button className="button" type="submit" disabled={sending}>
            {sending ? t("Sending…") : t("Send feedback")}
          </button>
          {sent && (
            <Notice tone="success">
              {t("Thank you. Your feedback has been sent to the maintainer.")}
            </Notice>
          )}
          {error && (
            <Notice tone="error">
              {t(error)}{" "}
              <a href={`mailto:${maintainerEmail}`}>{maintainerEmail}</a>
            </Notice>
          )}
        </form>
      )}
    </div>
  );
}
