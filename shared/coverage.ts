import type { PublicProfile } from "./schema";
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
  [-12, -24],
  [28, 48],
] as const;
export const usInsets = [
  { state: "02", name: "Alaska", short: "AK", box: [-23, 12, -3, 27] },
  { state: "15", name: "Hawaii", short: "HI", box: [-23, -1, -3, 10] },
  { state: "60", name: "American Samoa", short: "AS", box: [0, -11, 7, -2] },
  { state: "66", name: "Guam", short: "GU", box: [8, -11, 15, -2] },
  {
    state: "69",
    name: "Northern Mariana Islands",
    short: "MP",
    box: [16, -11, 23, -2],
  },
  {
    state: "78",
    name: "US Virgin Islands",
    short: "VI",
    box: [24, -11, 31, -2],
  },
  { state: "72", name: "Puerto Rico", short: "PR", box: [32, -11, 48, -2] },
] as const;

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
  for (const inset of usInsets) {
    const feature = states.features.find(
      (f) => String(f.properties?.GEOID) === inset.state,
    );
    if (!feature) throw new Error(`Missing state boundaries: ${inset.state}`);
    const unwrap = (x: number) => (inset.state === "02" && x > 0 ? x - 360 : x);
    // Compress Hawaii's long remote-island chain so the populated islands stay readable.
    // Apply the same display transform to state and district boundaries, retaining every island.
    const displayPoint = (x: number, y: number) =>
      inset.state === "15"
        ? [
            x < -161 ? -161 + (x + 161) * 0.12 : x,
            y > 23 ? 23 + (y - 23) * 0.12 : y,
          ]
        : [unwrap(x), y];
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
