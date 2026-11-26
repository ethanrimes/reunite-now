import type { PublicProfile } from "./schema";
import type { PlaceCount } from "./public-views";

export type SignatureGroup = PlaceCount & {
  status: string;
  connection: string;
  party: string;
};
export function signatureGroup(p: PublicProfile): SignatureGroup {
  return {
    country: p.country,
    state: p.state,
    district: p.district,
    status: p.legalStatus,
    connection: p.personallyInvolved ? "Yes" : "No",
    party: p.politicalAffiliation,
    count: 1,
  };
}
export function combineSignatureGroups(groups: SignatureGroup[]) {
  const combined = new Map<string, SignatureGroup>();
  for (const g of groups) {
    const key = JSON.stringify([
      g.country,
      g.state,
      g.district,
      g.status,
      g.connection,
      g.party,
    ]);
    const existing = combined.get(key);
    if (existing) existing.count += g.count;
    else combined.set(key, { ...g });
  }
  return [...combined.values()];
}
export function filterSignatures(
  profiles: PublicProfile[],
  filters: {
    statuses: string[];
    involvement: string[];
    parties: string[];
  },
) {
  return profiles.filter(
    (p) =>
      filters.statuses.includes(p.legalStatus) &&
      filters.involvement.includes(p.personallyInvolved ? "Yes" : "No") &&
      filters.parties.includes(p.politicalAffiliation),
  );
}
// Display coordinates only: source boundaries and region identifiers stay intact.
// The mainland is an equirectangular diagram; offshore regions fit dedicated insets.
export const usMapBounds = [
  [-2, -24],
  [28, 48],
] as const;
export const territoryMapBounds = [
  [-1, -1],
  [27, 55],
] as const;
export const stateInsets = [
  { state: "02", name: "Alaska", short: "AK", box: [-23, 12, -3, 27] },
  { state: "15", name: "Hawaii", short: "HI", box: [-23, -1, -3, 10] },
] as const;
export const territoryInsets = [
  { state: "60", name: "American Samoa", short: "AS", box: [0, 14, 17, 26] },
  { state: "66", name: "Guam", short: "GU", box: [18.5, 14, 35.5, 26] },
  {
    state: "69",
    name: "Northern Mariana Islands",
    short: "MP",
    box: [37, 14, 54, 26],
  },
  {
    state: "78",
    name: "US Virgin Islands",
    short: "VI",
    box: [28, 0, 45, 12],
  },
  { state: "72", name: "Puerto Rico", short: "PR", box: [9, 0, 26, 12] },
] as const;

const territoryCodes = new Set<string>(territoryInsets.map((i) => i.state));
export const isTerritory = (fips: string) => territoryCodes.has(fips);

// Spherical Albers equal-area, using Alaska's standard parallels and central meridian.
const radians = Math.PI / 180;
const n = (Math.sin(55 * radians) + Math.sin(65 * radians)) / 2;
const c = Math.cos(55 * radians) ** 2 + 2 * n * Math.sin(55 * radians);
function alaskaAlbers(longitude: number, latitude: number) {
  const delta = ((longitude + 154 + 540) % 360) - 180;
  const theta = n * delta * radians;
  const rho = Math.sqrt(c - 2 * n * Math.sin(latitude * radians)) / n;
  return [rho * Math.sin(theta), -rho * Math.cos(theta)];
}

function transformGeometry(
  geometry: GeoJSON.Geometry,
  transform: (position: GeoJSON.Position) => GeoJSON.Position,
): GeoJSON.Geometry {
  if (geometry.type === "GeometryCollection")
    return {
      ...geometry,
      geometries: geometry.geometries.map((g) =>
        transformGeometry(g, transform),
      ),
    };
  function coordinates(value: any): any {
    return typeof value[0] === "number"
      ? transform(value)
      : value.map(coordinates);
  }
  return {
    ...geometry,
    coordinates: coordinates(geometry.coordinates),
  } as GeoJSON.Geometry;
}

export function usMapProjector(states: GeoJSON.FeatureCollection) {
  const projections = new Map<
    string,
    (position: GeoJSON.Position) => GeoJSON.Position
  >();
  for (const inset of [...stateInsets, ...territoryInsets]) {
    const feature = states.features.find(
      (f) => String(f.properties?.GEOID) === inset.state,
    );
    if (!feature) throw new Error(`Missing state boundaries: ${inset.state}`);
    // Compress Hawaii's long remote-island chain so the populated islands stay readable.
    // Apply the same display transform to state and district boundaries, retaining every island.
    const displayPoint = (x: number, y: number) =>
      inset.state === "15"
        ? [
            x < -161 ? -161 + (x + 161) * 0.12 : x,
            y > 23 ? 23 + (y - 23) * 0.12 : y,
          ]
        : inset.state === "02"
          ? alaskaAlbers(x, y)
          : [x, y];
    let west = Infinity,
      east = -Infinity,
      south = Infinity,
      north = -Infinity;
    transformGeometry(feature.geometry, ([x, y]) => {
      [x, y] = displayPoint(x, y);
      west = Math.min(west, x);
      east = Math.max(east, x);
      south = Math.min(south, y);
      north = Math.max(north, y);
      return [x, y];
    });
    const [left, bottom, right, top] = inset.box;
    const scale = Math.min(
      (right - left - 1.6) / (east - west),
      (top - bottom - 3.2) / (north - south),
    );
    const centerX = (left + right) / 2,
      centerY = (bottom + top - 1.6) / 2;
    projections.set(inset.state, ([x, y, ...rest]) => {
      [x, y] = displayPoint(x, y);
      return [
        centerX + (x - (west + east) / 2) * scale,
        centerY + (y - (south + north) / 2) * scale,
        ...rest,
      ];
    });
  }
  return (geometry: GeoJSON.Geometry, state: string) =>
    transformGeometry(
      geometry,
      projections.get(state) ||
        (([x, y, ...rest]) => [(x + 125) * 0.78, y - 24, ...rest]),
    );
}
