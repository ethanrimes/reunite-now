import { writeFile, mkdir } from "node:fs/promises";
import { parse } from "yaml";
import { states } from "../shared/schema";
await mkdir("public/data", { recursive: true });
const now = new Date().toISOString();
async function get(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`Data source failed ${r.status}: ${url}`);
  return r;
}
async function geo(name: string, base: string) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    f: "geojson",
    maxAllowableOffset: "0.015",
    geometryPrecision: "4",
  });
  const j = await (await get(`${base}/query?${params}`)).json();
  if (!j.features?.length || j.exceededTransferLimit)
    throw new Error(`Incomplete ${name}`);
  if (name === "districts")
    j.features = j.features.filter((f: any) =>
      /^\d{4}$/.test(f.properties.GEOID),
    );
  await writeFile(`public/data/${name}.json`, JSON.stringify(j));
  console.log(name, j.features.length);
}
await geo(
  "states",
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0",
);
await geo(
  "districts",
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/4",
);
const worldUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const world = await (await get(worldUrl)).json();
await writeFile("public/data/world.json", JSON.stringify(world));
const countryNames = new Set<string>(
  world.features.map((f: any) =>
    f.properties.ADMIN === "United States of America"
      ? "United States"
      : f.properties.ADMIN,
  ),
);
[
  "Andorra",
  "Antigua and Barbuda",
  "Comoros",
  "Dominica",
  "Grenada",
  "Kiribati",
  "Liechtenstein",
  "Marshall Islands",
  "Micronesia",
  "Monaco",
  "Nauru",
  "Palau",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Tonga",
  "Tuvalu",
  "Vatican City",
  "Singapore",
  "Malta",
  "Bahrain",
  "Maldives",
  "Mauritius",
  "Seychelles",
  "Barbados",
  "Cabo Verde",
  "Hong Kong",
  "Taiwan",
  "Palestine",
  "Kosovo",
].forEach((x) => countryNames.add(x));
await writeFile(
  "shared/countries.json",
  JSON.stringify([...countryNames].sort()),
);
const legislatorsUrl =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml";
const legislators = parse(await (await get(legislatorsUrl)).text());
const today = now.slice(0, 10);
const reps = legislators.flatMap((l: any) => {
  const terms = l.terms.filter((t: any) => t.start <= today && t.end > today);
  const t = terms.at(-1);
  if (!t) return [];
  const same = l.terms.filter(
    (x: any) =>
      x.type === t.type &&
      x.state === t.state &&
      (t.type === "sen" || x.district === t.district),
  );
  return [
    {
      id: l.id.bioguide,
      name: l.name.official_full || `${l.name.first} ${l.name.last}`,
      state: t.state,
      district:
        t.type === "rep"
          ? ["DC", "PR", "GU", "VI", "AS", "MP"].includes(t.state)
            ? "98"
            : String(t.district).padStart(2, "0")
          : null,
      chamber: t.type === "rep" ? "House" : "Senate",
      party: t.party,
      termStart: t.start,
      termEnd: t.end,
      seatSince: same[0].start,
      congressSince: l.terms[0].start,
      url: t.url,
      phone: t.phone,
      contact: t.contact_form || t.url,
      source: `https://bioguide.congress.gov/search/bio/${l.id.bioguide}`,
    },
  ];
});
await writeFile(
  "public/data/representatives.json",
  JSON.stringify({
    retrievedAt: now,
    source: "https://github.com/unitedstates/congress-legislators",
    members: reps,
  }),
);
await writeFile(
  "public/data/sources.json",
  JSON.stringify(
    {
      retrievedAt: now,
      congress: 119,
      states:
        "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0",
      districts:
        "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/4",
      world: worldUrl,
      worldRetrievedAt: now,
      representatives: legislatorsUrl,
      note: "Boundaries represent the 119th Congress, not districts for the incoming 120th Congress. Natural Earth boundaries are for visualization, not a position on sovereignty.",
    },
    null,
    2,
  ),
);
console.log("Representative records", reps.length, "states", states.length);
