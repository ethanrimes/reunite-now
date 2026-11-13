import test from "node:test";
import assert from "node:assert/strict";
import {
  filterSignatures,
  mapGeometry,
  pacificLongitude,
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
test("Pacific view keeps dateline geometry connected without modifying source coordinates", () => {
  const shape: GeoJSON.Geometry = {
    type: "GeometryCollection",
    geometries: [
      {
        type: "Polygon",
        coordinates: [
          [
            [179, 52],
            [-179, 52],
            [-179, 53],
            [179, 52],
          ],
        ],
      },
    ],
  };
  const snapshot = JSON.stringify(shape);
  const shifted = mapGeometry(
    shape,
    pacificLongitude,
  ) as GeoJSON.GeometryCollection;
  const ring = (shifted.geometries[0] as GeoJSON.Polygon).coordinates[0];
  assert.deepEqual(
    ring.map((p) => p[0]),
    [179, 181, 181, 179],
  );
  assert.equal(JSON.stringify(shape), snapshot);
  assert.equal(pacificLongitude(-66), 294);
  assert.equal(pacificLongitude(145), 145);
});
test("sample routes use a distinct prefix", () => {
  for (const path of ["/demo", "/demo/", "/demo/coverage", "/demo/account"])
    assert.equal(isPreviewPath(path), true);
  for (const path of ["/", "/coverage", "/democracy", "/demo-other"])
    assert.equal(isPreviewPath(path), false);
});
