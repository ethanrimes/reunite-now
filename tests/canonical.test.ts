import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { canonicalHost } from "../server/canonical";

test("canonical redirects preserve browser routes, protect the destination, and leave probes and writes alone", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(canonicalHost("https://visatransparencypetition.org"));
  app.use((_req, res) => res.sendStatus(204));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = (
    path: string,
    host: string,
    method = "GET",
    forwardedHost?: string,
  ) =>
    new Promise<{
      status: number;
      headers: { get(name: string): string | null };
    }>((resolve, reject) => {
      const req = httpRequest(
        base + path,
        {
          method,
          headers: {
            Host: host,
            ...(forwardedHost ? { "X-Forwarded-Host": forwardedHost } : {}),
          },
        },
        (response) => {
          response.resume();
          response.on("end", () =>
            resolve({
              status: response.statusCode!,
              headers: {
                get: (name) => String(response.headers[name] ?? "") || null,
              },
            }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
  try {
    let result = await request(
      "/login?intent=sign",
      "www.visatransparencypetition.org",
    );
    assert.equal(result.status, 308);
    for (const legacy of ["visatransparency.org", "www.visatransparency.org"]) {
      const redirected = await request("/visa-data?view=map", legacy);
      assert.equal(redirected.status, 308);
      assert.equal(
        redirected.headers.get("location"),
        "https://visatransparencypetition.org/visa-data?view=map",
      );
    }

    assert.equal(
      result.headers.get("location"),
      "https://visatransparencypetition.org/login?intent=sign",
    );
    result = await request(
      "/api/auth/google",
      "reunite-now-9a04.azurewebsites.net",
    );
    assert.equal(
      result.headers.get("location"),
      "https://visatransparencypetition.org/api/auth/google",
    );
    result = await request(
      "//untrusted.example/path",
      "www.visatransparencypetition.org",
    );
    assert.equal(
      new URL(result.headers.get("location")!).hostname,
      "visatransparencypetition.org",
    );
    result = await request(
      "/account",
      "www.visatransparencypetition.org",
      "GET",
      "visatransparencypetition.org",
    );
    assert.equal(
      result.status,
      308,
      "forwarded host cannot suppress canonical redirects",
    );
    assert.equal(
      (await request("/coverage", "VISATRANSPARENCYPETITION.ORG")).status,
      204,
    );
    assert.equal((await request("/api/health", "localhost")).status, 204);
    assert.equal(
      (await request("/api/jobs/reminders", "localhost", "POST")).status,
      204,
    );
    assert.equal(
      (
        await request(
          "/api/me/profile",
          "www.visatransparencypetition.org",
          "PUT",
        )
      ).status,
      204,
    );
    assert.equal(
      (await request("/about", "www.visatransparencypetition.org", "HEAD"))
        .status,
      308,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
