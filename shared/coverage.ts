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
// Pacific-centered US view keeps Alaska's antimeridian polygons and all territories together.
export function pacificLongitude(lng: number) {
  return lng < 0 ? lng + 360 : lng;
}
export function mapGeometry(
  geometry: GeoJSON.Geometry,
  longitude: (n: number) => number,
): GeoJSON.Geometry {
  if (geometry.type === "GeometryCollection")
    return {
      ...geometry,
      geometries: geometry.geometries.map((g) => mapGeometry(g, longitude)),
    };
  function coordinates(value: any): any {
    return typeof value[0] === "number"
      ? [longitude(value[0]), ...value.slice(1)]
      : value.map(coordinates);
  }
  return {
    ...geometry,
    coordinates: coordinates(geometry.coordinates),
  } as GeoJSON.Geometry;
}
