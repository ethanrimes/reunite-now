import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { regionForIP } from "../server/storage/geolocation";

test("IPv4, IPv6, App Service ports and unknown IPs select the expected region", () => {
  for (const ip of [
    "194.109.6.66:42801",
    "[2001:888::1]:443",
    "::ffff:194.109.6.66",
  ])
    assert.equal(regionForIP(ip), "eu");
  for (const ip of [undefined, "", "8.8.8.8", "127.0.0.1", "::1", "unknown"])
    assert.equal(regionForIP(ip), "us");
});

test("two regional databases preserve sessions, visibility, private records and interrupted moves", async (t) => {
  const base = "http://127.0.0.1:3329";
  const pools = Object.fromEntries(
    ["eu", "us"].map((region) => {
      const connectionString =
        process.env["DATABASE_URL_" + region.toUpperCase()]!;
      const url = new URL(connectionString);
      assert.equal(url.hostname, "127.0.0.1");
      assert.equal(url.pathname, "/petition_" + region);
      return [region, new Pool({ connectionString })];
    }),
  );
  t.after(async () => {
    await Promise.all(Object.values(pools).map((p) => p.end()));
  });
  async function request(
    path: string,
    method = "GET",
    body?: any,
    cookie = "",
    ip = "8.8.8.8",
  ) {
    return fetch(base + "/api/" + path, {
      method,
      headers: {
        origin: "http://127.0.0.1:5173",
        "content-type": "application/json",
        "client-ip": ip,
        "cf-ipcountry": "DE",
        cookie,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  const email = (prefix: string) => prefix + randomUUID() + "@example.test";
  async function signIn(
    address: string,
    ip: string,
    method: "link" | "code" = "link",
  ) {
    const link = await (
      await request("auth/email", "POST", { email: address }, "", ip)
    ).json();
    const token = new URLSearchParams(new URL(link.devLink).hash.slice(1)).get(
      "token",
    );
    const response = await request(
      "auth/verify",
      "POST",
      method === "code" ? { code: link.devCode } : { token },
      "",
      ip,
    );
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie")!.split(";")[0];
  }
  const euEmail = email("eu"),
    usEmail = email("us");
  const eu = await signIn(euEmail, "194.109.6.66"),
    us = await signIn(usEmail, "8.8.8.8", "code");
  const me = async (cookie: string) =>
    (await (await request("me", "GET", undefined, cookie)).json()).user;
  const a = await me(eu),
    b = await me(us);
  assert.equal(a.storageRegion, "eu");
  assert.equal(b.storageRegion, "us");
  assert.equal((await me(await signIn(euEmail, "8.8.8.8", "code"))).id, a.id);
  const profile = {
    name: "Regional test",
    country: "Sweden",
    legalStatus: "Other",
    personallyInvolved: false,
    signed: true,
    publicConsent: true,
    listSignature: true,
    adultConsent: true,
    reminders: false,
    cases: [],
  };
  for (const cookie of [eu, us])
    assert.equal(
      (await request("me/profile", "PUT", profile, cookie)).status,
      200,
    );
  const story = {
    title: "Regional test story",
    body: "Our family has waited to hear more about a visa application for months.",
    impacts: [],
    support: "",
    photos: [],
    rightsConsent: true,
    publish: false,
  };
  assert.equal((await request("me/story", "PUT", story, eu)).status, 200);
  assert.equal(
    (await request("me/story", "PUT", { ...story, publish: true }, us)).status,
    200,
  );
  async function checkPublic() {
    const { places } = await (await request("stats/coverage")).json();
    assert.deepEqual(
      places.filter((p: any) => p.country === "Sweden"),
      [{ country: "Sweden", state: "", district: "", count: 2 }],
    );
    const { cards } = await (await request("story-cards")).json();
    assert.equal(cards.filter((s: any) => s.id === b.id).length, 1);
    assert.ok(!cards.some((s: any) => s.id === a.id));
    assert.equal((await request("story/" + a.id)).status, 404);
    assert.equal((await request("story/" + b.id)).status, 200);
  }
  await checkPublic();
  await pools.eu.query(
    "INSERT INTO reminder_deliveries(user_id,period,status) VALUES($1,'2026-01','sent')",
    [a.id],
  );
  await pools.eu.query(
    "INSERT INTO reminder_recipient_deliveries(user_id,period,recipient_key,status) VALUES($1,'2026-01','test','sent')",
    [a.id],
  );
  const held = (
    await (await request("auth/email", "POST", { email: euEmail })).json()
  ).devLink;
  const move = (dest: string) =>
    request("me/region", "PUT", { region: dest }, eu);
  assert.equal(
    (await request("me/region", "PUT", { region: "us" })).status,
    401,
  );
  const results = await Promise.all([move("us"), move("us")]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal((await me(eu)).storageRegion, "us");
  for (const [table, key, value] of [
    ["users", "id", a.id],
    ["profiles", "user_id", a.id],
    ["stories", "user_id", a.id],
    ["sessions", "user_id", a.id],
    ["login_tokens", "email", euEmail],
    ["reminder_deliveries", "user_id", a.id],
    ["reminder_recipient_deliveries", "user_id", a.id],
  ]) {
    assert.equal(
      (await pools.eu.query(`SELECT 1 FROM ${table} WHERE ${key}=$1`, [value]))
        .rowCount,
      0,
    );
    assert.ok(
      (await pools.us.query(`SELECT 1 FROM ${table} WHERE ${key}=$1`, [value]))
        .rowCount,
    );
  }
  assert.equal(
    (
      await request("auth/verify", "POST", {
        token: new URLSearchParams(new URL(held).hash.slice(1)).get("token"),
      })
    ).status,
    200,
  );
  await checkPublic();
  // A request already waiting on the routing lock must see a transfer
  // journal entry committed by the lock holder, even in a batched SQL message.
  const writer = await pools.eu.connect();
  let reader: ReturnType<typeof checkPublic> | undefined;
  try {
    await writer.query("BEGIN");
    await writer.query("SELECT pg_advisory_xact_lock(721590112)");
    reader = checkPublic();
    void reader.catch(() => {});
    for (let i = 0; ; i++) {
      const { rows } = await writer.query(
        "SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=721590112 AND NOT granted",
      );
      if (rows.length) break;
      assert.ok(i < 200, "public request never reached the routing lock");
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    await writer.query("INSERT INTO account_moves VALUES($1,'eu')", [a.id]);
    await writer.query("INSERT INTO users(id,email) VALUES($1,$2)", [
      a.id,
      euEmail,
    ]);
    await writer.query("COMMIT");
  } finally {
    await writer.query("ROLLBACK");
    writer.release();
  }
  await reader;
  assert.equal((await me(eu)).storageRegion, "eu");
  assert.equal(
    (
      await pools.eu.query("SELECT 1 FROM account_moves WHERE user_id=$1", [
        a.id,
      ])
    ).rowCount,
    0,
  );
  assert.equal(
    (await pools.us.query("SELECT 1 FROM users WHERE id=$1", [a.id])).rowCount,
    0,
  );
  const exported = await (
    await request("me/export", "GET", undefined, eu)
  ).json();
  assert.equal(exported.story.body, story.body);
  const other = await (
    await request("me/export?userId=" + a.id, "GET", undefined, us)
  ).json();
  assert.equal(other.email, usEmail);
  assert.equal(other.story.publish, true);
  assert.equal(JSON.stringify(other).includes(euEmail), false);
  assert.equal(exported.reminderDeliveries.length, 1);
  for (const cookie of [eu, us])
    assert.equal(
      (await request("me", "DELETE", { confirmation: "DELETE" }, cookie))
        .status,
      200,
    );
  assert.equal(await me(eu), null);
  for (const pool of Object.values(pools))
    assert.equal(
      (await pool.query("SELECT 1 FROM users WHERE id=ANY($1)", [[a.id, b.id]]))
        .rowCount,
      0,
    );
});
