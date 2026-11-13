import { t } from "./i18n";
import { PageIntro, External, date } from "./ui";
import { legislation } from "../../shared/legislation";
import postsDirectory from "../../shared/posts.json";
import { pauseSource } from "../../shared/visa-workflow";
import { policies } from "../../shared/policies";
import { policyEvents, reviewedAt } from "../../shared/campaign";
export const credits = [
  {
    title: "Maps and representation",
    links: [
      [
        "US Census Bureau · state and congressional district boundaries",
        "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/4",
      ],
      [
        "US Census Bureau · state boundaries",
        "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0",
      ],
      [
        "Natural Earth · 1:50m country data",
        "https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/",
      ],
      [
        "Natural Earth · country boundaries and public-domain license",
        "https://www.naturalearthdata.com/about/terms-of-use/",
      ],
      [
        "Congress Legislators · membership and terms",
        "https://github.com/unitedstates/congress-legislators",
      ],
      ["Biographical Directory of Congress", "https://bioguide.congress.gov/"],
      [
        "US Census Geocoder · address lookup",
        "https://geocoding.geo.census.gov/geocoder/",
      ],
    ],
  },
  {
    title: "Photography",
    id: "photography",
    links: [
      [
        "Landing-page family photograph · Unsplash",
        "https://images.unsplash.com/photo-1511895426328-dc8714191300",
      ],
      ["Unsplash license", "https://unsplash.com/license"],
    ],
  },
  {
    title: "Typography and software",
    links: [
      [
        "Instrument Sans · Google Fonts",
        "https://fonts.google.com/specimen/Instrument+Sans",
      ],
      [
        "Instrument Sans · SIL Open Font License",
        "/fonts/Instrument-Sans-LICENSE.txt",
      ],
      ["Lucide icons · ISC license", "https://lucide.dev/license"],
      [
        "Leaflet · BSD license",
        "https://github.com/Leaflet/Leaflet/blob/main/LICENSE",
      ],
      [
        "React · MIT license",
        "https://github.com/facebook/react/blob/main/LICENSE",
      ],
      [
        "Vite · MIT license",
        "https://github.com/vitejs/vite/blob/main/LICENSE",
      ],
    ],
  },
];
export function Sources() {
  const sources = new Map<string, string>([
    [postsDirectory.source, "Official post directory"],
    [pauseSource, "State Department update"],
    ["https://learn.microsoft.com/en-us/azure/azure-maps/", "Azure Maps"],
    [
      "https://privacy.microsoft.com/privacystatement",
      "Microsoft privacy statement",
    ],
    [
      "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html",
      "Immigrant visa process",
    ],
    [
      "https://travel.state.gov/content/travel/en/us-visas/immigrate/family-immigration/nonimmigrant-visa-for-a-fiance-k-1.html",
      "K-1 visa process",
    ],
    [
      "https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry/diversity-visa-if-you-are-selected.html",
      "Diversity visa process",
    ],
    [
      "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html",
      "Visitor visa process",
    ],
  ]);
  for (const vote of legislation.votes)
    sources.set(vote.url, `${vote.chamber} · ${vote.date} · ${vote.roll}`);
  for (const event of policyEvents)
    sources.set(event.source.url, event.source.label);
  for (const policy of policies)
    for (const source of policy.sources) sources.set(source.url, source.label);
  return (
    <div className="page-shell sources-page">
      <PageIntro
        eyebrow={t("Sources & credits")}
        title={t("Where the information comes from.")}
        text={t(
          "Policy summaries link to government notices, court documents and organizations working on the cases. Community timelines and stories come from participants.",
        )}
      />
      <section>
        <h2>{t("Policy and court records")}</h2>
        <p className="method-note">
          {t("Sources checked")} {date(reviewedAt)}
        </p>
        <ul>
          {[...sources].map(([url, label]) => (
            <li key={url}>
              <External href={url}>{t(label)}</External>
              <span>{new URL(url).hostname}</span>
            </li>
          ))}
        </ul>
      </section>
      {credits.map((group) => (
        <section key={group.title} id={group.id}>
          <h2>{t(group.title)}</h2>
          <ul>
            {group.links.map(([label, url]) => (
              <li key={url}>
                <External href={url}>{t(label)}</External>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="method-note">
        {t(
          "The photograph illustrates the campaign; it is not a submitted case story. Map boundaries do not imply a position on sovereignty. Sample records in the demo are fictional.",
        )}
      </p>
    </div>
  );
}
