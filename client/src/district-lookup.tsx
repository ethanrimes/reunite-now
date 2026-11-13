import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api, useData } from "./api";
import { t } from "./i18n";
import { Notice } from "./ui";
type Suggestion = { label: string; lat: number; lon: number };
type Match = Suggestion & { state: string; district: string };
function AddressMap({
  match,
  overlay,
  enabled,
}: {
  match: Match;
  overlay: boolean;
  enabled: boolean;
}) {
  const node = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.GeoJSON | null>(null);
  const [attribution, setAttribution] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!node.current) return;
    let alive = true;
    const m = L.map(node.current, {
      maxZoom: 18,
      minZoom: 3,
      scrollWheelZoom: false,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
    }).setView([match.lat, match.lon], 15);
    map.current = m;
    const tiles = L.tileLayer("/api/maps/tiles/{z}/{x}/{y}", {
      maxZoom: 18,
      minZoom: 3,
      attribution: "© Microsoft Azure Maps",
    });
    // Obtain required attribution before rendering Azure tiles, and refresh as the view changes.
    const attribute = async () => {
      try {
        const b = m.getBounds();
        const r = await api("/maps/attribution", {
          method: "POST",
          body: JSON.stringify({
            zoom: m.getZoom(),
            bounds: [
              Math.max(-180, b.getWest()),
              Math.max(-90, b.getSouth()),
              Math.min(180, b.getEast()),
              Math.min(90, b.getNorth()),
            ],
          }),
        });
        if (alive) {
          setAttribution(r.text);
          if (!m.hasLayer(tiles)) tiles.addTo(m);
          setError("");
        }
      } catch {
        if (alive)
          setError(
            "Street map could not load. You can still confirm the Census district below.",
          );
      }
    };
    if (enabled) {
      void attribute();
      m.on("moveend", attribute);
      tiles.on("tileerror", () =>
        setError(
          "Street map could not load. You can still confirm the Census district below.",
        ),
      );
    }
    L.circleMarker([match.lat, match.lon], {
      radius: 9,
      color: "#fff",
      weight: 3,
      fillColor: "#c84d36",
      fillOpacity: 1,
    })
      .addTo(m)
      .bindTooltip(t("Selected address"));
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(node.current);
    return () => {
      alive = false;
      observer.disconnect();
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, [match.lat, match.lon, enabled]);
  useEffect(() => {
    let active = true;
    const m = map.current;
    if (!m) return;
    if (!overlay) {
      if (layer.current) m.removeLayer(layer.current);
      return;
    }
    fetch("/data/districts.json")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (!active) return;
        if (layer.current) m.removeLayer(layer.current);
        layer.current = L.geoJSON(data, {
          style: { color: "#274d70", weight: 2, fillOpacity: 0.08 },
          onEachFeature: (f, l) =>
            l.bindTooltip(
              String(f.properties?.NAME || f.properties?.GEOID || ""),
            ),
        }).addTo(m);
      })
      .catch(() => {
        if (active) setError("District boundaries could not load. Try again.");
      });
    return () => {
      active = false;
    };
  }, [overlay, match]);
  return (
    <div className="address-map-wrap">
      <div
        className="address-map"
        ref={node}
        role="region"
        aria-label={t("Selected address and congressional districts")}
      />
      <small className="map-credit">
        {attribution} ·{" "}
        <a
          href="https://www.microsoft.com/en-us/maps/product/terms"
          target="_blank"
          rel="noreferrer"
        >
          {t("Azure Maps")}
        </a>{" "}
        ·{" "}
        <a
          href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html"
          target="_blank"
          rel="noreferrer"
        >
          {t("US Census boundaries")}
        </a>
      </small>
      {error && <Notice>{t(error)}</Notice>}
    </div>
  );
}
export function DistrictLookup({
  onConfirm,
}: {
  onConfirm: (state: string, district: string) => void;
}) {
  const { config } = useData();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [suggestions, setSuggestions] = useState<Suggestion[]>([]),
    [active, setActive] = useState(-1),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [match, setMatch] = useState<Match | null>(null),
    [overlay, setOverlay] = useState(false),
    [confirmed, setConfirmed] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const version = ++generation.current;
    if (!open || query.trim().length < 4 || !config.maps || match) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      setMessage("");
      try {
        const r = await api("/maps/suggest", {
          method: "POST",
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });
        if (version === generation.current) {
          setSuggestions(r.results);
          setActive(-1);
          if (!r.results.length)
            setMessage(
              "No address suggestions. Try a complete address, then use Find district.",
            );
        }
      } catch (e) {
        if (!controller.signal.aborted && version === generation.current)
          setMessage((e as Error).message);
      } finally {
        if (version === generation.current) setBusy(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, config.maps, match]);
  async function select(s?: Suggestion) {
    const version = ++generation.current;
    setBusy(true);
    setSuggestions([]);
    setMessage("");
    try {
      const r = await api(s ? "/maps/district" : "/district-lookup", {
        method: "POST",
        body: JSON.stringify(
          s ? { lat: s.lat, lon: s.lon } : { address: query },
        ),
      });
      if (version === generation.current) {
        setMatch({ ...r, label: s?.label || query });
        setQuery(s?.label || query);
        setOverlay(false);
      }
    } catch (e) {
      if (version === generation.current) setMessage((e as Error).message);
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  function clear() {
    generation.current++;
    setQuery("");
    setSuggestions([]);
    setMatch(null);
    setMessage("");
    setBusy(false);
  }
  return (
    <details
      className="address-lookup"
      open={open}
      onToggle={(e) => {
        const isOpen = e.currentTarget.open;
        setOpen(isOpen);
        if (!isOpen) clear();
      }}
    >
      <summary>
        {t("Not sure of your district? Look it up by address.")}
      </summary>
      <p>
        {t(
          "Address suggestions and street maps use Azure Maps and its mapping providers. Census identifies the district. Reunite Now does not save the search address, coordinates, or results; only the state and district you confirm are saved.",
        )}
      </p>
      <div className="address-search">
        <div className="input-action">
          <input
            role="combobox"
            aria-label={t("Address for district lookup")}
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls="address-results"
            aria-activedescendant={
              active >= 0 ? `address-result-${active}` : undefined
            }
            autoComplete="off"
            value={query}
            placeholder={t("Full street address, city, state, ZIP")}
            onChange={(e) => {
              generation.current++;
              setQuery(e.target.value);
              setMatch(null);
              setActive(-1);
              setSuggestions([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, suggestions.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === "Escape") {
                setSuggestions([]);
                setActive(-1);
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (!busy && (active >= 0 || query.length >= 8))
                  void select(active >= 0 ? suggestions[active] : undefined);
              }
            }}
          />
          <button
            type="button"
            disabled={busy || query.trim().length < 8}
            onClick={() => void select()}
          >
            {busy ? t("Looking up…") : t("Find district")}
          </button>
        </div>
        {suggestions.length > 0 && (
          <ul id="address-results" role="listbox" className="address-results">
            {suggestions.map((s, i) => (
              <li
                key={`${s.lat}-${s.lon}-${i}`}
                id={`address-result-${i}`}
                role="option"
                aria-selected={active === i}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => void select(s)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div aria-live="polite">
        {message && <Notice>{t(message)}</Notice>}
        {confirmed && !query && <p className="small-copy">{confirmed}</p>}
      </div>
      {match && (
        <div className="district-result">
          <div className="row-between">
            <strong>
              {match.state}-{match.district} · {t("119th Congress")}
            </strong>
            <button
              type="button"
              className="button outline small"
              aria-pressed={overlay}
              onClick={() => setOverlay(!overlay)}
            >
              {overlay
                ? t("Hide district boundaries")
                : t("Show district boundaries")}
            </button>
          </div>
          <p>{match.label}</p>
          <AddressMap match={match} overlay={overlay} enabled={!!config.maps} />
          <p className="small-copy">
            {t(
              "Review the address and district before confirming. Boundaries are for the 119th Congress; future election maps may differ.",
            )}
          </p>
          <button
            className="button small"
            type="button"
            onClick={() => {
              onConfirm(match.state, match.district);
              setConfirmed(
                t(
                  "District selected: {district}. Search details have been cleared.",
                  { district: `${match.state}-${match.district}` },
                ),
              );
              clear();
            }}
          >
            {t("Use this district")}
          </button>
        </div>
      )}
    </details>
  );
}
