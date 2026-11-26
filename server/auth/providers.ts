import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import {
  additionalProviders,
  type Provider,
} from "../../shared/auth-providers";

const consumerTenant = "9188040d-6c67-4c5b-b112-36a304b66dad";
const ms = "https://login.microsoftonline.com/";
const services = {
  apple: {
    issuer: "https://appleid.apple.com",
    authorize: "https://appleid.apple.com/auth/authorize",
    token: "https://appleid.apple.com/auth/token",
    keys: "https://appleid.apple.com/auth/keys",
  },
  yahoo: {
    issuer: "https://api.login.yahoo.com",
    authorize: "https://api.login.yahoo.com/oauth2/request_auth",
    token: "https://api.login.yahoo.com/oauth2/get_token",
    keys: "https://api.login.yahoo.com/openid/v1/certs",
  },
  microsoft: {
    issuer: ms + consumerTenant + "/v2.0",
    authorize: ms + "consumers/oauth2/v2.0/authorize",
    token: ms + "consumers/oauth2/v2.0/token",
    keys: ms + "consumers/discovery/v2.0/keys",
  },
};
const keys = new Map(
  additionalProviders.map((p) => [
    p,
    createRemoteJWKSet(new URL(services[p].keys)),
  ]),
);
export function config(p: Provider, base: string) {
  const id = process.env[p.toUpperCase() + "_CLIENT_ID"];
  const secret =
    p === "apple"
      ? process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
      : process.env[p.toUpperCase() + "_CLIENT_SECRET"];
  if (
    !id ||
    !secret ||
    (p === "apple" &&
      (!process.env.APPLE_TEAM_ID ||
        !process.env.APPLE_KEY_ID ||
        !base.startsWith("https://")))
  )
    return;
  return { id, secret, redirect: base + "/api/auth/" + p + "/callback" };
}
type Config = NonNullable<ReturnType<typeof config>>;
const random = () => randomBytes(32).toString("base64url");
function cookieKey(c: Config) {
  return createHash("sha256")
    .update("rn:oauth-cookie:" + c.secret)
    .digest();
}
export function ticket(
  c: Config,
  p: Provider,
  purpose: string,
  claims: Record<string, string>,
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(p + ":" + purpose)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(cookieKey(c));
}
export async function readTicket(
  c: Config,
  p: Provider,
  purpose: string,
  value: string,
) {
  return (
    await jwtVerify(value, cookieKey(c), {
      algorithms: ["HS256"],
      audience: p + ":" + purpose,
    })
  ).payload;
}
export async function begin(p: Provider, c: Config, feedback: boolean) {
  const state = random(),
    nonce = random(),
    verifier = random();
  const url = new URL(services[p].authorize);
  url.search = new URLSearchParams({
    client_id: c.id,
    redirect_uri: c.redirect,
    response_type: "code",
    scope: p === "apple" ? "email" : "openid email",
    state,
    nonce,
  }).toString();
  if (p === "apple") url.searchParams.set("response_mode", "form_post");
  else {
    url.searchParams.set(
      "code_challenge",
      createHash("sha256").update(verifier).digest("base64url"),
    );
    url.searchParams.set("code_challenge_method", "S256");
  }
  return {
    url: url.href,
    cookie: await ticket(c, p, "authorize", {
      state,
      nonce,
      verifier,
      destination: feedback ? "/feedback" : "/account",
    }),
  };
}
export async function finish(
  p: Provider,
  c: Config,
  cookie: string,
  input: Record<string, unknown>,
) {
  const saved = await readTicket(c, p, "authorize", cookie);
  if (
    !saved.state ||
    input.state !== saved.state ||
    typeof input.code !== "string"
  )
    throw Error("Invalid callback");
  let secret = c.secret;
  if (p === "apple") {
    secret = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
      .setIssuer(process.env.APPLE_TEAM_ID!)
      .setSubject(c.id)
      .setAudience(services.apple.issuer)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(await importPKCS8(c.secret, "ES256"));
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: c.redirect,
    client_id: c.id,
    client_secret: secret,
  });
  if (p !== "apple") body.set("code_verifier", String(saved.verifier));
  const response = await fetch(services[p].token, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) throw Error("Code exchange failed");
  const tokens = await response.json();
  const { payload } = await jwtVerify(tokens.id_token, keys.get(p)!, {
    issuer: services[p].issuer,
    audience: c.id,
    algorithms: ["RS256", "ES256"],
    requiredClaims: ["sub", "exp", "iat", "nonce"],
  });
  if (
    typeof payload.sub !== "string" ||
    !payload.sub.trim() ||
    payload.nonce !== saved.nonce ||
    (payload.azp !== undefined && payload.azp !== c.id) ||
    (Array.isArray(payload.aud) &&
      payload.aud.length > 1 &&
      payload.azp !== c.id)
  )
    throw Error("Invalid identity");
  const identity = createHash("sha256")
    .update(JSON.stringify([services[p].issuer, c.id, payload.sub]))
    .digest("hex");
  let claims = payload;
  if (
    p === "yahoo" &&
    (!claims.email || claims.email_verified === undefined) &&
    typeof tokens.access_token === "string"
  ) {
    const response = await fetch(services[p].issuer + "/openid/v1/userinfo", {
      headers: { Authorization: "Bearer " + tokens.access_token },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (response.ok) {
      const user = await response.json();
      if (user.sub !== payload.sub) throw Error("Invalid user information");
      claims = user;
    }
  }
  const email = z.email().max(254).safeParse(claims.email);
  const address = email.success ? email.data.toLowerCase() : "";
  const domain = address.split("@")[1];
  const verified =
    claims.email_verified === true || claims.email_verified === "true";
  const authoritative =
    verified &&
    ((p === "yahoo" &&
      ["yahoo.com", "ymail.com", "rocketmail.com"].includes(domain)) ||
      (p === "apple" &&
        [
          "icloud.com",
          "me.com",
          "mac.com",
          "privaterelay.appleid.com",
          "private.icloud.com",
        ].includes(domain)));
  return {
    identity,
    address,
    emailVerified: Boolean(address) && verified,
    authoritative,
    destination: saved.destination === "/feedback" ? "/feedback" : "/account",
  };
}
