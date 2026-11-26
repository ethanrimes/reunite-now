import { t } from "../i18n/i18n";
import { Link } from "react-router-dom";
import { PageIntro, External } from "../components/ui";

export function About() {
  return (
    <div className="page-shell narrow">
      <PageIntro
        eyebrow={t("ABOUT REUNITE NOW")}
        title={<>{t("About Reunite Now")}</>}
        text={t(
          "We bring families and supporters together to press Congress for shorter U.S. visa waits and clearer answers about delays.",
        )}
      />
      <div className="prose">
        <h2>{t("What one district can ask of Congress")}</h2>
        <p>
          {t(
            "When you contact your U.S. representative, you can show them how many people in your congressional district have signed. That count gives neighbors a way to speak together and ask their representative to fund visa processing and press the State Department to explain delays.",
          )}
        </p>
        <p>
          <Link to="/coverage">{t("Signature map")}</Link>
        </p>
        <h2>{t("What the wait means for a family")}</h2>
        <p>
          {t(
            "A parent can count the months on a visa application. Their child remembers which birthdays they missed. Applicants, relatives, and supporters can tell their own stories here so the public and members of Congress can hear what those months meant to them.",
          )}
        </p>
        <p>
          <Link to="/stories">{t("Our stories")}</Link>
        </p>
        <h2>{t("How long each step takes")}</h2>
        <p>
          {t(
            "Public wait-time reports cover only parts of the visa process. Applicants and sponsors can fill in the gaps by sharing dates from their own cases. Together, those timelines show how long people waited between filing, an interview, and a decision, and where others are still waiting.",
          )}
        </p>
        <p>
          <Link to="/visa-data">{t("Visa timelines")}</Link>
        </p>
        <h2>{t("Who can take part")}</h2>
        <p>
          {t(
            "Anyone, anywhere in the world, can support this effort. You can sign the petition if you are 18 or older, whether or not you have a visa case. Signatures from U.S. citizens who vote are especially important because they show representatives that their own voters want Congress to act.",
          )}
        </p>
        <p>
          <Link to="/account">{t("Sign the petition")}</Link>
        </p>
        <h2 id="maintainer">{t("Project maintainer")}</h2>
        <p>
          {t(
            "Ethan Kallett maintains Reunite Now. He is a U.S. citizen who has been personally affected by visa delays.",
          )}
        </p>
        <p>
          <External href="https://github.com/ethanrimes">
            {t("GitHub profile for {handle}", { handle: "@ethanrimes" })}
          </External>
        </p>
        <h2>{t("Where signatures go")}</h2>
        <p>
          {t(
            "Signatures demonstrate public support and geographic reach on this website. They are not automatically filed with Congress, a court, or the State Department. Any future petition delivery will be described publicly before it happens.",
          )}
        </p>
      </div>
    </div>
  );
}
