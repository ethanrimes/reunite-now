import { maintainerEmail } from "../../../shared/feedback";
import { t } from "../i18n/i18n";
import { Link } from "react-router-dom";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { PageIntro, date } from "../components/ui";
import { consentVersion } from "../../../shared/schema";

export function DataUse() {
  return (
    <div className="page-shell narrow">
      <PageIntro
        eyebrow={t("DATA USE & PRIVACY")}
        title={
          <>
            {t("How we use")} {t("your data.")}
          </>
        }
        text={t(
          "Clear information about what you share, what is public, and how to take it back.",
        )}
      />
      <div className="privacy-summary">
        <ShieldCheck size={30} />
        <p>
          {t(
            "Your email is private. With your consent, your signature and timeline contribute to public statistics. You choose whether to publish your story and photos.",
          )}
        </p>
      </div>
      <div className="prose">
        <h2>{t("Export, correct, or delete")}</h2>
        <p>
          {t(
            "To delete your own data, open Account → Configuration → Delete account. You can do this yourself without emailing us.",
          )}
        </p>
        <p>
          {t(
            "Choose Export my data in Account → Configuration to download your records. Each account can export only its own data.",
          )}
        </p>
        <Link className="button" to="/account#settings">
          {t("Manage my data ")}
          <ArrowUpRight size={18} />
        </Link>
        <p>
          {t(
            "You can contact Ethan Kallett, the project maintainer, about any privacy concern. For example, he can help if you can’t sign in, someone has shared information about you, or you want reminders to stop.",
          )}{" "}
          {t("Email him at")}{" "}
          <a dir="ltr" href={`mailto:${maintainerEmail}`}>
            {maintainerEmail}
          </a>
          .
        </p>
        <p>
          {t(
            "If you can sign in, you can also use the feedback form to reach the same inbox.",
          )}{" "}
          <Link to="/feedback">{t("Use the project feedback form")}</Link>
        </p>
        <p>
          {t(
            "We use your consent to publish the petition and optional stories. You can withdraw it at any time. Where applicable, you can also request access, correction, erasure, restriction or portability and complain to your local data protection authority.",
          )}
        </p>
        <h2>{t("Hosting, access and retention")}</h2>
        <p>
          {t(
            "We offer regional storage to support data residency choices and respect privacy rights, including those under the EU GDPR.",
          )}
        </p>
        <p>
          {t(
            "When you create an account, we check your IP address against a local copy of the DB-IP country database. An EU address selects Sweden. Other or unrecognized addresses select the United States. The lookup does not send your IP to DB-IP or save it in either account database.",
          )}{" "}
          <a href="https://db-ip.com/">{"IP geolocation by DB-IP"}</a>
        </p>
        <p>
          {t(
            "To change regions, open Account → Configuration → Account storage, choose a region and select Move my account. Accounts created before regional selection started in Sweden.",
          )}
        </p>
        <p>
          {t(
            "Public maps, timelines and published stories combine submissions from both regions. The US web service processes requests for both. The reminder scheduler runs in Sweden and our email service processes delivery data in the US. After a move, the old region may retain a backup during its recovery window.",
          )}
        </p>
        <p>
          {t(
            "Your account and signature have no automatic expiry. Stories, including unpublished drafts, stay until you delete them or your account. Sign-in links expire after 15 minutes and sessions expire after 30 days.",
          )}
        </p>
        <p>
          {t(
            "Visit your account to edit your profile, download your data, remove a visa case, unpublish your story, or permanently delete your account. Deletion removes your account, signature, case timelines, story photos, sessions, and reminder records from the live database. Aggregate statistics then recalculate without your records.",
          )}
        </p>
        <p>
          {t(
            "Azure provides a seven-day database recovery window. Backup files can persist longer. Before a restore goes online, deletions must be reapplied. Other people may keep copies of public submissions. Email providers may retain delivery records.",
          )}
        </p>
        <h2>{t("What other people can see")}</h2>
        <p>
          {t(
            "Maps show signature counts by location and selected filters. Visa tables summarize reported cases and waiting times. Published stories show your name, country, text and photos. Leave out passport and receipt numbers, addresses, birth dates, identity documents and other identifying details.",
          )}
        </p>
        <p>{t("Signing requires your consent to publish your name and signing time. You can hide them later in Account → Configuration. Earlier signatures appear anonymously unless the signer chose to be listed by name.")}</p>
        <p>
          {t(
            "Sign the petition using your own name. Get that person’s permission before publishing information about them. Visa applicants may use a nickname in their case details. You must be at least 18 to create an account.",
          )}
        </p>
        <h2>{t("What stays private")}</h2>
        <p>
          {t(
            "Your sign-in email address and any reminder addresses stay off public profiles, maps, and stories. We store them to operate your account and deliver the emails you request. Anyone with access to the account database can read these addresses, including the project maintainer if they have that access.",
          )}
        </p>
        <p>
          {t(
            "For email sign-in, Reunite Now verifies a single-use link delivered by Azure Communication Services. If you choose Google sign-in, Google verifies your identity and provides your verified email address to Reunite Now.",
          )}
        </p>
        <h2>{t("Statistics and interpretation")}</h2>
        <p>
          {t(
            "Statistics summarize voluntarily submitted cases. They are not a representative sample, official agency statistics, or a prediction. Each median shows its sample size. Missing dates are excluded from that metric. A future interview is not a completed interview. Administrative processing and policy-related refusals remain active unless a final decision or withdrawal is recorded. An approved or issued case is closed unless subsequently reopened.",
          )}
        </p>
        <h2>{t("Photos and stories")}</h2>
        <p>
          {t(
            "You control whether your story is published. Only upload photos you have permission to share, including permission from identifiable people. The photo uploader resizes images and re-encodes them to remove embedded metadata. You can unpublish or delete your story from your account.",
          )}
        </p>
        <h2>{t("Monthly reminders")}</h2>
        <p>
          {t(
            "Reminders are optional. For active cases not confirmed in at least 30 days, we send at most one reminder per calendar month to each selected address. Your sign-in email receives reminders, and you can add up to 5 other addresses you own or have permission to notify. Each recipient gets a separate email without applicant details or other recipients’ addresses. Add a dated milestone or confirm no change in your account; reminders never update timelines automatically. Edit recipients or turn reminders off in Account.",
          )}
        </p>

        <h2>{t("Services that process data")}</h2>
        <p>
          {t(
            "The feedback form emails your message and sign-in email address to the maintainer through Azure Communication Services. Cloudflare forwards project correspondence to Gmail. These messages may travel outside the EU and are stored in email, outside the petition databases.",
          )}
        </p>
        <p>
          {t(
            "Microsoft Azure hosts the application, database, and scheduled work. Azure Communication Services handles email when enabled. Google handles Google sign-in if you choose it. Public policy links and contact links take you to external organizations. We do not share submissions with those organizations.",
          )}
        </p>
        <h2>{t("Agreement version")}</h2>
        <p>
          <time dateTime={consentVersion}>{date(consentVersion)}</time>
          {". "}
          {t(
            "The version accepted with your signature is recorded. This is an independent advocacy project, not a law firm or government service.",
          )}
        </p>
      </div>
    </div>
  );
}
