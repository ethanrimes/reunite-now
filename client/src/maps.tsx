import { t, number } from "./i18n";
import { useState, useEffect, useRef, useMemo } from "react";
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
} from "lucide-react";
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
  "#e5eaf2",
  "#c7d8fa",
  "#9dbbf4",
  "#6d96ed",
  "#4274df",
  "#2852b1",
];
function regionKey(f: Feature, kind: string) {
  if (kind === "world")
    return f.properties.ADMIN === "United States of America"
      ? "United States"
      : f.properties.ADMIN;
  return String(f.properties.GEOID);
}
function regionName(f: Feature, kind: string) {
  if (kind === "world") return regionKey(f, kind);
  if (kind === "districts") {
    const id = String(f.properties.GEOID);
    return `${states.find((s) => s[0] === id.slice(0, 2))?.[1] || id.slice(0, 2)}-${id.slice(2)}`;
  }
  return f.properties.NAME;
}
function GeoMap({
  kind,
  regions,
  shade = "count",
  onSelect,
}: {
  kind: "states" | "districts" | "world";
  regions: Record<string, Region>;
  shade?: string;
  onSelect?: (r: Region) => void;
}) {
  const language = useLanguage();
  const root = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!root.current) return;
    const m = L.map(root.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: kind === "world" ? 1 : 2,
      maxZoom: 10,
      attributionControl: true,
    });
    map.current = m;
    m.setView(kind === "world" ? [21, 0] : [38, -97], kind === "world" ? 2 : 4);
    m.attributionControl.addAttribution(
      kind === "world"
        ? "Natural Earth"
        : "U.S. Census Bureau · 119th Congress",
    );
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(root.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, [kind]);
  useEffect(() => {
    if (!map.current) return;
    const zoom = L.control
      .zoom({ zoomInTitle: t("Zoom in"), zoomOutTitle: t("Zoom out") })
      .addTo(map.current);
    return () => {
      zoom.remove();
    };
  }, [kind, language]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    let canceled = false,
      layer: L.GeoJSON;
    setError("");
    fetch(`/data/${kind}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("Map data could not be loaded.");
        return r.json();
      })
      .then((data) => {
        if (canceled) return;
        const max = Math.max(
          1,
          ...Object.values(regions).map((r) =>
            shade === "median" ? (r.median ?? 0) : r.count,
          ),
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
        layer = L.geoJSON(data, {
          style: (f) => {
            const r = get(f!);
            const value = shade === "median" ? r.median : r.count;
            return {
              color: "#ffffff",
              weight: kind === "districts" ? 0.65 : 1.1,
              fillColor: value
                ? palette[
                    Math.min(5, Math.max(1, Math.ceil((value / max) * 5)))
                  ]
                : palette[0],
              fillOpacity: 0.96,
            };
          },
          onEachFeature: (f, l) => {
            const r = get(f);
            const tip = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = t(r.name);
            tip.append(title, document.createElement("br"));
            const body = document.createElement("span");
            body.textContent = `${number(r.count)} ${t(kind === "world" ? "applicants" : "signatures")}`;
            tip.append(body);
            if (kind === "world") {
              tip.append(document.createElement("br"));
              const med = document.createElement("span");
              med.textContent =
                r.median == null
                  ? t("No dated cases for this metric")
                  : t("{days} days median · n={sample}", {
                      days: number(Math.round(r.median)),
                      sample: number(r.sample || 0),
                    });
              tip.append(med);
            } else if (r.reps?.length) {
              tip.append(document.createElement("br"));
              const rep = document.createElement("span");
              rep.textContent = r.reps.map((x) => x.name).join(" · ");
              tip.append(rep);
            }
            l.bindTooltip(tip, { sticky: true, className: "map-tooltip" });
            l.on({
              mouseover: () => {
                (l as L.Path).setStyle({
                  weight: 2,
                  color: "#254e97",
                  fillOpacity: 1,
                });
              },
              mouseout: () => layer.resetStyle(l as L.Path),
              click: () => onSelect?.(r),
            });
            l.on("add", () => {
              const el = (l as L.Path).getElement();
              if (el) {
                el.setAttribute("tabindex", "0");
                el.setAttribute("role", "button");
                el.setAttribute(
                  "aria-label",
                  `${t(r.name)}: ${number(r.count)} ${t(kind === "world" ? "applicants" : "signatures")}`,
                );
                el.addEventListener("keydown", (e) => {
                  if ((e as KeyboardEvent).key === "Enter") onSelect?.(r);
                });
              }
            });
          },
        }).addTo(m);
      })
      .catch((e) => setError(e.message));
    return () => {
      canceled = true;
      if (layer) m.removeLayer(layer);
    };
  }, [kind, regions, shade, onSelect, language]);
  return (
    <div className="map-wrap">
      <div
        ref={root}
        className="geo-map"
        aria-label={
          kind === "world"
            ? t("Visa applicant country map")
            : t("Petition signature coverage map")
        }
      />
      {error && <div className="map-error">{t(error)}</div>}
      <div className="map-help">{t("Drag to explore · Use + / − to zoom")}</div>
      <div className="map-legend">
        <span>{shade === "median" ? t("No data") : "0"}</span>
        {palette.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
        <span>
          {shade === "median"
            ? t("Longer wait")
            : kind === "world"
              ? t("More applicants")
              : t("More signatures")}
        </span>
      </div>
      <div className="map-location-buttons">
        {kind !== "world" && (
          <>
            <button onClick={() => map.current?.setView([38, -97], 4)}>
              {t("Contiguous US")}
            </button>
            <button onClick={() => map.current?.setView([64, -152], 4)}>
              {t("Alaska")}
            </button>
            <button onClick={() => map.current?.setView([20.7, -157], 6)}>
              {t("Hawaii")}
            </button>
            <button onClick={() => map.current?.setView([18.2, -66.4], 7)}>
              {t("Puerto Rico")}
            </button>
          </>
        )}
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
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <details className="multi-select">
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
          <label key={o}>
            <input
              type="checkbox"
              checked={value.includes(o)}
              onChange={() =>
                onChange(
                  value.includes(o)
                    ? value.filter((x) => x !== o)
                    : [...value, o],
                )
              }
            />
            {t(o)}
          </label>
        ))}
      </div>
    </details>
  );
}
export function Coverage() {
  const { profiles } = useData();
  const [kind, setKind] = useState<"states" | "districts">("states");
  const [status, setStatus] = useState<string[]>([...legalStatuses]);
  const [involved, setInvolved] = useState(["Yes", "No"]);
  const [representatives, setRepresentatives] = useState<Rep[]>([]);
  const [repDate, setRepDate] = useState("");
  const [districtKeys, setDistrictKeys] = useState<string[]>([]);
  const [repError, setRepError] = useState("");
  const [selected, setSelected] = useState<Region | null>(null);
  const [lookup, setLookup] = useState("");
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
  const filtered = profiles.filter(
    (p) =>
      p.country === "United States" &&
      status.includes(p.legalStatus) &&
      involved.includes(p.personallyInvolved ? "Yes" : "No"),
  );
  const regions = useMemo(() => {
    const r: Record<string, Region> = {};
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
    representatives,
    districtKeys,
  ]);
  const ranked = Object.values(regions).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow={t("SIGNATURE COVERAGE")}
        title={
          <>
            {t("Where people")}
            <br />
            <em>{t("have signed.")}</em>
          </>
        }
        text={t(
          "See petition signatures by state or congressional district, and look up the members of Congress who represent each area.",
        )}
      />
      <div className="mini-stats">
        <div>
          <Users />
          <strong>{filtered.length}</strong>
          <span>{t("signatures in this view")}</span>
        </div>
        <div>
          <MapPin />
          <strong>{new Set(filtered.map((p) => p.state)).size}</strong>
          <span>{t("states & territories")}</span>
        </div>
        <div>
          <Globe2 />
          <strong>
            {profiles.filter((p) => p.country !== "United States").length}
          </strong>
          <span>{t("supporters outside the US")}</span>
        </div>
      </div>
      <div className="map-panel">
        <div className="map-toolbar">
          <div className="segmented">
            <button
              className={kind === "states" ? "selected" : ""}
              onClick={() => setKind("states")}
            >
              {t("States")}
            </button>
            <button
              className={kind === "districts" ? "selected" : ""}
              onClick={() => setKind("districts")}
            >
              {t("Congressional districts")}
            </button>
          </div>
          <Multi
            label={t("Legal status")}
            options={[...legalStatuses]}
            value={status}
            onChange={setStatus}
          />
          <Multi
            label={t("Personally involved")}
            options={["Yes", "No"]}
            value={involved}
            onChange={setInvolved}
          />
        </div>
        <GeoMap kind={kind} regions={regions} onSelect={setSelected} />
      </div>
      <div className="below-map">
        <div>
          <h3>{t("Explore your representation")}</h3>
          <p>
            {t(
              "Hover for signatures and names. Click a state for senators or a district for its House representative.",
            )}
          </p>
          {repError && <p role="alert">{t(repError)}</p>}
          <label className="field">
            <span>{t("Find a state or district")}</span>
            <select
              value={lookup}
              onChange={(e) => {
                setLookup(e.target.value);
                if (regions[e.target.value])
                  setSelected(regions[e.target.value]);
              }}
            >
              <option value="">{t("Choose a division…")}</option>
              {ranked.map((r) => (
                <option key={r.key} value={r.key}>
                  {t(r.name)} · {r.count}
                  {t(" signatures")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="method-note">
          <strong>{t("About this data")}</strong>
          <p>
            {t(
              "Only submitted signatures appear. Geography and legal status are self-reported, not verified voter records. Map boundaries represent the 119th Congress. DC and territories have delegates or a resident commissioner; they do not have US senators.",
            )}
          </p>
          <External href="https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/4">
            {t("Boundary source · US Census")}
          </External>
        </div>
      </div>
      {selected && (
        <Modal
          title={t("YOUR REPRESENTATION")}
          onClose={() => setSelected(null)}
        >
          <h2>{t(selected.name)}</h2>
          <p>
            {selected.count}{" "}
            {selected.count === 1 ? t("signature") : t("signatures")}{" "}
            {t("with the selected filters")}
          </p>
          {selected.reps?.length ? (
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
                  <h4>{t("Tracked legislation")}</h4>
                  <p>{t("H.R. 10711 · Reducing Visa Delays Act")}</p>
                  <span className="tag">
                    {r.name.includes("Subramanyam")
                      ? t("Bill sponsor")
                      : t("No recorded floor vote")}
                  </span>
                  <p className="small-copy">
                    {t(
                      "The tracked record shows introduction and committee referral, not a floor vote. Sponsorship and voting are different actions. This is not a rating of this member’s position.",
                    )}
                  </p>
                  <External href="https://www.congress.gov/bill/119th-congress/house-bill/10711/all-actions">
                    {t("Official actions & votes")}
                  </External>
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
        </Modal>
      )}
    </div>
  );
}
export function VisaData() {
  const { profiles } = useData();
  const [view, setView] = useState("table");
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
    for (const country of new Set(cases.map((c) => c.country))) {
      const s = summarize(
        cases.filter((c) => c.country === country),
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
            {t("Visa processing")}
            <br />
            <em>{t("in our community.")}</em>
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
          <strong>{new Set(cases.map((c) => c.country)).size}</strong>
          {t(" applicant countries")}
        </span>
        <span>
          <strong>{new Set(cases.map((c) => c.post)).size}</strong>
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
                      <td>{vc.length}</td>
                      {metrics.map((m) => {
                        const s = summarize(vc, m);
                        return (
                          <td key={m}>
                            {s.median === null
                              ? "—"
                              : number(Math.round(s.median))}
                            <small>
                              {t("n = ")}
                              {s.sample}
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
        <div className="map-panel">
          <div className="map-toolbar">
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
        </div>
      )}
      <details className="methodology">
        <summary>
          <Info size={17} />
          {t(" How to read these numbers")}
        </summary>
        <p>
          {t(
            "Cases are grouped by applicant country in the map and visa category in the table. The post filter selects the processing embassy or consulate. A median is the middle reported duration, not a predicted wait. Sample sizes are shown separately for every metric because not everyone has all dates.",
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
            <strong>{selected.count}</strong>
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
              {selected.sample || 0}
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
