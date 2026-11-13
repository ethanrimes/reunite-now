import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  filterSignatures,
  usMapBounds,
  usInsets,
  usMapProjector,
} from "../shared/coverage";
import { isPreviewPath } from "../client/src/preview";
import type { PublicProfile } from "../shared/schema";

test("signature filters intersect all dimensions and retain unspecified parties", () => {
  const profiles = [
    {
      id: "a",
      legalStatus: "US citizen",
      personallyInvolved: true,
      politicalAffiliation: "Democratic",
    },
    {
      id: "b",
      legalStatus: "Permanent resident",
      personallyInvolved: true,
      politicalAffiliation: "Democratic",
    },
    {
      id: "c",
      legalStatus: "US citizen",
      personallyInvolved: false,
      politicalAffiliation: "",
    },
    {
      id: "d",
      legalStatus: "US citizen",
      personallyInvolved: true,
      politicalAffiliation: "Republican",
    },
  ] as PublicProfile[];
  const filters = {
    statuses: ["US citizen"],
    involvement: ["Yes"],
    parties: ["Democratic"],
  };
  assert.deepEqual(
    filterSignatures(profiles, filters).map((p) => p.id),
    ["a"],
  );
  assert.deepEqual(
    filterSignatures(profiles, {
      ...filters,
      involvement: ["No"],
      parties: [""],
    }).map((p) => p.id),
    ["c"],
  );
  assert.equal(
    filterSignatures(profiles, { ...filters, parties: [] }).length,
    0,
  );
  assert.equal(profiles.length, 4);
});
test("US inset layout keeps every state and district inside its box without changing source data", () => {
  const states = JSON.parse(
    readFileSync("public/data/states.json", "utf8"),
  ) as GeoJSON.FeatureCollection;
  const districts = JSON.parse(
    readFileSync("public/data/districts.json", "utf8"),
  ) as GeoJSON.FeatureCollection;
  const project = usMapProjector(states);
  const source = JSON.stringify([states, districts]);
  function positions(g: GeoJSON.Geometry): number[][] {
    if (g.type === "GeometryCollection") return g.geometries.flatMap(positions);
    const walk = (c: any): number[][] =>
      typeof c[0] === "number" ? [c] : c.flatMap(walk);
    return walk(g.coordinates);
  }
  for (const feature of [...states.features, ...districts.features]) {
    const code = String(feature.properties!.GEOID).slice(0, 2);
    const inset = usInsets.find((i) => i.state === code);
    const [west, south, east, north] = inset?.box || [
      usMapBounds[0][1],
      usMapBounds[0][0],
      usMapBounds[1][1],
      usMapBounds[1][0],
    ];
    const transformed = positions(project(feature.geometry, code));
    assert.ok(transformed.length > 0);
    for (const [x, y] of transformed) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(
        x >= west && x <= east && y >= south && y <= north,
        `Region ${feature.properties!.GEOID} escaped its display bounds: ${x}, ${y}`,
      );
    }
  }
  assert.equal(JSON.stringify([states, districts]), source);
  const alaska: GeoJSON.LineString = {
    type: "LineString",
    coordinates: [
      [179, 52],
      [-179, 52],
    ],
  };
  const acrossDateline = positions(project(alaska, "02"));
  assert.ok(
    Math.abs(acrossDateline[0][0] - acrossDateline[1][0]) < 2,
    "Alaska stays connected across the dateline",
  );
  const pr = usInsets.find((i) => i.state === "72")!;
  assert.ok(
    pr.box[0] > 30 && pr.box[3] < 0,
    "Puerto Rico occupies a southeast inset",
  );
});
test("sample routes use a distinct prefix", () => {
  for (const path of ["/demo", "/demo/", "/demo/coverage", "/demo/account"])
    assert.equal(isPreviewPath(path), true);
  for (const path of ["/", "/coverage", "/democracy", "/demo-other"])
    assert.equal(isPreviewPath(path), false);
});
