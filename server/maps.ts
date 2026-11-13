import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { DefaultAzureCredential } from "@azure/identity";
import { z } from "zod";
import { states } from "../shared/schema";
const credential = new DefaultAzureCredential();
export const mapsReady = () => !!process.env.AZURE_MAPS_CLIENT_ID;
async function atlas(route: string, params: Record<string, string>) {
  if (!mapsReady())
    throw Object.assign(
      new Error(
        "Address suggestions are unavailable. Enter a full address or select your district manually.",
      ),
      { status: 503 },
    );
  const token = await credential.getToken(
    "https://atlas.microsoft.com/.default",
  );
  const r = await fetch(
    `https://atlas.microsoft.com/${route}?${new URLSearchParams(params)}`,
    {
      headers: {
        Authorization: `Bearer ${token.token}`,
        "x-ms-client-id": process.env.AZURE_MAPS_CLIENT_ID!,
      },
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!r.ok)
    throw Object.assign(
      new Error(
        "The map service is temporarily unavailable. Please try again.",
      ),
      { status: 503 },
    );
  return r;
}
export const coordinates = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
});
export async function districtAt(lat: number, lon: number) {
  const p = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID,STATE,CD119,NAME",
    returnGeometry: "false",
    f: "json",
  });
  const r = await fetch(
    `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/4/query?${p}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!r.ok)
    throw Object.assign(
      new Error("Census lookup is unavailable. Select your district manually."),
      { status: 503 },
    );
  const geoid = String((await r.json()).features?.[0]?.attributes?.GEOID || "");
  const state = states.find((s) => s[0] === geoid.slice(0, 2))?.[1];
  if (!state || !/^\d{4}$/.test(geoid))
    throw Object.assign(
      new Error("District could not be determined. Select it manually."),
      { status: 404 },
    );
  return { state, district: geoid.slice(2), congress: 119, lat, lon };
}
export function mapsRouter(requireUser: RequestHandler) {
  const router = Router();
  router.use(requireUser);
  const searchLimit = rateLimit({
    windowMs: 60000,
    limit: 45,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  router.post("/suggest", searchLimit, async (req, res) => {
    const { query } = z
      .object({ query: z.string().trim().min(4).max(300) })
      .parse(req.body);
    const data = await (
      await atlas("search/fuzzy/json", {
        "api-version": "1.0",
        query,
        typeahead: "true",
        limit: "6",
        countrySet: "US",
        idxSet: "PAD,Addr",
        language: "en-US",
      })
    ).json();
    res.json({
      results: (data.results || [])
        .filter(
          (r: any) =>
            r.address?.freeformAddress &&
            Number.isFinite(r.position?.lat) &&
            Number.isFinite(r.position?.lon),
        )
        .map((r: any) => ({
          label: r.address.freeformAddress,
          lat: r.position.lat,
          lon: r.position.lon,
        })),
    });
  });
  router.post("/district", searchLimit, async (req, res) => {
    const { lat, lon } = coordinates.parse(req.body);
    res.json(await districtAt(lat, lon));
  });
  router.use(
    rateLimit({
      windowMs: 60000,
      limit: 500,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  router.get("/tiles/:z/:x/:y", async (req, res) => {
    const p = z
      .object({
        z: z.coerce.number().int().min(0).max(18),
        x: z.coerce.number().int().min(0),
        y: z.coerce.number().int().min(0),
      })
      .parse(req.params);
    if (p.x >= 2 ** p.z || p.y >= 2 ** p.z) return void res.sendStatus(400);
    const r = await atlas("map/tile", {
      "api-version": "2024-04-01",
      tilesetId: "microsoft.base.road",
      zoom: String(p.z),
      x: String(p.x),
      y: String(p.y),
      tileSize: "256",
      language: "en-US",
    });
    res
      .type("image/png")
      .set("Cache-Control", "private, max-age=86400")
      .send(Buffer.from(await r.arrayBuffer()));
  });
  router.post("/attribution", async (req, res) => {
    const p = z
      .object({
        zoom: z.number().int().min(0).max(18),
        bounds: z.tuple([
          z.number().min(-180).max(180),
          z.number().min(-90).max(90),
          z.number().min(-180).max(180),
          z.number().min(-90).max(90),
        ]),
      })
      .parse(req.body);
    const data = await (
      await atlas("map/attribution", {
        "api-version": "2024-04-01",
        tilesetId: "microsoft.base.road",
        zoom: String(p.zoom),
        bounds: p.bounds.join(","),
      })
    ).json();
    // Return text only. Do not inject upstream markup into our page.
    res.json({
      text: (data.copyrights || [])
        .join(" · ")
        .replace(/<[^>]*>/g, "")
        .replace(/&copy;/g, "©"),
    });
  });
  return router;
}
