import test from "node:test";
import assert from "node:assert/strict";
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
    city: "Test city",
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
        category: "K-1",
        post: "Bogotá",
        events: [
          { id: "filed", type: "Filed", date: "2026-01-01", note: "" },
          { id: "nvc", type: "At NVC", date: "2026-03-01", note: "" },
        ],
      },
    ],
  };
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
  assert.deepEqual(me.profile.reminderEmails, [
    "backup@example.test",
    "second@example.test",
  ]);
  assert.equal(me.profile.cases[0].events.length, 2);
  const pub = await (await request("/api/public")).json();
  const record = pub.profiles.find((p: any) => p.id === me.user.id);
  assert.equal(record.name, profile.name);
  assert.equal("email" in record, false);
  assert.equal("reminders" in record, false);
  assert.equal("reminderEmails" in record, false);
  assert.equal(JSON.stringify(record).includes("backup@example.test"), false);
  const story = {
    title: "Integration test story",
    summary: "This is synthetic test content used only for local verification.",
    body: "This is synthetic local test content. It is not a real applicant story and is deleted when the integration test completes.",
    impacts: ["Family separation"],
    support: "",
    caseId: "test-case",
    photos: [],
    publish: true,
    rightsConsent: true,
  };
  assert.equal((await request("/api/me/story", "PUT", story)).status, 200);
  assert.ok(
    (await (await request("/api/stories")).json()).stories.some(
      (s: any) => s.id === me.user.id,
    ),
  );
  assert.equal((await request("/api/me/confirm", "POST")).status, 200);
  const confirmed = await (await request("/api/me")).json();
  assert.ok(
    Date.parse(confirmed.profile.updatedAt) >= Date.parse(me.profile.updatedAt),
  );
  assert.deepEqual(
    confirmed.profile.cases[0].events,
    me.profile.cases[0].events,
  );
  const exported = await (await request("/api/me/export")).json();
  assert.equal(exported.email, email);
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
