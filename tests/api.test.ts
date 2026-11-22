import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
// Integration tests target the local API; no real email is sent.
const base = process.env.TEST_API_URL || "http://127.0.0.1:3001",
  origin = "http://127.0.0.1:5173";
let cookie = "";
async function request(
  path: string,
  method = "GET",
  body?: any,
  withCookie = true,
  requestOrigin = origin,
) {
  return fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: requestOrigin,
      ...(withCookie && cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
test("email authentication, data privacy, ownership, update and deletion", async () => {
  const email = `integration-${Date.now()}@example.test`;
  let r = await request("/api/auth/email", "POST", { email });
  assert.equal(r.status, 200);
  const login = await r.json();
  assert.ok(login.devLink);
  const raw = new URLSearchParams(new URL(login.devLink).hash.slice(1)).get(
    "token",
  );
  r = await request("/api/auth/verify", "POST", { token: raw });
  assert.equal(r.status, 200);
  cookie = r.headers.get("set-cookie")!.split(";")[0];
  assert.ok(cookie.startsWith("rn_session="));
  assert.equal(
    (await request("/api/auth/verify", "POST", { token: raw })).status,
    400,
    "magic link is one use",
  );
  const profile = {
    name: "Integration test only",
    legalStatus: "US citizen",
    country: "United States",
    state: "VA",
    district: "10",
    politicalAffiliation: "",
    personallyInvolved: true,
    signed: true,
    publicConsent: true,
    adultConsent: true,
    reminders: false,
    reminderEmails: [
      " BACKUP@EXAMPLE.TEST ",
      "backup@example.test",
      "second@example.test",
    ],
    cases: [
      {
        id: "test-case",
        applicantName: "Test applicant",
        relationship: "Spouse / partner",
        country: "Colombia",
        nationality: "Colombia",
        role: "Petitioner",
        category: "K-1",
        post: "Bogotá",
        events: [
          { id: "filed", type: "Filed", date: "2026-01-01", note: "" },
          { id: "nvc", type: "At NVC", date: "2026-03-01", note: "" },
        ],
      },
    ],
  };
  for (const invalid of [
    { ...profile, cases: [] },
    { ...profile, personallyInvolved: false },
    {
      ...profile,
      cases: [{ ...profile.cases[0], role: "Applicant", relationship: "Self" }],
    },
    { ...profile, cases: [{ ...profile.cases[0], nationality: undefined }] },
  ])
    assert.equal(
      (await request("/api/me/profile", "PUT", invalid)).status,
      400,
    );
  for (const [route, method] of [
    ["/api/maps/suggest", "POST"],
    ["/api/maps/district", "POST"],
    ["/api/maps/tiles/3/1/1", "GET"],
    ["/api/maps/attribution", "POST"],
    ["/api/district-lookup", "POST"],
  ])
    assert.equal((await request(route, method)).status, 404);
  assert.equal(
    (await request("/api/me/profile", "PUT", profile, false)).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/me/profile",
        "PUT",
        profile,
        true,
        "https://evil.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/me/profile", "PUT", { ...profile, signed: false }))
      .status,
    400,
  );
  assert.equal(
    (await request("/api/me/profile", "PUT", { ...profile, district: "99" }))
      .status,
    400,
  );
  assert.equal((await request("/api/me/profile", "PUT", profile)).status, 200);
  assert.equal(
    (
      await request("/api/me/profile", "PUT", {
        ...profile,
        reminderEmails: ["invalid address"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/me/profile", "PUT", {
        ...profile,
        reminderEmails: Array.from(
          { length: 6 },
          (_, index) => `extra${index}@example.test`,
        ),
      })
    ).status,
    400,
  );
  const me = await (await request("/api/me")).json();
  assert.equal(me.user.email, email);
  assert.equal("city" in me.profile, false);
  assert.deepEqual(me.profile.reminderEmails, [
    "backup@example.test",
    "second@example.test",
  ]);
  assert.equal(me.profile.cases[0].events.length, 2);
  // A cached registration form may still submit the retired residence field.
  assert.equal(
    (
      await request("/api/me/profile", "PUT", {
        ...profile,
        city: "Legacy residence",
      })
    ).status,
    200,
  );
  assert.equal(
    "city" in (await (await request("/api/me/export")).json()).profile.data,
    false,
  );
  const beforeSettings = (await (await request("/api/me")).json()).profile;
  const settings = await request("/api/me/profile/settings", "PATCH", {
    reminders: true,
    reminderEmails: me.profile.reminderEmails,
    country: "Do not save this",
    cases: [],
  });
  assert.equal(settings.status, 200);
  const afterSettings = (await (await request("/api/me")).json()).profile;
  assert.equal(afterSettings.country, profile.country);
  assert.deepEqual(afterSettings.cases, beforeSettings.cases);
  assert.equal(afterSettings.updatedAt, beforeSettings.updatedAt);
  assert.equal(afterSettings.reminders, true);
  assert.equal("note" in afterSettings.cases[0].events[0], false);
  const pub = await (await request("/api/public")).json();
  const record = pub.profiles.find((p: any) => p.id === me.user.id);
  assert.equal(record.name, profile.name);
  assert.equal("city" in record, false);
  assert.equal("email" in record, false);
  assert.equal("reminders" in record, false);
  assert.equal("reminderEmails" in record, false);
  assert.equal(JSON.stringify(record).includes("backup@example.test"), false);
  const originalPhoto = await sharp({
    create: { width: 20, height: 10, channels: 3, background: "#aabbcc" },
  })
    .jpeg()
    .withExif({ IFD0: { Artist: "Private test metadata" } })
    .toBuffer();
  const story = {
    title: "Integration test story",
    body: "This is synthetic local test content. It is not a real applicant story and is deleted when the integration test completes.",
    impacts: ["Family separation"],
    support: "",
    photos: ["data:image/jpeg;base64," + originalPhoto.toString("base64")],
    publish: true,
    rightsConsent: true,
  };
  assert.equal((await request("/api/me/story", "PUT", story)).status, 200);
  const published = (await (await request("/api/stories")).json()).stories.find(
    (s: any) => s.id === me.user.id,
  );
  assert.equal(published.title, story.title);
  const photoBytes = Buffer.from(published.photos[0].split(",")[1], "base64");
  const photoInfo = await sharp(photoBytes).metadata();
  assert.equal(photoInfo.format, "webp");
  assert.equal(photoInfo.width, 20);
  assert.equal(photoInfo.exif, undefined);
  assert.equal("photosCleaned" in published, false);
  assert.equal(
    (
      await request("/api/me/story", "PUT", {
        ...story,
        photos: ["data:image/jpeg;base64,YmFk"],
      })
    ).status,
    400,
  );
  for (const key of ["summary", "caseId", "timeline"])
    assert.equal(key in published, false);
  assert.equal((await request("/api/me/confirm", "POST")).status, 200);
  const confirmed = await (await request("/api/me")).json();
  assert.ok(
    Date.parse(confirmed.profile.updatedAt) >= Date.parse(me.profile.updatedAt),
  );
  assert.deepEqual(
    confirmed.profile.cases[0].events,
    me.profile.cases[0].events,
  );
  const publicAffiliation = async () => {
    const { profiles } = await (await request("/api/public")).json();
    const row = profiles.find((item: { id: string }) => item.id === me.user.id);
    assert.equal("affiliationConsent" in row, false);
    return row.politicalAffiliation;
  };
  for (const [consent, expected] of [
    [undefined, ""],
    [true, "Other"],
    [false, ""],
  ] as const) {
    const change = await request("/api/me/profile/profile", "PATCH", {
      politicalAffiliation: "Other",
      affiliationConsent: consent,
    });
    assert.equal(change.status, 200);
    assert.equal(await publicAffiliation(), expected);
  }
  const exported = await (await request("/api/me/export")).json();
  assert.equal(exported.email, email);
  assert.equal("city" in exported.profile.data, false);
  assert.deepEqual(
    exported.profile.data.reminderEmails,
    me.profile.reminderEmails,
  );
  assert.equal(
    (
      await request("/api/me/profile", "PUT", {
        ...profile,
        reminderEmails: [],
      })
    ).status,
    200,
  );
  assert.deepEqual(
    (await (await request("/api/me")).json()).profile.reminderEmails,
    [],
  );
  assert.equal(exported.story.title, story.title);
  assert.equal(
    (await request("/api/me", "DELETE", { confirmation: "no" })).status,
    400,
  );
  assert.equal(
    (await request("/api/me", "DELETE", { confirmation: "DELETE" })).status,
    200,
  );
  assert.equal((await (await request("/api/me")).json()).user, null);
  assert.equal(
    (await (await request("/api/public")).json()).profiles.some(
      (p: any) => p.id === me.user.id,
    ),
    false,
  );
  assert.equal(
    (await (await request("/api/stories")).json()).stories.some(
      (p: any) => p.id === me.user.id,
    ),
    false,
  );
});

// HTML must revalidate so returning visitors receive current scripts and styles.
test("homepage and deep-link HTML revalidate after releases", async () => {
  for (const path of ["/", "/account"]) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-cache");
  }
});

test("sample API is isolated, read-only, and excludes private account fields", async () => {
  const r = await request("/api/demo");
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.sample, true);
  assert.equal(
    (await request("/demo/coverage")).headers.get("X-Robots-Tag"),
    "noindex, nofollow",
  );
  assert.equal(data.profiles.length, 840);
  assert.equal(data.stories.length, 8);
  for (const p of data.profiles) {
    assert.ok(p.id.startsWith("demo-"));
    assert.equal("email" in p, false);
    assert.equal("reminderEmails" in p, false);
    assert.equal("reminders" in p, false);
  }
  assert.equal((await request("/api/demo", "POST", {})).status, 404);
});
