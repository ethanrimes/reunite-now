import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { Google, generateCodeVerifier, generateState } from "arctic";
import { z } from "zod";
import { db, transaction, migrate } from "./db";
import { emailReady, sendEmail } from "./email";
import { canonicalHost } from "./canonical";
import { sendReminders } from "./reminders";
import { createDemoData, demoEnabled } from "./demo";
import {
  profileSchema,
  storySchema,
  states,
  type Profile,
  type PublicProfile,
} from "../shared/schema";
const production = process.env.NODE_ENV === "production";
const appUrl = process.env.APP_URL || "http://127.0.0.1:5173";
const devAuth = !production && process.env.DEV_AUTH !== "false";
const demo = demoEnabled() ? await createDemoData() : null;
if (production && !process.env.APP_URL?.startsWith("https://"))
  throw new Error("HTTPS APP_URL required");
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: production ? [] : null,
      },
    },
    referrerPolicy: { policy: "no-referrer" },
  }),
);
if (production) app.use(canonicalHost(appUrl));
app.use(compression());
app.use(express.json({ limit: "7mb" }));
app.use(cookieParser());
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
});
app.use("/api", (req, res, next) => {
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    !req.path.startsWith("/jobs/")
  ) {
    const origin = req.get("origin");
    if (origin !== new URL(appUrl).origin)
      return void res.status(403).json({ error: "Request origin not allowed" });
  }
  next();
});
const token = () => randomBytes(32).toString("base64url");
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: "lax" as const,
  path: "/",
};
async function currentUser(req: Request) {
  const raw = req.cookies.rn_session;
  if (!raw || typeof raw !== "string") return null;
  return (
    (
      await db.query(
        `SELECT u.id,u.email,s.created_at AS authenticated_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
        [hash(raw)],
      )
    ).rows[0] || null
  );
}
async function requireUser(req: Request, res: Response, next: NextFunction) {
  const u = await currentUser(req);
  if (!u)
    return void res.status(401).json({ error: "Please sign in to continue" });
  res.locals.user = u;
  next();
}
async function session(email: string, res: Response) {
  const uid = randomUUID();
  const u = await db.query(
    `INSERT INTO users(id,email) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id`,
    [uid, email],
  );
  const raw = token();
  await db.query(
    `INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')`,
    [hash(raw), u.rows[0].id],
  );
  res.cookie("rn_session", raw, { ...cookieOptions, maxAge: 30 * 86400000 });
}
app.get("/api/health", async (_req, res) => {
  await db.query("SELECT 1");
  res.json({ ok: true, service: "reunite-now", version: "0.1.0" });
});
app.get("/api/config", (_req, res) =>
  res.json({
    emailAuth: emailReady(),
    googleAuth: !!(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    devAuth,
    demoData: !!demo,
    reminders: emailReady(),
    consentVersion: "2026-11-11",
  }),
);
app.post("/api/auth/email", authLimit, async (req, res) => {
  const { email } = z
    .object({
      email: z
        .email()
        .max(254)
        .transform((v) => v.trim().toLowerCase()),
    })
    .parse(req.body);
  if (!emailReady() && !devAuth)
    return void res.status(503).json({
      error:
        "Email sign-in opens once the project’s email service is connected.",
    });
  const raw = token();
  await db.query(
    `INSERT INTO login_tokens(token_hash,email,expires_at) VALUES($1,$2,now()+interval '15 minutes')`,
    [hash(raw), email],
  );
  const url = `${appUrl}/auth/verify#token=${raw}`;
  if (emailReady())
    await sendEmail(
      email,
      "Your Reunite Now sign-in link",
      `Use this link within 15 minutes to sign in to Reunite Now:\n\n${url}\n\nIf you did not request this, ignore this email.`,
      `signin/${hash(raw)}`,
    );
  res.json({ ok: true, ...(devAuth && !emailReady() ? { devLink: url } : {}) });
});
app.post("/api/auth/verify", authLimit, async (req, res) => {
  const { token: raw } = z
    .object({ token: z.string().min(40).max(100) })
    .parse(req.body);
  const r = await db.query(
    `DELETE FROM login_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING email`,
    [hash(raw)],
  );
  if (!r.rows[0])
    return void res.status(400).json({
      error: "This link has expired or already been used. Request a new link.",
    });
  await session(r.rows[0].email, res);
  res.json({ ok: true });
});
function google() {
  return new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${appUrl}/api/auth/google/callback`,
  );
}
app.get("/api/auth/google", authLimit, (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    return void res.redirect("/login?error=google-unavailable");
  const state = generateState(),
    verifier = generateCodeVerifier();
  res.cookie("rn_oauth", JSON.stringify({ state, verifier }), {
    ...cookieOptions,
    maxAge: 600000,
  });
  res.redirect(
    google()
      .createAuthorizationURL(state, verifier, ["openid", "email", "profile"])
      .toString(),
  );
});
app.get("/api/auth/google/callback", authLimit, async (req, res) => {
  let saved;
  try {
    saved = JSON.parse(req.cookies.rn_oauth || "{}");
  } catch {
    return void res.redirect("/login?error=oauth");
  }
  res.clearCookie("rn_oauth", cookieOptions);
  if (
    typeof req.query.code !== "string" ||
    req.query.state !== saved.state ||
    !saved.verifier
  )
    return void res.redirect("/login?error=oauth");
  try {
    const tokens = await google().validateAuthorizationCode(
      req.query.code,
      saved.verifier,
    );
    const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error("Google userinfo failed");
    const info = await r.json();
    if (info.email_verified !== true || typeof info.email !== "string")
      throw new Error("Unverified email");
    await session(info.email.toLowerCase(), res);
    res.redirect("/account");
  } catch {
    res.redirect("/login?error=oauth");
  }
});
app.post("/api/auth/logout", async (req, res) => {
  if (req.cookies.rn_session)
    await db.query("DELETE FROM sessions WHERE token_hash=$1", [
      hash(req.cookies.rn_session),
    ]);
  res.clearCookie("rn_session", cookieOptions);
  res.json({ ok: true });
});
app.get("/api/me", async (req, res) => {
  const u = await currentUser(req);
  if (!u) return void res.json({ user: null });
  const p = await db.query(
    `SELECT data,updated_at,signed_at FROM profiles WHERE user_id=$1`,
    [u.id],
  );
  const s = await db.query(`SELECT data FROM stories WHERE user_id=$1`, [u.id]);
  res.json({
    user: { id: u.id, email: u.email },
    profile: p.rows[0]
      ? {
          ...p.rows[0].data,
          updatedAt: p.rows[0].updated_at,
          signedAt: p.rows[0].signed_at,
        }
      : null,
    story: s.rows[0]?.data || null,
  });
});
app.put("/api/me/profile", requireUser, async (req, res) => {
  const data = profileSchema.parse(req.body);
  data.reminderEmails = data.reminderEmails.filter(
    (email) => email !== res.locals.user.email.trim().toLowerCase(),
  );
  if (data.country === "United States") {
    const districts = JSON.parse(
      await readFile("public/data/districts.json", "utf8"),
    );
    const fips = states.find((s) => s[1] === data.state)?.[0];
    if (
      !districts.features.some(
        (f: any) => f.properties.GEOID === `${fips}${data.district}`,
      )
    )
      return void res.status(400).json({
        error: "Choose a valid 119th Congress district for your state.",
      });
  }
  const now = new Date().toISOString();
  data.cases = data.cases.map((c) => ({ ...c, updatedAt: now }));
  await db.query(
    `INSERT INTO profiles(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,
    [res.locals.user.id, JSON.stringify(data)],
  );
  res.json({ ok: true, updatedAt: now });
});
app.post("/api/me/confirm", requireUser, async (_req, res) => {
  const now = new Date().toISOString();
  await transaction(async (q) => {
    const p = await q.query(
      `SELECT data FROM profiles WHERE user_id=$1 FOR UPDATE`,
      [res.locals.user.id],
    );
    if (!p.rows[0])
      throw Object.assign(new Error("Complete your petition profile first"), {
        status: 400,
      });
    const data = p.rows[0].data as Profile;
    data.cases = data.cases.map((c) => ({ ...c, updatedAt: now }));
    await q.query(
      "UPDATE profiles SET data=$2,updated_at=now() WHERE user_id=$1",
      [res.locals.user.id, JSON.stringify(data)],
    );
  });
  res.json({ ok: true, updatedAt: now });
});
app.put("/api/me/story", requireUser, async (req, res) => {
  const data = storySchema.parse(req.body);
  const p = await db.query(`SELECT data FROM profiles WHERE user_id=$1`, [
    res.locals.user.id,
  ]);
  if (!p.rows[0])
    return void res
      .status(400)
      .json({ error: "Sign the petition before sharing a story" });
  if (
    data.caseId &&
    !p.rows[0].data.cases.some((c: any) => c.id === data.caseId)
  )
    return void res
      .status(400)
      .json({ error: "Choose one of your visa cases" });
  await db.query(
    `INSERT INTO stories(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,
    [res.locals.user.id, JSON.stringify(data)],
  );
  res.json({ ok: true });
});
app.delete("/api/me/story", requireUser, async (_req, res) => {
  await db.query("DELETE FROM stories WHERE user_id=$1", [res.locals.user.id]);
  res.json({ ok: true });
});
app.get("/api/me/export", requireUser, async (_req, res) => {
  const u = res.locals.user;
  const p = await db.query(
    "SELECT data,updated_at,signed_at FROM profiles WHERE user_id=$1",
    [u.id],
  );
  const s = await db.query("SELECT data FROM stories WHERE user_id=$1", [u.id]);
  res.attachment("reunite-now-data.json").json({
    email: u.email,
    profile: p.rows[0] || null,
    story: s.rows[0]?.data || null,
  });
});
app.delete("/api/me", requireUser, async (req, res) => {
  if (req.body?.confirmation !== "DELETE")
    return void res
      .status(400)
      .json({ error: "Type DELETE to confirm account deletion" });
  await transaction(async (q) => {
    await q.query("DELETE FROM login_tokens WHERE email=$1", [
      res.locals.user.email,
    ]);
    await q.query("DELETE FROM users WHERE id=$1", [res.locals.user.id]);
  });
  res.clearCookie("rn_session", cookieOptions);
  res.json({ ok: true });
});
app.get("/api/public", async (_req, res) => {
  const rows = await db.query(
    `SELECT user_id,data,updated_at,signed_at FROM profiles WHERE data->>'signed'='true' AND data->>'publicConsent'='true'`,
  );
  const profiles = rows.rows.map((r) => {
    const p = profileSchema.parse(r.data);
    const {
      reminders,
      reminderEmails,
      adultConsent,
      publicConsent,
      signed,
      ...data
    } = p;
    return {
      ...data,
      id: r.user_id,
      updatedAt: r.updated_at,
      signedAt: r.signed_at,
    };
  });
  res.json({
    profiles: [...profiles, ...(demo?.profiles || [])],
    updatedAt: new Date().toISOString(),
  });
});
app.get("/api/stories", async (_req, res) => {
  const rows = await db.query(
    `SELECT s.user_id,s.data,s.updated_at,p.data AS profile FROM stories s JOIN profiles p ON s.user_id=p.user_id WHERE s.data->>'publish'='true' AND p.data->>'publicConsent'='true'`,
  );
  res.json({
    stories: [
      ...rows.rows.map((r) => {
        const { rightsConsent, publish, ...story } = storySchema.parse(r.data);
        return {
          ...story,
          id: r.user_id,
          name: r.profile.name,
          country: r.profile.country,
          updatedAt: r.updated_at,
          timeline:
            r.profile.cases.find((c: any) => c.id === story.caseId)?.events ||
            [],
        };
      }),
      ...(demo?.stories || []),
    ],
  });
});
app.post(
  "/api/district-lookup",
  rateLimit({ windowMs: 60000, limit: 10 }),
  async (req, res) => {
    const { address } = z
      .object({ address: z.string().trim().min(8).max(300) })
      .parse(req.body);
    const params = new URLSearchParams({
      address,
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      format: "json",
    });
    const r = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok)
      throw Object.assign(
        new Error(
          "Census lookup is unavailable. Select your district manually.",
        ),
        { status: 503 },
      );
    const data = await r.json();
    const matches = data.result?.addressMatches;
    if (!matches?.length)
      return void res.status(404).json({
        error:
          "No address match. Try a complete US street address, or choose your district manually.",
      });
    const match = matches[0];
    const p = new URLSearchParams({
      geometry: `${match.coordinates.x},${match.coordinates.y}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "GEOID,STATE,CD119,NAME",
      returnGeometry: "false",
      f: "json",
    });
    const d = await fetch(
      `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/4/query?${p}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const district = (await d.json()).features?.[0]?.attributes;
    if (!district)
      return void res.status(404).json({
        error: "District could not be determined. Select it manually.",
      });
    const geoid = String(district.GEOID);
    res.json({
      state: states.find((s) => s[0] === geoid.slice(0, 2))?.[1],
      district: geoid.slice(2),
      congress: 119,
    });
  },
);
app.post("/api/jobs/reminders", async (req, res) => {
  const secret = process.env.CRON_SECRET,
    auth = req.get("authorization") || "";
  if (
    !secret ||
    auth.length !== `Bearer ${secret}`.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(`Bearer ${secret}`))
  )
    return void res.status(401).json({ error: "Unauthorized" });
  res.json(await sendReminders());
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found" }),
);
app.use(
  express.static(path.resolve("dist/public"), {
    maxAge: "1h",
    setHeaders(res, filename) {
      if (filename.endsWith(".html"))
        res.setHeader("Cache-Control", "no-cache");
    },
  }),
);
app.get("/{*path}", (_req, res) =>
  res
    .set("Cache-Control", "no-cache")
    .sendFile(path.resolve("dist/public/index.html")),
);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError)
    return void res.status(400).json({
      error: err.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
  console.error("Request failed", err.code || err.name || "Error");
  res.status(err.status || 500).json({
    error: err.status ? err.message : "Something went wrong. Please try again.",
  });
});
await migrate();
await db.query("DELETE FROM login_tokens WHERE expires_at<now()");
await db.query("DELETE FROM sessions WHERE expires_at<now()");
app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log(`Reunite Now API ready on port ${process.env.PORT || 3001}`),
);
