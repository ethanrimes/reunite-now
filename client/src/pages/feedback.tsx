import { useState, type FormEvent } from "react";
import { feedbackMessageLimit, maintainerEmail } from "../../../shared/feedback";
import { Link } from "react-router-dom";
import { api, useData } from "../app/api";
import { t } from "../i18n/i18n";
import { previewMode } from "../app/preview";
import { Field, Notice } from "../components/ui";

export function Feedback() {
  const { me, loading } = useData();
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
          message: fields.get("message"),
        }),
      });
      form.reset();
      setSent(true);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "";
      setError(
        detail === "Please sign in to continue" ||
          detail === "Too many messages. Please try again in 15 minutes." ||
          detail === "Enter a message of up to 4,000 characters."
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
              "Report a bug, suggest a feature, ask a question, or send a request or complaint. Your request goes directly to the project maintainer, Ethan Kallett.",
            )}
          </p>
        </div>
      </header>
      {previewMode ? (
        <a href="/feedback" className="button">
          {t("Use the project feedback form")}
        </a>
      ) : loading ? (
        <p role="status">{t("Loading…")}</p>
      ) : !me.user ? (
        <Link className="button" to="/login?intent=feedback">
          {t("Sign in to send feedback")}
        </Link>
      ) : (
        <form
          onSubmit={submit}
          onChange={() => {
            setSent(false);
            setError("");
          }}
        >
          <dl className="feedback-identity">
            <dt>{t("Reply email")}</dt>
            <dd>
              <bdi dir="ltr">{me.user.email}</bdi>
            </dd>
          </dl>
          <Field
            label={t("Your message")}
            hint={t(
              "Please leave out visa case numbers and other personally identifiable information.",
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
              {error === "Please sign in to continue" ? (
                <Link to="/login?intent=feedback">
                  {t("Sign in to send feedback")}
                </Link>
              ) : (
                <a href={`mailto:${maintainerEmail}`}>{maintainerEmail}</a>
              )}
            </Notice>
          )}
        </form>
      )}
    </div>
  );
}
