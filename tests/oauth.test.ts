import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { exportJWK, exportPKCS8, generateKeyPair, SignJWT } from "jose";
import { additionalProviders } from "../shared/auth-providers";
import { begin, finish, readTicket } from "../server/auth/providers";

for (const provider of additionalProviders) {
  test(
    provider +
      " verifies the authorization callback and resolves the account identity",
    async (t) => {
      const apple = provider === "apple";
      if (apple) {
        process.env.APPLE_TEAM_ID = "test-team";
        process.env.APPLE_KEY_ID = "test-key";
      }
      const microsoft = provider === "microsoft";
      const issuer = microsoft
        ? "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0"
        : apple
          ? "https://appleid.apple.com"
          : "https://api.login." + provider + ".com";
      const secret = apple
        ? await exportPKCS8(
            (await generateKeyPair("ES256", { extractable: true })).privateKey,
          )
        : "test-only-secret";
      const cfg = {
        id: "test-client",
        secret,
        redirect: "https://example.test/api/auth/" + provider + "/callback",
      };
      const flow = await begin(provider, cfg, true);
      const params = new URL(flow.url).searchParams;
      const saved = await readTicket(cfg, provider, "authorize", flow.cookie);
      assert.equal(params.get("redirect_uri"), cfg.redirect);
      assert.equal(params.get("state"), saved.state);
      if (apple) assert.equal(params.get("response_mode"), "form_post");
      else
        assert.equal(
          params.get("code_challenge"),
          createHash("sha256")
            .update(String(saved.verifier))
            .digest("base64url"),
        );
      await assert.rejects(
        finish(provider, cfg, flow.cookie, { state: "mismatch", code: "code" }),
      );
      const key = await generateKeyPair("RS256");
      let nonce = params.get("nonce");
      let email =
        "test@" +
        (apple ? "icloud.com" : microsoft ? "outlook.com" : provider + ".com");
      let verified: boolean | string = true;
      t.mock.method(
        globalThis,
        "fetch",
        async (url: string | URL, init: RequestInit) => {
          if (init.method === "POST") {
            assert.equal(
              (init.body as URLSearchParams).get("code_verifier"),
              apple ? null : saved.verifier,
            );
            const id_token = await new SignJWT({
              nonce,
              ...(apple || microsoft
                ? { email, email_verified: verified }
                : {}),
            })
              .setProtectedHeader({ alg: "RS256", kid: "test-key" })
              .setIssuer(issuer)
              .setAudience(cfg.id)
              .setSubject("test-subject")
              .setIssuedAt()
              .setExpirationTime("5m")
              .sign(key.privateKey);
            return Response.json({
              id_token,
              access_token: "test-access-token",
            });
          }
          if (String(url).endsWith("/userinfo"))
            return Response.json({
              sub: "test-subject",
              email,
              email_verified: verified,
            });
          return Response.json({
            keys: [
              {
                ...(await exportJWK(key.publicKey)),
                kid: "test-key",
                alg: "RS256",
              },
            ],
          });
        },
      );
      const input = { state: saved.state, code: "code" };
      const info = await finish(provider, cfg, flow.cookie, input);
      assert.equal(info.address, email);
      assert.equal(info.authoritative, !microsoft);
      assert.equal(info.destination, "/feedback");
      assert.match(info.identity, /^[a-f0-9]{64}$/);
      email = "person@example.org";
      verified = "true";
      const signup = await finish(provider, cfg, flow.cookie, input);
      assert.equal(signup.emailVerified, true);
      assert.equal(signup.authoritative, false);
      assert.equal(signup.identity, info.identity);
      verified = false;
      assert.equal(
        (await finish(provider, cfg, flow.cookie, input)).emailVerified,
        false,
      );
      nonce = "different-nonce";
      await assert.rejects(
        finish(provider, cfg, flow.cookie, input),
        /Invalid identity/,
      );
    },
  );
}
