import { useState } from "react";
import {
  anonymousRowsOnPage,
  signatoryPage,
  type SignatoryRoster,
} from "../../../../shared/signatories";
import { useData, usePublicView } from "../../app/api";
import { previewMode } from "../../app/preview";
import { PageIntro } from "../../components/ui";
import { getLocale, number, t } from "../../i18n/i18n";
import { SignatureNavigation } from "./signature-navigation";

export function Signatories() {
  const { profiles, loading } = useData();
  const [pages, setPages] = useState<string[]>([]);
  const [anonymousPage, setAnonymousPage] = useState(0);
  const before = pages.at(-1);
  const result = usePublicView<SignatoryRoster>(
    "/signatories" + (before ? "?" + new URLSearchParams({ before }) : ""),
  );
  let data = result?.data;
  if (previewMode && !loading) {
    const listed = profiles.filter((p) => p.listSignature);
    data = {
      ...signatoryPage(listed, before),
      total: profiles.length,
      anonymousCount: profiles.length - listed.length,
    };
  }
  const next = data?.next;
  const anonymous = data && anonymousRowsOnPage(data, anonymousPage);
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
          "Every petition signature is included. Signers who share their name and signing time appear first, newest first. All other signatures appear anonymously.",
        )}
      />
      <SignatureNavigation />
      {result?.error ? (
        <p role="alert">{t("Something went wrong. Please try again.")}</p>
      ) : !data ? (
        <p role="status">{t("Loading…")}</p>
      ) : data.total === 0 ? (
        <p>{t("No signatures to display.")}</p>
      ) : (
        <table className="signatories-table">
          <caption>
            {t("Total signatures: {count}", { count: number(data.total) })}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("Name")}</th>
              <th scope="col">{t("Signed at")}</th>
            </tr>
          </thead>
          <tbody>
            {anonymousPage === 0 &&
              data.signatories.map(({ name, signedAt }, i) => (
                <tr key={signedAt + "-" + i}>
                  <td dir="auto">{name}</td>
                  <td>
                    <time dateTime={signedAt}>
                      {format.format(new Date(signedAt))}
                    </time>
                  </td>
                </tr>
              ))}
            {Array.from({ length: anonymous?.count ?? 0 }, (_, i) => (
              <tr key={"anon-" + i}>
                <td>{t("Anonymous signer")}</td>
                <td>{t("Private")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="signatory-pagination">
        {(before || anonymousPage > 0) && (
          <button
            className="button outline"
            onClick={() =>
              anonymousPage > 0
                ? setAnonymousPage(anonymousPage - 1)
                : setPages(pages.slice(0, -1))
            }
          >
            {t("Previous page")}
          </button>
        )}
        {(next || anonymous?.hasMore) && (
          <button
            className="button outline"
            onClick={() =>
              next
                ? setPages([...pages, next])
                : setAnonymousPage(anonymousPage + 1)
            }
          >
            {t("Next page")}
          </button>
        )}
      </div>
    </div>
  );
}
