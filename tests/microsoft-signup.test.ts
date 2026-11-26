import test from "node:test";
import assert from "node:assert/strict";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

test("Microsoft signs up and restores a profile by subject without mailbox verification", async (t) => {
  assert.ok(
    !process.env.DATABASE_URL &&
      !process.env.DATABASE_URL_EU &&
      !process.env.DATABASE_URL_US,
    "Microsoft signup tests require an isolated in-memory database",
  );
  process.env.TEST_DB = "1";
  process.env.PORT = "0";
  process.env.MICROSOFT_CLIENT_ID = "profile-test-client";
  process.env.MICROSOFT_CLIENT_SECRET = "profile-test-secret";
  const { server } = await import("../server/index");
  const { db, closeDb } = await import("../server/storage/db");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDb();
  });
  if (!server.listening)
    await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = "http://127.0.0.1:" + address.port;
  const http = globalThis.fetch;
  const key = await generateKeyPair("RS256");
  const issuer =
    "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0";
  const collision = "existing@example.test";
  await db.query("INSERT INTO users(id,email) VALUES($1,$2)", [
    "existing-user",
    collision,
  ]);
  let nonce: string, subject: string, email: string | undefined;
  t.mock.method(globalThis, "fetch", async (url: URL | string) => {
    if (String(url).endsWith("/keys"))
      return Response.json({
        keys: [
          {
            ...(await exportJWK(key.publicKey)),
            kid: "profile-test-key",
            alg: "RS256",
          },
        ],
      });
    assert.equal(
      String(url),
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    );
    const id_token = await new SignJWT({ nonce, email })
      .setProtectedHeader({ alg: "RS256", kid: "profile-test-key" })
      .setIssuer(issuer)
      .setAudience("profile-test-client")
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key.privateKey);
    return Response.json({ id_token });
  });
  async function signIn(sub: string, claim?: string) {
    const start = await http(base + "/api/auth/microsoft", {
      redirect: "manual",
    });
    const params = new URL(start.headers.get("location")!).searchParams;
    assert.equal(params.get("scope"), "openid email");
    nonce = params.get("nonce")!;
    subject = sub;
    email = claim;
    const callback = await http(
      base +
        "/api/auth/microsoft/callback?code=test&state=" +
        params.get("state"),
      {
        redirect: "manual",
        headers: { Cookie: start.headers.getSetCookie()[0].split(";")[0] },
      },
    );
    assert.equal(callback.headers.get("location"), "/account");
    const cookie = callback.headers
      .getSetCookie()
      .find((c) => c.startsWith("rn_session="));
    assert.ok(cookie);
    const profile = await http(base + "/api/me", {
      headers: { Cookie: cookie.split(";")[0] },
    });
    const me = await profile.json();
    assert.ok(me.user.id);
    assert.equal(me.user.email, null);
    return me.user;
  }
  const first = await signIn("first-subject", collision);
  assert.notEqual(first.id, "existing-user");
  assert.equal(first.microsoftEmail, collision);
  assert.deepEqual(await signIn("first-subject"), first);
  const updated = await signIn("first-subject", "new@example.test");
  assert.equal(updated.id, first.id);
  assert.equal(updated.microsoftEmail, "new@example.test");
  const second = await signIn("second-subject");
  assert.notEqual(second.id, first.id);
  assert.equal(second.microsoftEmail, undefined);
  const backfilled = await signIn("second-subject", collision);
  assert.equal(backfilled.id, second.id);
  assert.equal(backfilled.microsoftEmail, collision);
});
