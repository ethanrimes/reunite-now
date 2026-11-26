import test from "node:test";
import assert from "node:assert/strict";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

test("Verified email unifies first and returning sign-ins while retaining legacy Microsoft profiles", async (t) => {
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
  process.env.GOOGLE_CLIENT_ID = "google-profile-client";
  process.env.GOOGLE_CLIENT_SECRET = "google-profile-secret";
  process.env.APP_URL = "http://127.0.0.1:5173";
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
    if (String(url).endsWith("/keys") || String(url).endsWith("/certs"))
      return Response.json({
        keys: [
          {
            ...(await exportJWK(key.publicKey)),
            kid: "profile-test-key",
            alg: "RS256",
          },
        ],
      });
    const google = String(url) === "https://oauth2.googleapis.com/token";
    if (!google)
      assert.equal(
        String(url),
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      );
    const id_token = await new SignJWT({
      nonce,
      email,
      ...(google
        ? { email_verified: true }
        : { verified_primary_email: verifiedPrimary }),
    })
      .setProtectedHeader({ alg: "RS256", kid: "profile-test-key" })
      .setIssuer(google ? "https://accounts.google.com" : issuer)
      .setAudience(google ? "google-profile-client" : "profile-test-client")
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key.privateKey);
    return Response.json({ id_token });
  });
  function cookie(response: Response, name: string) {
    return response.headers
      .getSetCookie()
      .find((c) => c.startsWith(name + "=") && !c.startsWith(name + "=;"))
      ?.split(";")[0];
  }
  let verifiedPrimary: string | undefined;
  let client = 0;
  async function signIn(
    sub: string,
    claim?: string,
    provider: "google" | "microsoft" = "microsoft",
    connect?: { cookie: string; callbackCookie?: string },
  ) {
    client++;
    const headers = { "X-Forwarded-For": "192.0.2." + client };
    const start = await http(
      base + "/api/auth/" + provider + (connect ? "?connect=microsoft" : ""),
      {
        redirect: "manual",
        headers: { ...headers, Cookie: connect?.cookie ?? "" },
      },
    );
    const params = new URL(start.headers.get("location")!).searchParams;
    assert.equal(params.get("scope"), "openid email");
    if (connect) assert.equal(params.get("login_hint"), "member@gmail.com");
    nonce = params.get("nonce")!;
    subject = sub;
    email = claim;
    return http(
      base +
        "/api/auth/" +
        provider +
        "/callback?code=test&state=" +
        params.get("state"),
      {
        redirect: "manual",
        headers: {
          ...headers,
          Cookie: [
            cookie(start, "rn_flow_" + provider),
            connect?.callbackCookie ?? connect?.cookie,
          ]
            .filter(Boolean)
            .join("; "),
        },
      },
    );
  }
  async function post(route: string, data: object, cookies = "") {
    return http(base + "/api/auth/" + route, {
      method: "POST",
      headers: {
        Origin: process.env.APP_URL!,
        "Content-Type": "application/json",
        Cookie: cookies,
        "X-Forwarded-For": "192.0.2." + client,
      },
      body: JSON.stringify(data),
    });
  }
  async function mailbox(
    address: string,
    callback?: Response,
    checkBinding = false,
  ) {
    const link = callback && cookie(callback, "rn_oidc_link");
    if (callback) assert.ok(link);
    const sent = await post(
      "email",
      { email: address, ...(link && { connectProvider: "microsoft" }) },
      link,
    );
    assert.equal(sent.status, 200);
    const { devCode } = await sent.json();
    const proof = cookie(sent, "rn_oidc_proof");
    if (link) assert.ok(proof);
    if (checkBinding)
      assert.equal((await post("verify", { code: devCode })).status, 400);
    return post("verify", { code: devCode }, proof);
  }
  async function user(response: Response) {
    const session = cookie(response, "rn_session");
    assert.ok(session);
    return (
      await (
        await http(base + "/api/me", { headers: { Cookie: session } })
      ).json()
    ).user;
  }
  // Mailbox first, then an independently authenticated Microsoft subject.
  const pending = await signIn("first", collision);
  assert.equal(pending.headers.get("location"), "/login?connect=microsoft");
  assert.equal(cookie(pending, "rn_session"), undefined);
  assert.equal(
    (await user(await mailbox(collision.toUpperCase(), pending, true))).id,
    "existing-user",
  );
  const returning = await signIn("first", "different@example.test");
  assert.equal(returning.headers.get("location"), "/account");
  assert.equal((await user(returning)).email, collision);
  // Provider first, missing email claim, then a standalone email sign-in.
  const fresh = await signIn("second");
  const second = await user(await mailbox("member@example.test", fresh));
  assert.equal(
    (await user(await mailbox("MEMBER@example.test"))).id,
    second.id,
  );
  assert.equal((await user(await signIn("second"))).id, second.id);
  // Two providers converge on the same petition account in either order.
  for (const googleFirst of [true, false]) {
    const sub = googleFirst ? "google-first" : "microsoft-first";
    const email = sub + "@gmail.com";
    const googleLogin = () => signIn(sub, email.toUpperCase(), "google");
    const microsoftLogin = async () => mailbox(email, await signIn(sub, email));
    const first = await user(
      await (googleFirst ? googleLogin() : microsoftLogin()),
    );
    const next = await user(
      await (googleFirst ? microsoftLogin() : googleLogin()),
    );
    assert.equal(first.id, next.id);
    assert.equal(next.email, email);
    assert.equal((await user(await signIn(sub))).id, first.id);
  }
  const gmailUser = await user(
    await signIn("google-member", "member@gmail.com", "google"),
  );
  verifiedPrimary = "MEMBER@gmail.com";
  const direct = await signIn("verified-ms-gmail", "member@gmail.com");
  assert.equal(direct.headers.get("location"), "/account");
  assert.equal((await user(direct)).id, gmailUser.id);
  verifiedPrimary = undefined;
  const suggested = await signIn("suggested-ms-gmail", "member@gmail.com");
  assert.equal(
    suggested.headers.get("location"),
    "/login?connect=microsoft&method=google",
  );
  assert.equal(cookie(suggested, "rn_session"), undefined);
  const connect = { cookie: cookie(suggested, "rn_oidc_link")! };
  const mismatch = await signIn(
    "another-google-account",
    "different@gmail.com",
    "google",
    connect,
  );
  assert.equal(cookie(mismatch, "rn_session"), undefined);
  const otherBrowser = await signIn(
    "google-member",
    "member@gmail.com",
    "google",
    { ...connect, callbackCookie: "" },
  );
  assert.equal(cookie(otherBrowser, "rn_session"), undefined);
  const connected = await signIn(
    "google-member",
    "member@gmail.com",
    "google",
    connect,
  );
  assert.equal((await user(connected)).id, gmailUser.id);
  assert.equal(
    (await user(await signIn("suggested-ms-gmail"))).id,
    gmailUser.id,
  );

  // Legacy provider-only users keep their original id and records. A different
  // account owning the chosen address must never be overwritten.
  const { createHash } = await import("node:crypto");
  const identity = createHash("sha256")
    .update(JSON.stringify([issuer, "profile-test-client", "legacy"]))
    .digest("hex");
  await db.query("INSERT INTO users(id,microsoft_email) VALUES($1,$2)", [
    "legacy-user",
    collision,
  ]);
  await db.query(
    "INSERT INTO oauth_identities(identity_key,user_id) VALUES($1,$2)",
    [identity, "legacy-user"],
  );
  const legacy = await signIn("legacy", collision);
  assert.equal((await user(legacy)).id, "legacy-user");
  assert.equal((await mailbox(collision, legacy)).status, 409);
  const upgraded = await user(await mailbox("legacy@example.test", legacy));
  assert.equal(upgraded.id, "legacy-user");
  assert.equal(upgraded.email, "legacy@example.test");
  assert.equal((await user(await signIn("legacy"))).id, upgraded.id);
});
