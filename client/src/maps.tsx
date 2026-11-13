import { MemberVotes } from "./legislation";
import { t, number } from "./i18n";
import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import L from "leaflet";
import { useLanguage } from "./language";
import "leaflet/dist/leaflet.css";
import {
  Map as MapIcon,
  Table2,
  ArrowUpRight,
  Info,
  Users,
  Globe2,
  MapPin,
  Maximize2,
  LocateFixed,
} from "lucide-react";
import {
  filterSignatures,
  mapGeometry,
  pacificLongitude,
} from "../../shared/coverage";
import { Link } from "react-router-dom";
import { useData } from "./api";
import { PageIntro, Modal, External, Empty, date } from "./ui";
import {
  states,
  legalStatuses,
  visaCategories,
  type PublicProfile,
} from "../../shared/schema";
import {
  filterCases,
  summarize,
  metricLabels,
  type Metric,
} from "../../shared/metrics";
type Rep = {
  id: string;
  name: string;
  state: string;
  district: string | null;
  chamber: string;
  party: string;
  termStart: string;
  termEnd: string;
  seatSince: string;
  congressSince: string;
  url: string;
  phone: string;
  contact: string;
  source: string;
};
type Feature = GeoJSON.Feature<GeoJSON.Geometry, any>;
type Region = {
  key: string;
  name: string;
  count: number;
  median?: number | null;
  sample?: number;
  reps?: Rep[];
};
const palette = [
  "#f7f5ed",
  "#abc7df",
  "#739fc4",
  "#477fae",
  "#285c89",
  "#143b5e",
];
const geographicData = new Map<string, Promise<GeoJSON.FeatureCollection>>();
function geography(kind: string) {
  if (!geographicData.has(kind))
    geographicData.set(
      kind,
      fetch(`/data/${kind}.json`)
        .then((r) => {
          if (!r.ok) throw new Error("Map data could not be loaded.");
          return r.json();
        })
        .catch((error) => {
          geographicData.delete(kind);
          throw error;
        }),
    );
  return geographicData.get(kind)!;
}
function regionKey(f: Feature, kind: string) {
  return kind === "world"
    ? f.properties.ADMIN === "United States of America"
      ? "United States"
      : f.properties.ADMIN
    : String(f.properties.GEOID);
}
function regionName(f: Feature, kind: string) {
  if (kind === "world") return regionKey(f, kind);
  if (kind === "districts") {
    const id = String(f.properties.GEOID);
    return `${states.find((s) => s[0] === id.slice(0, 2))?.[1] || id.slice(0, 2)}-${id.slice(2)}`;
  }
  return f.properties.NAME;
}
function MapPanel({
  title,
  children,
  expandable = true,
}: {
  title: string;
  children: ReactNode;
  expandable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="map-heading">
        <span>{title}</span>
        {expandable && (
          <button className="text-button" onClick={() => setExpanded(true)}>
            <Maximize2 size={17} />
            {t("Expand map")}
          </button>
        )}
      </div>
      {expanded ? (
        <Modal title={title} fullscreen onClose={() => setExpanded(false)}>
          <div className="map-panel">{children}</div>
        </Modal>
      ) : (
        <div className="map-panel">{children}</div>
      )}
    </>
  );
}
function GeoMap({
  kind,
  regions,
  shade = "count",
  measure = "signatures",
  onSelect,
}: {
  kind: "states" | "districts" | "world";
  regions: Record<string, Region>;
  shade?: string;
  measure?: "signatures" | "applicants";
  onSelect: (r: Region) => void;
}) {
  const language = useLanguage();
  const root = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [compact, setCompact] = useState(false);
  const bounds: L.LatLngBoundsExpression =
    kind === "world"
      ? [
          [-56, -180],
          [80, 180],
        ]
      : [
          [-18, 140],
          [73, 300],
        ];
  const reset = () =>
    map.current?.fitBounds(bounds, { padding: [35, 35], animate: false });
  useEffect(() => {
    const m = L.map(root.current!, {
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 0.5,
      maxZoom: 10,
      zoomSnap: 0.25,
      attributionControl: true,
    });
    map.current = m;
    m.fitBounds(bounds, { padding: [35, 35] });
    m.attributionControl.addAttribution(
      '<a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth</a>',
    );
    if (kind !== "world")
      m.attributionControl.addAttribution(
        '<a href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html" target="_blank" rel="noreferrer">US Census · 119th Congress</a>',
      );
    const observer = new ResizeObserver(() => {
      m.invalidateSize();
      setCompact(root.current!.clientWidth < 600);
    });
    observer.observe(root.current!);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, [kind]);
  useEffect(() => {
    const control = L.control
      .zoom({ zoomInTitle: t("Zoom in"), zoomOutTitle: t("Zoom out") })
      .addTo(map.current!);
    return () => {
      control.remove();
    };
  }, [kind, language]);
  useEffect(() => {
    const m = map.current!;
    let canceled = false;
    const layers = L.layerGroup().addTo(m);
    setError("");
    setReady(false);
    Promise.all([geography("world"), geography(kind)])
      .then(([world, data]) => {
        if (canceled) return;
        // Self-hosted land polygons over a water-colored canvas; no external map tiles.
        for (const offset of kind === "world" ? [0] : [-360, 0, 360]) {
          L.geoJSON(
            {
              ...world,
              features: world.features.map((f) => ({
                ...f,
                geometry: mapGeometry(f.geometry, (lng) => lng + offset),
              })),
            } as GeoJSON.FeatureCollection,
            {
              interactive: false,
              style: {
                fillColor: "#f5f3e9",
                fillOpacity: 1,
                color: "#8da6a7",
                weight: 0.65,
              },
            },
          ).addTo(layers);
        }
        const value = (r: Region) => (shade === "median" ? r.median : r.count);
        const max = Math.max(
          1,
          ...Object.values(regions).map((r) => value(r) || 0),
        );
        const get = (f: Feature): Region =>
          regions[regionKey(f, kind)] || {
            key: regionKey(f, kind),
            name: regionName(f, kind),
            count: 0,
            median: null,
            sample: 0,
            reps: [],
          };
        const fill = (r: Region) =>
          value(r)
            ? palette[
                Math.min(5, Math.max(1, Math.ceil((value(r)! / max) * 5)))
              ]
            : palette[0];
        const tooltip = (r: Region) => {
          const tip = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = t(r.name);
          tip.append(title, document.createElement("br"));
          const count = document.createElement("span");
          count.textContent = `${number(r.count)} ${t(measure)}`;
          tip.append(count);
          if (measure === "applicants") {
            const med = document.createElement("span");
            med.textContent =
              r.median == null
                ? t("No dated cases for this metric")
                : t("{days} days median · n={sample}", {
                    days: number(Math.round(r.median)),
                    sample: number(r.sample || 0),
                  });
            tip.append(document.createElement("br"), med);
          }
          for (const member of r.reps || []) {
            const rep = document.createElement("span");
            rep.textContent = `${member.name} · ${t(member.party)}`;
            tip.append(document.createElement("br"), rep);
          }
          return tip;
        };
        const accessible = (path: L.Path, r: Region) =>
          path.on("add", () => {
            const el = path.getElement();
            if (!el) return;
            el.setAttribute("tabindex", "0");
            el.setAttribute("role", "button");
            el.setAttribute(
              "aria-label",
              `${t(r.name)}: ${number(r.count)} ${t(measure)}`,
            );
            el.addEventListener("keydown", (e) => {
              if (["Enter", " "].includes((e as KeyboardEvent).key)) {
                e.preventDefault();
                onSelect(r);
              }
            });
          });
        const features = data.features.map((f) => ({
          ...f,
          geometry:
            kind === "world"
              ? f.geometry
              : mapGeometry(f.geometry, pacificLongitude),
        }));
        const layer = L.geoJSON(
          { ...data, features } as GeoJSON.FeatureCollection,
          {
            style: (f) => ({
              color: "#536d7b",
              weight: kind === "districts" ? 0.65 : 1,
              fillColor: fill(get(f!)),
              fillOpacity: 1,
            }),
            onEachFeature: (f, l) => {
              const r = get(f);
              l.bindTooltip(tooltip(r), {
                sticky: true,
                className: "map-tooltip",
              });
              l.on({
                mouseover: () =>
                  (l as L.Path).setStyle({ weight: 2.5, color: "#8f2d22" }),
                mouseout: () => layer.resetStyle(l as L.Path),
                click: () => onSelect(r),
              });
              accessible(l as L.Path, r);
            },
          },
        ).addTo(layers);
        if (kind !== "world") {
          const places: [string, number, number, number, number][] = [
            ["02", 64, -153, 8, -6],
            ["15", 20.7, -157, 8, 0],
            ["60", -14.3, -170.7, 8, 0],
            ["66", 13.4, 144.8, 8, 16],
            ["69", 17, 145.6, 8, -18],
            ["72", 18.2, -66.4, -88, -18],
            ["78", 18.3, -64.8, -70, 16],
          ];
          for (const [fips, lat, lng, dx, dy] of places) {
            if (kind === "districts" && ["02", "15"].includes(fips)) continue;
            const key = kind === "states" ? fips : `${fips}98`;
            const r = regions[key];
            if (!r) continue;
            const label = document.createElement("span");
            label.textContent = `${compact ? states.find((s) => s[0] === fips)?.[1] || t(r.name) : t(r.name)} · ${number(r.count)}`;
            const marker = L.circleMarker([lat, pacificLongitude(lng)], {
              radius: 5,
              color: "#24485e",
              weight: 1.5,
              fillColor: fill(r),
              fillOpacity: 1,
            });
            marker.bindTooltip(label, {
              permanent: true,
              interactive: true,
              direction: "right",
              offset: [dx, dy],
              className: "territory-label",
            });
            marker.on("click", () => onSelect(r));
            marker.getTooltip()?.on("click", () => onSelect(r));
            accessible(marker, r);
            marker.addTo(layers);
          }
        }
        setReady(true);
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
      m.removeLayer(layers);
    };
  }, [kind, regions, shade, measure, onSelect, language, compact]);
  return (
    <div className="map-wrap">
      <div
        ref={root}
        className="geo-map"
        aria-label={
          measure === "applicants"
            ? t("Visa applicant country map")
            : t("Petition signature coverage map")
        }
        aria-busy={!ready && !error}
      />
      {!ready && !error && (
        <div className="map-loading" role="status">
          {t("Loading map…")}
        </div>
      )}
      {error && (
        <div className="map-error" role="alert">
          {t(error)}
        </div>
      )}
      <div className="map-help">{t("Drag to explore · Use + / − to zoom")}</div>
      <button
        className="map-reset"
        onClick={reset}
        aria-label={t("Show the full map")}
        title={t("Show the full map")}
      >
        <LocateFixed size={20} />
      </button>
      <div className="map-legend">
        <span>{shade === "median" ? t("No data") : "0"}</span>
        {palette.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
        <span>
          {shade === "median"
            ? t("Longer wait")
            : measure === "applicants"
              ? t("More applicants")
              : t("More signatures")}
        </span>
      </div>
    </div>
  );
}
function Multi({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <details className="multi-select" name="coverage-filters">
      <summary>
        {t(label)}
        <span>
          {value.length === options.length
            ? t("All")
            : t("{count} selected", { count: number(value.length) })}
          ⌄
        </span>
      </summary>
      <div className="multi-options">
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="checkbox"
              aria-label={t(o.label)}
              checked={value.includes(o.value)}
              onChange={() =>
                onChange(
                  value.includes(o.value)
                    ? value.filter((x) => x !== o.value)
                    : [...value, o.value],
                )
              }
            />
            {t(o.label)}
          </label>
        ))}
      </div>
    </details>
  );
}
export function Coverage() {
  const { profiles } = useData();
  const [kind, setKind] = useState<"states" | "districts" | "world">("states");
  const [status, setStatus] = useState<string[]>([...legalStatuses]);
  const [involved, setInvolved] = useState(["Yes", "No"]);
  const [representatives, setRepresentatives] = useState<Rep[]>([]);
  const [repDate, setRepDate] = useState("");
  const [districtKeys, setDistrictKeys] = useState<string[]>([]);
  const [repError, setRepError] = useState("");
  const [selected, setSelected] = useState<Region | null>(null);
  const [parties, setParties] = useState([
    "Democratic",
    "Republican",
    "Independent",
    "Other",
    "",
  ]);
  useEffect(() => {
    fetch("/data/districts.json")
      .then((r) => r.json())
      .then((d) =>
        setDistrictKeys(d.features.map((f: any) => String(f.properties.GEOID))),
      )
      .catch(() => setRepError("District list could not be loaded."));
    fetch("/data/representatives.json")
      .then((r) => r.json())
      .then((d) => {
        setRepresentatives(d.members);
        setRepDate(d.retrievedAt);
      })
      .catch(() =>
        setRepError("Representative information could not be loaded."),
      );
  }, []);
  const matching = filterSignatures(profiles, {
    statuses: status,
    involvement: involved,
    parties,
  });
  const filtered = matching.filter(
    (p) => kind === "world" || p.country === "United States",
  );
  useEffect(() => {
    setSelected(null);
  }, [kind, status, involved, parties]);
  const regions = useMemo(() => {
    const r: Record<string, Region> = {};
    if (kind === "world") {
      for (const p of filtered) {
        r[p.country] ||= { key: p.country, name: p.country, count: 0 };
        r[p.country].count++;
      }
      return r;
    }
    for (const s of states) {
      if (kind === "states")
        r[s[0]] = {
          key: s[0],
          name: s[2],
          count: 0,
          reps: representatives.filter(
            (p) => p.state === s[1] && p.chamber === "Senate",
          ),
        };
      else
        for (const key of districtKeys.filter((k) => k.startsWith(s[0]))) {
          r[key] = {
            key,
            name: `${s[1]}-${key.slice(2)}`,
            count: 0,
            reps: representatives.filter(
              (p) =>
                p.state === s[1] &&
                p.chamber === "House" &&
                p.district === key.slice(2),
            ),
          };
        }
    }
    for (const p of filtered) {
      const state = states.find((s) => s[1] === p.state);
      if (!state) continue;
      const key = kind === "states" ? state[0] : `${state[0]}${p.district}`;
      if (!r[key])
        r[key] = { key, name: `${state[1]}-${p.district}`, count: 0, reps: [] };
      r[key].count++;
    }
    return r;
  }, [
    profiles,
    kind,
    status.join(),
    involved.join(),
    parties.join(),
    representatives,
    districtKeys,
  ]);
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow={t("SIGNATURE COVERAGE")}
        title={
          <>
            {t("Where people")} {t("have signed.")}
          </>
        }
        text={t(
          "See where support comes from, across the United States and around the world. Select a US state or district to see its representatives and their parties.",
        )}
      />
      <div className="mini-stats">
        <div>
          <Users />
          <strong>{number(filtered.length)}</strong>
          <span>{t("signatures in this view")}</span>
        </div>
        <div>
          <MapPin />
          <strong>
            {number(
              new Set(
                filtered.map((p) => (kind === "world" ? p.country : p.state)),
              ).size,
            )}
          </strong>
          <span>
            {kind === "world"
              ? t("countries represented")
              : t("states & territories")}
          </span>
        </div>
        <div>
          <Globe2 />
          <strong>
            {number(
              matching.filter((p) => p.country !== "United States").length,
            )}
          </strong>
          <span>{t("supporters outside the US")}</span>
        </div>
      </div>
      <div className="coverage-scope segmented" aria-label={t("Map geography")}>
        <button
          aria-pressed={kind !== "world"}
          className={kind !== "world" ? "selected" : ""}
          onClick={() => setKind("states")}
        >
          {t("United States")}
        </button>
        <button
          aria-pressed={kind === "world"}
          className={kind === "world" ? "selected" : ""}
          onClick={() => setKind("world")}
        >
          {t("Worldwide signatures")}
        </button>
      </div>
      <MapPanel
        title={
          kind === "world"
            ? t("Signatures by country of residence")
            : t("US signatures · states, districts & territories")
        }
      >
        <div className="map-toolbar coverage-filters">
          {kind !== "world" && (
            <div className="segmented">
              <button
                aria-pressed={kind === "states"}
                className={kind === "states" ? "selected" : ""}
                onClick={() => setKind("states")}
              >
                {t("States")}
              </button>
              <button
                aria-pressed={kind === "districts"}
                className={kind === "districts" ? "selected" : ""}
                onClick={() => setKind("districts")}
              >
                {t("Congressional districts")}
              </button>
            </div>
          )}
          <Multi
            label={t("Citizenship / residency")}
            options={legalStatuses.map((value) => ({ value, label: value }))}
            value={status}
            onChange={setStatus}
          />
          <Multi
            label={t("Visa connection")}
            options={[
              { value: "Yes", label: "Applicant or supporting a case" },
              { value: "No", label: "No personal case connection" },
            ]}
            value={involved}
            onChange={setInvolved}
          />
          <Multi
            label={t("Political affiliation")}
            options={[
              "Democratic",
              "Republican",
              "Independent",
              "Other",
              "",
            ].map((value) => ({ value, label: value || "Not provided" }))}
            value={parties}
            onChange={setParties}
          />
        </div>
        {kind !== "world" && (
          <p className="map-click-hint">
            <Info size={17} />
            {t(
              "Click a state or congressional district to see your representatives, their relevant votes, and bill sponsorships.",
            )}
          </p>
        )}
        <GeoMap kind={kind} regions={regions} onSelect={setSelected} />
      </MapPanel>
      {repError && kind !== "world" && <p role="alert">{t(repError)}</p>}
      <div className="map-sources">
        <External
          href={
            kind === "world"
              ? "https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/"
              : "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/4"
          }
        >
          {kind === "world"
            ? t("Boundary source · Natural Earth")
            : t("Boundary source · US Census")}
        </External>
        <Link to="/sources">{t("All sources & credits")}</Link>
        <Link to="/visa-data?view=map">
          {t("Explore visa applicants worldwide")} <ArrowUpRight size={15} />
        </Link>
      </div>
      {selected && (
        <Modal
          title={
            kind === "world"
              ? t("SIGNATURE COVERAGE")
              : t("YOUR REPRESENTATION")
          }
          onClose={() => setSelected(null)}
        >
          <h2>{t(selected.name)}</h2>
          <p>
            {number(selected.count)}{" "}
            {selected.count === 1 ? t("signature") : t("signatures")}{" "}
            {t("with the selected filters")}
          </p>
          {kind === "world" ? (
            <p>
              {t(
                "Signatures are grouped by the signer’s country of residence.",
              )}
            </p>
          ) : selected.reps?.length ? (
            selected.reps.map((r) => (
              <article className="rep-card" key={r.id}>
                <div className="rep-initials">
                  {r.name
                    .split(" ")
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div>
                  <span className="eyebrow">
                    {t(r.chamber)} · {t(r.party)}
                  </span>
                  <h3>{r.name}</h3>
                  <p>
                    {t("Serving this")}{" "}
                    {r.chamber === "House"
                      ? t("state/district seat")
                      : t("state in the Senate")}{" "}
                    {t("since ")}
                    {date(r.seatSince)}
                    <br />
                    {t("Current term began ")}
                    {date(r.termStart)}
                  </p>
                  <External href={r.url}>
                    {t("Official office & contact")}
                  </External>
                  {r.phone && <p>{r.phone}</p>}
                  <MemberVotes memberId={r.id} />
                  <External href={r.source}>
                    {t("Congressional biography")}
                  </External>
                </div>
              </article>
            ))
          ) : (
            <Empty title={t("No representative record in this view")}>
              {t(
                "Some divisions are unassigned or do not have senators. Use the official House or Senate directories to verify representation.",
              )}
            </Empty>
          )}
          {kind !== "world" && (
            <>
              <p className="method-note">
                {t("Member data retrieved ")}
                {repDate ? date(repDate) : "—"}
                {t(
                  " from the Congress Legislators dataset. Seat tenure is the earliest recorded term for this state and district number; district boundaries can change. New election winners do not take office until their term begins.",
                )}
              </p>
              <External href="https://github.com/unitedstates/congress-legislators">
                {t("Member data source")}
              </External>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
export function VisaData() {
  const { profiles } = useData();
  const [view, setView] = useState(
    new URLSearchParams(window.location.search).get("view") === "map"
      ? "map"
      : "table",
  );
  const [post, setPost] = useState("");
  const [days, setDays] = useState("90");
  const [status, setStatus] = useState("active");
  const [category, setCategory] = useState("");
  const [shade, setShade] = useState("count");
  const [metric, setMetric] = useState<Metric>("sinceFiling");
  const [selected, setSelected] = useState<Region | null>(null);
  const [postSearch, setPostSearch] = useState("");
  const posts = [
    ...new Set(profiles.flatMap((p) => p.cases.map((c) => c.post))),
  ].sort();
  const metrics: Metric[] =
    status === "active"
      ? ["sinceFiling", "sinceNvc"]
      : ["total", "filingInterview", "nvcInterview", "nvcClosure"];
  const cases = filterCases(profiles, {
    post,
    days: Number(days),
    status,
    category,
  });
  const regions = useMemo(() => {
    const r: Record<string, Region> = {};
    for (const country of new Set(
      cases.map((c) => c.nationality).filter((n): n is string => !!n),
    )) {
      const s = summarize(
        cases.filter((c) => c.nationality === country),
        metric,
      );
      r[country] = { key: country, name: country, ...s };
    }
    return r;
  }, [profiles, post, days, status, category, metric]);
  const allSummary = summarize(cases, metric);
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow={t("COMMUNITY VISA DATA")}
        title={
          <>
            {t("Visa processing")} {t("in our community.")}
          </>
        }
        text={t(
          "Compare self-reported timelines by visa category and consular post. These are community reports, not State Department estimates.",
        )}
      />
      <div className="toolbar">
        <div className="segmented">
          <button
            className={view === "table" ? "selected" : ""}
            onClick={() => setView("table")}
          >
            <Table2 size={16} />
            {t("Table view")}
          </button>
          <button
            className={view === "map" ? "selected" : ""}
            onClick={() => setView("map")}
          >
            <MapIcon size={16} />
            {t("Map view")}
          </button>
        </div>
        <span className="small-copy">
          {t("Medians in calendar days · Missing dates excluded")}
        </span>
      </div>
      <div className="data-filters">
        <label className="field">
          <span>{t("Consular post")}</span>
          <input
            aria-label={t("Search consular posts")}
            type="search"
            placeholder={t("Search posts…")}
            value={postSearch}
            onChange={(e) => setPostSearch(e.target.value)}
          />
          <select
            aria-label={t("Select consular post")}
            value={post}
            onChange={(e) => setPost(e.target.value)}
          >
            <option value="">{t("All posts")}</option>
            {posts
              .filter(
                (p) =>
                  p.toLowerCase().includes(postSearch.toLowerCase()) ||
                  p === post,
              )
              .map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>{t("Last confirmed")}</span>
          <select value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="30">{t("Within 30 days")}</option>
            <option value="60">{t("Within 60 days")}</option>
            <option value="90">{t("Within 90 days")}</option>
            <option value="0">{t("Any time")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("Case status")}</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setMetric(e.target.value === "active" ? "sinceFiling" : "total");
            }}
          >
            <option value="active">{t("Active cases")}</option>
            <option value="closed">{t("Closed cases")}</option>
          </select>
        </label>
        <label className="field">
          <span>
            {t("Visa category ")}
            {view === "map" ? t("(required)") : ""}
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">
              {view === "map"
                ? t("Select a category")
                : t("All visa categories")}
            </option>
            {visaCategories.map((c) => (
              <option key={c} value={c}>
                {t(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="data-summary">
        <span>
          {t(
            status === "active"
              ? "{count} active cases in this view"
              : "{count} closed cases in this view",
            { count: number(cases.length) },
          )}
        </span>
        <span>
          <strong>
            {number(
              new Set(
                cases.map((c) => c.nationality).filter((n): n is string => !!n),
              ).size,
            )}
          </strong>
          {t(" confirmed nationalities")}
        </span>
        <span>
          <strong>{number(new Set(cases.map((c) => c.post)).size)}</strong>
          {t(" consular posts")}
        </span>
      </div>
      {view === "table" ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Visa category")}</th>
                <th>{t("Cases")}</th>
                {metrics.map((m) => (
                  <th key={m}>
                    {t(metricLabels[m])}
                    <small>{t("median days · sample size")}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visaCategories
                .filter(
                  (v) =>
                    (!category || v === category) &&
                    cases.some((c) => c.category === v),
                )
                .map((v) => {
                  const vc = cases.filter((c) => c.category === v);
                  return (
                    <tr key={v}>
                      <th>{v}</th>
                      <td>{number(vc.length)}</td>
                      {metrics.map((m) => {
                        const s = summarize(vc, m);
                        return (
                          <td key={m}>
                            {s.median === null
                              ? "—"
                              : number(Math.round(s.median))}
                            <small>
                              {t("n = ")}
                              {number(s.sample)}
                            </small>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              {!cases.length && (
                <tr>
                  <td colSpan={metrics.length + 2}>
                    <Empty title={t("No cases match these filters yet")}>
                      {t(
                        "As people add timelines, medians and sample sizes will appear here.",
                      )}{" "}
                      <Link to="/account">{t("Add your experience")}</Link>
                      {t(" or broaden the filters.")}
                    </Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <MapPanel
          title={`${t("Visa applicants worldwide")}${category ? ` · ${category}` : ""}`}
          expandable={!!category}
        >
          <div className="map-toolbar applicant-toolbar">
            <label className="inline-field">
              {t("Shade by")}
              <select value={shade} onChange={(e) => setShade(e.target.value)}>
                <option value="count">{t("Number of applicants")}</option>
                <option value="median">{t("Median wait")}</option>
              </select>
            </label>
            <label className="inline-field">
              {t("Metric")}
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as Metric)}
              >
                {metrics.map((m) => (
                  <option key={m} value={m}>
                    {t(metricLabels[m])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {category ? (
            <GeoMap
              kind="world"
              measure="applicants"
              regions={regions}
              shade={shade}
              onSelect={setSelected}
            />
          ) : (
            <Empty title={t("Choose a visa category to explore the map")}>
              {t(
                "Comparing like categories gives the numbers context. Use the visa category filter above.",
              )}
            </Empty>
          )}
        </MapPanel>
      )}
      <div className="map-sources">
        <External href="https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/">
          {t("Boundary source · Natural Earth")}
        </External>
        <Link to="/sources">{t("All sources & credits")}</Link>
      </div>
      <details className="methodology">
        <summary>
          <Info size={17} />
          {t(" How to read these numbers")}
        </summary>
        <p>
          {t(
            "The map groups cases by confirmed applicant nationality. Older entries without a confirmed nationality remain in the table but are excluded from the map. The post filter selects the processing embassy or consulate. Medians describe reported durations, not predictions; each metric shows its own sample size.",
          )}
        </p>
        <p>
          {t(
            "Active cases have no current final decision. Administrative processing, §221(g), and policy-related refusals stay active. Approved, issued, finally refused, and withdrawn cases are closed, unless reopened. Filing to final decision uses the first closing event after the most recent reopening. First-interview metrics exclude future appointments.",
          )}
        </p>
        <p>
          {t(
            "“Last confirmed” records when the account holder reviewed the timelines, including a confirmation that nothing has changed. It does not imply independent verification. Small samples and self-selection can distort comparisons.",
          )}
        </p>
      </details>
      {selected && (
        <Modal title={t("APPLICANT COUNTRY")} onClose={() => setSelected(null)}>
          <h2>{t(selected.name)}</h2>
          <p>
            {category} · {t(status)}
            {t(" cases · ")}
            {post || t("All posts")}
          </p>
          <div className="country-metrics">
            <strong>{number(selected.count)}</strong>
            <span>{t("reported applicants")}</span>
            <strong>
              {selected.median == null
                ? "—"
                : t("{days} days", {
                    days: number(Math.round(selected.median)),
                  })}
            </strong>
            <span>
              {t(metricLabels[metric])}
              {t(" · n=")}
              {number(selected.sample || 0)}
            </span>
          </div>
          <p className="method-note">
            {t(
              "These are self-reported community timelines, not government processing estimates.",
            )}
          </p>
        </Modal>
      )}
    </div>
  );
}
