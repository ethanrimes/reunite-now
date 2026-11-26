import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { EmailClient } from "@azure/communication-email";
import { sendEmail } from "../server/email/delivery";
import { PGlite } from "@electric-sql/pglite";
import {
  newSignInCode,
  tokenFromCode,
  signInMessage,
} from "../server/email/signin-message";

test("email codes are independent and tolerate case, separators and common transcription substitutions", () => {
  const codes = Array.from({ length: 100 }, newSignInCode);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) {
    assert.match(code, /^[0-9A-HJKMNP-TV-Z]{20}$/);
    const token = tokenFromCode(code);
    assert.match(token!, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(token, code);
    assert.equal(
      tokenFromCode(code.toLowerCase().match(/.{4}/g)!.join(" - ")),
      token,
    );
  }
  assert.equal(
    tokenFromCode("OIL1".repeat(5)),
    tokenFromCode("0111".repeat(5)),
  );
  for (const bad of [
    "",
    "A".repeat(19),
    "A".repeat(21),
    "U".repeat(20),
    "0".repeat(19) + "!",
  ])
    assert.equal(tokenFromCode(bad), null);
});

test("HTML and plain text email carry identical credentials, an explicit link and a credential-free recovery page", () => {
  const code = newSignInCode(),
    token = tokenFromCode(code)!;
  const url =
    "https://example.test/auth/verify?ref=0123456789abcdef01234567&intent=feedback#token=" +
    token;
  const manual = "https://example.test/auth/verify?method=code&intent=feedback";
  const { text, html } = signInMessage(url, manual, code);
  const grouped = code.match(/.{4}/g)!.join("-");
  for (const part of [text, html]) {
    assert.ok(part.includes(grouped));
    assert.match(part, /15 minutes/);
  }
  assert.ok(text.includes(url) && text.includes(manual));
  const targets = [...html.matchAll(/href="([^"]+)"/g)].map((m) =>
    m[1].replaceAll("&amp;", "&"),
  );
  assert.deepEqual(targets, [url, manual]);
  assert.ok(!targets[1].includes(token) && !targets[1].includes(code));
});

test("Azure mail submission preserves both formats and reports acceptance and provider failures", async (t) => {
  const previous = [
    process.env.EMAIL_FROM,
    process.env.AZURE_COMMUNICATION_CONNECTION_STRING,
  ];
  process.env.EMAIL_FROM = "sender@example.test";
  process.env.AZURE_COMMUNICATION_CONNECTION_STRING =
    "endpoint=https://test.communication.azure.com/;accesskey=" +
    Buffer.alloc(32, 1).toString("base64");
  t.after(() => {
    for (const [i, name] of [
      "EMAIL_FROM",
      "AZURE_COMMUNICATION_CONNECTION_STRING",
    ].entries()) {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    }
  });
  const body = signInMessage(
    "https://example.test/auth/verify#token=example",
    "https://example.test/auth/verify?method=code",
    newSignInCode(),
  );
  let status = "Succeeded";
  const send = t.mock.method(EmailClient.prototype, "beginSend", async () => ({
    pollUntilDone: async () => ({ id: "accepted", status }),
  }));
  assert.deepEqual(
    await sendEmail(
      "person@example.test",
      "Sign in",
      body.text,
      "fixture",
      undefined,
      body.html,
    ),
    { id: "accepted" },
  );
  const [message] = send.mock.calls[0].arguments;
  assert.ok(message);
  assert.deepEqual(message.content, {
    subject: "Sign in",
    plainText: body.text,
    html: body.html,
  });
  status = "Failed";
  await assert.rejects(
    sendEmail(
      "person@example.test",
      "Sign in",
      body.text,
      "fixture",
      undefined,
      body.html,
    ),
    /did not confirm/,
  );
  send.mock.mockImplementation(async () => {
    throw new Error("transport unavailable");
  });
  await assert.rejects(
    sendEmail(
      "person@example.test",
      "Sign in",
      body.text,
      "fixture",
      undefined,
      body.html,
    ),
    /transport unavailable/,
  );
  delete process.env.EMAIL_FROM;
  await assert.rejects(
    sendEmail(
      "person@example.test",
      "Sign in",
      body.text,
      "fixture",
      undefined,
      body.html,
    ),
    /not configured/,
  );
});

test("email sign-in server, end to end", { timeout: 100000 }, async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "rn-signin-test-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(path.join(cwd, "server/data"), { recursive: true });
  await copyFile(
    path.resolve("server/data/dbip-country.mmdb.gz"),
    path.join(cwd, "server/data/dbip-country.mmdb.gz"),
  );
  const logs = path.join(cwd, ".local/email-signin");
  await mkdir(logs, { recursive: true });
  const expiredFile = path.join(logs, "2000-01-01-" + randomUUID() + ".jsonl");
  await writeFile(expiredFile, "old fixture");
  await mkdir(path.join(cwd, "dist/public"), { recursive: true });
  await writeFile(
    path.join(cwd, "dist/public/index.html"),
    "<title>Fixture</title>",
  );
  const legacy = randomBytes(32).toString("base64url");
  const lite = new PGlite(path.join(cwd, ".local/postgres"));
  await lite.exec(`
    CREATE TABLE login_tokens(token_hash text PRIMARY KEY,email text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE users(id text PRIMARY KEY,email text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now());
    CREATE SEQUENCE first_attempt;
    CREATE FUNCTION fail_once() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.email='retry@example.test' AND nextval('first_attempt')=1 THEN RAISE EXCEPTION 'fixture write failure'; END IF; RETURN NEW;
    END $$;
    CREATE TRIGGER transient BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION fail_once();
    CREATE FUNCTION expire_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.email='expired@example.test' THEN NEW.expires_at=now()-interval '1 minute'; END IF; RETURN NEW;
    END $$;
    CREATE TRIGGER expire BEFORE INSERT ON login_tokens FOR EACH ROW EXECUTE FUNCTION expire_fixture();
  `);
  await lite.query(
    "INSERT INTO login_tokens(token_hash,email,expires_at) VALUES($1,'legacy@example.test',now()+interval '15 minutes')",
    [createHash("sha256").update(legacy).digest("hex")],
  );
  await lite.close();
  const socket = createServer().listen(0, "127.0.0.1");
  await once(socket, "listening");
  const address = socket.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  const base = "http://127.0.0.1:" + address.port;
  const child = spawn(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), path.resolve("server/index.ts")],
    {
      cwd,
      env: {
        PATH: process.env.PATH,
        PORT: String(address.port),
        APP_URL: base,
        NODE_ENV: "test",
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  let stderr = "";
  child.stderr.on("data", (b) => (stderr += b.toString()));
  const exited = once(child, "exit");
  try {
    let ready = false;
    for (let i = 0; i < 200; i++) {
      if (child.exitCode !== null) break;
      if (
        await fetch(base + "/api/health")
          .then((r) => r.ok)
          .catch(() => false)
      ) {
        ready = true;
        break;
      }
      await delay(100);
    }
    assert.ok(ready, "Fixture server failed to start: " + stderr);
    async function post(endpoint: string, body: unknown, origin = base) {
      return fetch(base + "/api/auth/" + endpoint, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    const secrets = [legacy];
    async function issue(email: string) {
      const r = await post("email", { email, intent: "feedback" });
      assert.equal(r.status, 200);
      const { devLink, devCode } = await r.json();
      const url = new URL(devLink),
        token = new URLSearchParams(url.hash.slice(1)).get("token")!,
        ref = url.searchParams.get("ref")!;
      assert.equal(url.searchParams.get("intent"), "feedback");
      assert.match(ref, /^[a-f0-9]{24}$/);
      assert.equal(tokenFromCode(devCode), token);
      secrets.push(token, devCode);
      return { url, code: devCode, ref, token };
    }
    let firstRef = "";
    await t.test(
      "link scanners cannot redeem links; stripped fragments recover with a code on another device",
      async () => {
        const { url, code, ref, token } = await issue("New@Example.Test");
        firstRef = ref;
        assert.equal((await fetch(url)).status, 200);
        assert.equal(
          (await post("email-link-error", { reason: "missing_token", ref }))
            .status,
          204,
        );
        const r = await post("verify", {
          code: code.toLowerCase().match(/.{4}/g).join(" "),
          ref,
        });
        assert.equal(r.status, 200);
        const cookie = r.headers.get("set-cookie")!.split(";")[0];
        secrets.push(cookie.split("=")[1]);
        const me = await (
          await fetch(base + "/api/me", { headers: { Cookie: cookie } })
        ).json();
        assert.equal(me.user.email, "new@example.test");
        assert.equal(me.profile, null);
        assert.equal((await post("verify", { token })).status, 400);
      },
    );
    await t.test(
      "pre-deployment links work without a reference even when diagnostic storage fails",
      async () => {
        await rename(logs, logs + "-saved");
        await writeFile(logs, "simulate an unavailable directory");
        try {
          assert.equal((await post("verify", { token: legacy })).status, 200);
          for (
            let i = 0;
            i < 50 && !stderr.includes("diagnostics unavailable");
            i++
          )
            await delay(20);
          assert.match(stderr, /diagnostics unavailable/);
        } finally {
          await rm(logs);
          await rename(logs + "-saved", logs);
        }
      },
    );
    await t.test(
      "one concurrent redemption wins across both methods",
      async () => {
        const { code, token } = await issue("new@example.test");
        const results = await Promise.all([
          post("verify", { token }),
          post("verify", { code }),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
      },
    );
    await t.test("expired codes cannot start sessions", async () => {
      const { code } = await issue("expired@example.test");
      const r = await post("verify", { code });
      assert.equal(r.status, 400);
      assert.equal(r.headers.get("set-cookie"), null);
    });
    await t.test(
      "failed registration rolls back link consumption so the same credential can retry",
      async () => {
        const { token, code } = await issue("retry@example.test");
        const failed = await post("verify", { token });
        assert.equal(failed.status, 500);
        assert.equal(failed.headers.get("set-cookie"), null);
        assert.equal((await post("verify", { code })).status, 200);
      },
    );
    await t.test(
      "invalid credential, reference alone and disallowed origin fail without a session",
      async () => {
        for (const body of [{ ref: firstRef }, { code: "WRONG" }]) {
          const r = await post("verify", body);
          assert.equal(r.status, 400);
          assert.equal(r.headers.get("set-cookie"), null);
        }
        assert.equal(
          (await post("verify", {}, "https://other.invalid")).status,
          403,
        );
      },
    );
    await t.test(
      "throttled attempts stay throttled and browser diagnostics do not use the authentication quota",
      async () => {
        for (let i = 0; i < 30; i++)
          await post("email-link-error", { reason: "missing_token" });
        const last = await post("verify", { code: "bad" });
        assert.equal(last.status, 400);
        assert.equal((await post("verify", { code: "bad" })).status, 429);
      },
    );
    await t.test(
      "private diagnostics correlate failures and successes without credentials and prune old files",
      async () => {
        let log = "";
        for (let attempt = 0; attempt < 40; attempt++) {
          const files = await readdir(logs);
          log = (
            await Promise.all(
              files.map((f) => readFile(path.join(logs, f), "utf8")),
            )
          ).join("");
          if (log.includes("rate_limited")) break;
          await delay(50);
        }
        assert.equal(await stat(expiredFile).catch(() => null), null);
        const events = log
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        assert.ok(
          events.some(
            (e) =>
              e.operation === "issue" &&
              e.email === "new@example.test" &&
              e.linkId === firstRef,
          ),
        );
        assert.ok(
          events.some(
            (e) => e.reason === "missing_token" && e.suppliedRef === firstRef,
          ),
        );
        assert.ok(
          events.some(
            (e) =>
              e.outcome === "success" &&
              e.method === "code" &&
              e.email === "new@example.test" &&
              e.linkId === firstRef,
          ),
        );
        for (const reason of [
          "expired_or_removed",
          "unknown_or_consumed",
          "rate_limited",
          "origin_rejected",
          "invalid_code",
          "validation_failed",
          "internal_error",
        ])
          assert.ok(
            events.some((e) => e.reason === reason && e.message),
            reason,
          );
        for (const secret of secrets)
          assert.ok(
            !log.includes(secret) && !stderr.includes(secret),
            "credential leak",
          );
        assert.ok(!log.includes("#token="));
      },
    );
  } finally {
    child.kill();
    await exited;
  }
});
