import { useState } from "react";
import { signatoryPage } from "../../../../shared/signatories";
import { useData, usePublicView } from "../../app/api";
import { previewMode } from "../../app/preview";
import { PageIntro } from "../../components/ui";
import { getLocale, t } from "../../i18n/i18n";
import { SignatureNavigation } from "./signature-navigation";

export function Signatories() {
  const { profiles, loading } = useData();
  const [pages, setPages] = useState<string[]>([]);
  const before = pages.at(-1);
  const result = usePublicView<ReturnType<typeof signatoryPage>>(
    "/signatories" + (before ? "?" + new URLSearchParams({ before }) : ""),
  );
  const data =
    previewMode && !loading
      ? signatoryPage(
          profiles.filter((p) => p.listSignature),
          before,
        )
      : result?.data;
  const next = data?.next;
  const format = new Intl.DateTimeFormat(getLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow={t("SIGNATURE COVERAGE")}
        title={t("Signatories")}
        text={t(
          "People who chose to share their name and signing time, newest first.",
        )}
      />
      <SignatureNavigation />
      {result?.error ? (
        <p role="alert">{t("Something went wrong. Please try again.")}</p>
      ) : !data ? (
        <p role="status">{t("Loading…")}</p>
      ) : data.signatories.length === 0 ? (
        <p>{t("No signatures to display.")}</p>
      ) : (
        <table className="signatories-table">
          <thead>
            <tr>
              <th scope="col">{t("Name")}</th>
              <th scope="col">{t("Signed at")}</th>
            </tr>
          </thead>
          <tbody>
            {data.signatories.map(({ name, signedAt }, i) => (
              <tr key={signedAt + "-" + i}>
                <td dir="auto">{name}</td>
                <td>
                  <time dateTime={signedAt}>
                    {format.format(new Date(signedAt))}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="signatory-pagination">
        {before && (
          <button
            className="button outline"
            onClick={() => setPages(pages.slice(0, -1))}
          >
            {t("Newer signatures")}
          </button>
        )}
        {next && (
          <button
            className="button outline"
            onClick={() => setPages([...pages, next])}
          >
            {t("Older signatures")}
          </button>
        )}
      </div>
    </div>
  );
}
