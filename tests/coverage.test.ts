import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  filterSignatures,
  usMapBounds,
  stateInsets,
  territoryInsets,
  isTerritory,
  usMapProjector,
} from "../shared/coverage";
import {
  anonymousRowsOnPage,
  signatoryPage,
  signatoryPageSize,
} from "../shared/signatories";
import { isPreviewPath } from "../client/src/app/preview";
import {
  keyedSnapshotCache,
  snapshotCache,
} from "../client/src/app/snapshot-cache";
import type { PublicProfile } from "../shared/schema";

test("public snapshots share pending and successful reads, retry failures, and expire", async () => {
  let calls = 0;
  const source = snapshotCache(async () => {
    if (++calls === 1) throw Error("offline");
    return calls;
  });
  const failed = source.read();
  assert.equal(source.read(), failed);
  await assert.rejects(failed, /offline/);
  assert.equal(await source.read(), 2);
  assert.equal(await source.read(), 2);
  source.clear();
  assert.equal(await source.read(), 3);
  const expired = snapshotCache(async () => ++calls, 0);
  assert.equal(await expired.read(), 4);
  assert.equal(await expired.read(), 5);
});

test("keyed public snapshots reuse recently viewed data and drop stale versions", async () => {
  let calls = 0;
  const cache = keyedSnapshotCache<number>(2);
  const read = (key: string) => cache.read(key, async () => ++calls);
  const first = read("story:v1");
  assert.equal(read("story:v1"), first);
  assert.equal(await first, 1);
  assert.equal(await read("other-story"), 2);
  assert.equal(await read("story:v1"), 1);
  assert.equal(await read("story:v2"), 3);
  assert.equal(await read("other-story"), 4, "least recent entry is evicted");
  cache.clear();
  assert.equal(
    await read("story:v2"),
    5,
    "a successful write clears cached reads",
  );
});

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
    const inset = [...stateInsets, ...territoryInsets].find(
      (i) => i.state === code,
    );
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
  const [origin, east, north] = positions(
    project(
      {
        type: "LineString",
        coordinates: [
          [-154, 64],
          [-153, 64],
          [-154, 65],
        ],
      },
      "02",
    ),
  );
  const distance = (p: number[]) =>
    Math.hypot(p[0] - origin[0], p[1] - origin[1]);
  const ratio = distance(east) / distance(north);
  assert.ok(
    ratio > 0.41 && ratio < 0.47,
    "Alaska retains local proportions at 64°N",
  );
  assert.equal(
    states.features.filter((f) => !isTerritory(String(f.properties?.GEOID)))
      .length,
    51,
  );
  assert.deepEqual(territoryInsets.map((i) => i.short).sort(), [
    "AS",
    "GU",
    "MP",
    "PR",
    "VI",
  ]);
});
test("sample routes use a distinct prefix", () => {
  for (const path of ["/demo", "/demo/", "/demo/coverage", "/demo/account"])
    assert.equal(isPreviewPath(path), true);
  for (const path of ["/", "/coverage", "/democracy", "/demo-other"])
    assert.equal(isPreviewPath(path), false);
});

test("the public list keeps simultaneous signatures across a page boundary", () => {
  const rows = Array.from({ length: signatoryPageSize + 2 }, (_, i) => ({
    name: "Sample " + i,
    signedAt: "2026-01-02T00:00:00.000000Z",
  }));
  const older = { name: "Older", signedAt: "2026-01-01T00:00:00.000000Z" };
  const first = signatoryPage([older, ...rows]);
  assert.equal(first.signatories.length, rows.length);
  assert.equal(first.next, rows[0].signedAt);
  assert.deepEqual(signatoryPage([...rows, older], first.next!), {
    signatories: [older],
    next: null,
  });
});

test("anonymous rows fill the last named page and include each remaining signature", () => {
  const four = Array.from({ length: 4 }, () => ({
    name: "Test",
    signedAt: "2026-01-01T00:00:00.000000Z",
  }));
  const roster = { ...signatoryPage(four), total: 29, anonymousCount: 25 };
  assert.deepEqual(anonymousRowsOnPage(roster, 0), {
    count: 25,
    hasMore: false,
  });
  const larger = { ...roster, total: 110, anonymousCount: 106 };
  assert.deepEqual(
    [0, 1, 2].map((page) => anonymousRowsOnPage(larger, page)),
    [
      { count: 46, hasMore: true },
      { count: 50, hasMore: true },
      { count: 10, hasMore: false },
    ],
  );
  assert.equal(
    anonymousRowsOnPage({ ...larger, next: four[0].signedAt }, 0).count,
    0,
  );
  assert.equal(
    anonymousRowsOnPage({ ...roster, signatories: [], total: 25 }, 0).count,
    25,
  );
});
