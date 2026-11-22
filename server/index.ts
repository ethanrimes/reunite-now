import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  visaStatistics,
  type PlaceCount,
  type StoryCard,
} from "../shared/public-views";
import { filterSignatures } from "../shared/coverage";
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
import { db, transaction, migrate, dual, region, inRegion } from "./db";
import {
  acrossRegions,
  homeForEmail,
  locate,
  moveAccount,
  routed,
} from "./regions";
import { regionForIP } from "./geolocation";
import { emailReady, sendEmail } from "./email";
import {
  storyCover,
  cleanStoryPhoto,
  cleanHistoricalStoryPhotos,
} from "./story-photos";
import { canonicalHost } from "./canonical";
import { sendReminders } from "./reminders";
import { createDemoData, demoEnabled } from "./demo";
import {
  consentVersion,
  profileSchema,
  profileWriteSchema,
  profileSections,
  type ProfileSection,
  storySchema,
  states,
  type Profile,
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
function detectedRegion(req: Request) {
  // App Service overwrites Client-IP at its ingress. Development uses the socket peer.
  return regionForIP(
    process.env.WEBSITE_SITE_NAME
      ? req.get("client-ip")
      : req.socket.remoteAddress,
  );
}
type Handler = (req: Request, res: Response) => Promise<unknown>;
function accountRoute(
  handler: Handler,
  { optional = false, exclusive = false } = {},
): Handler {
  return async (req, res) => {
    const noSession = () =>
      optional
        ? res.json({ user: null })
        : res.status(401).json({ error: "Please sign in to continue" });
    const raw = req.cookies.rn_session;
    if (typeof raw !== "string" || !raw) return noSession();
    const tokenHash = hash(raw);
    return routed(exclusive, async () => {
      const matches = (
        await acrossRegions(async () => {
          const result = await db.query<{ id: string; email: string }>(
            `SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
            [tokenHash],
          );
          return result.rows.map((user) => ({ user, storage: region() }));
        })
      ).flat();
      if (matches.length > 1) throw new Error("Conflicting regional identity");
      const match = matches[0];
      if (!match) return noSession();
      res.locals.user = match.user;
      return inRegion(match.storage, () => handler(req, res));
    });
  };
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
async function signInAtHome(
  email: string,
  fallback: "eu" | "us",
  res: Response,
) {
  const home = await homeForEmail(email, fallback);
  if (dual) {
    // Before first verification multiple devices may request links in different regions.
    // Revoke any pre-registration links held outside the verified account's home.
    await inRegion(home === "eu" ? "us" : "eu", () =>
      db.query(
        "DELETE FROM login_tokens WHERE sha256(convert_to(email,'UTF8'))=decode($1,'hex')",
        [hash(email)],
      ),
    );
  }
  await inRegion(home, () => session(email, res));
}
app.get("/api/health", async (_req, res) => {
  await acrossRegions(() => db.query("SELECT 1"));
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
    consentVersion,
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
  await routed(false, async () =>
    inRegion(await homeForEmail(email, detectedRegion(req)), () =>
      db.query(
        `INSERT INTO login_tokens(token_hash,email,expires_at) VALUES($1,$2,now()+interval '15 minutes')`,
        [hash(raw), email],
      ),
    ),
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
  const verified = await routed(true, async () => {
    const source = await locate(
      "SELECT 1 FROM login_tokens WHERE token_hash=$1 AND expires_at>now()",
      [hash(raw)],
    );
    if (!source) return false;
    const result = await inRegion(source, () =>
      db.query(
        "DELETE FROM login_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING email",
        [hash(raw)],
      ),
    );
    const email = result.rows[0]?.email;
    if (!email) return false;
    await signInAtHome(email, source, res);
    return true;
  });
  if (!verified)
    return void res.status(400).json({
      error: "This link has expired or already been used. Request a new link.",
    });
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
    await routed(true, () =>
      signInAtHome(info.email.toLowerCase(), detectedRegion(req), res),
    );
    res.redirect("/account");
  } catch {
    res.redirect("/login?error=oauth");
  }
});
app.post("/api/auth/logout", async (req, res) => {
  if (req.cookies.rn_session)
    await routed(false, () =>
      acrossRegions(() =>
        db.query("DELETE FROM sessions WHERE token_hash=$1", [
          hash(req.cookies.rn_session),
        ]),
      ),
    );
  res.clearCookie("rn_session", cookieOptions);
  res.json({ ok: true });
});
app.get(
  "/api/me",
  accountRoute(
    async (req, res) => {
      const u = res.locals.user;
      if (req.query.view === "session")
        return void res.json({
          user: { id: u.id },
          profile: null,
          story: null,
        });
      const [p, s] = await Promise.all([
        db.query(
          `SELECT data,updated_at,signed_at FROM profiles WHERE user_id=$1`,
          [u.id],
        ),
        db.query(`SELECT data FROM stories WHERE user_id=$1`, [u.id]),
      ]);
      res.json({
        user: {
          id: u.id,
          email: u.email,
          storageRegion: dual ? region() : undefined,
        },
        profile: p.rows[0]
          ? {
              ...profileSchema.parse(p.rows[0].data),
              updatedAt: p.rows[0].updated_at,
              signedAt: p.rows[0].signed_at,
            }
          : null,
        story: s.rows[0] ? storySchema.parse(s.rows[0].data) : null,
      });
    },
    { optional: true },
  ),
);
async function validateDistrict(data: Profile) {
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
      throw Object.assign(
        new Error("Choose a valid 119th Congress district for your state."),
        { status: 400 },
      );
  }
}
app.put(
  "/api/me/profile",
  accountRoute(async (req, res) => {
    const data = profileWriteSchema.parse(req.body);
    data.reminderEmails = data.reminderEmails.filter(
      (email) => email !== res.locals.user.email.trim().toLowerCase(),
    );
    await validateDistrict(data);
    const now = new Date().toISOString();
    data.cases = data.cases.map((c) => ({ ...c, updatedAt: now }));
    await db.query(
      `INSERT INTO profiles(user_id,data,consent_version) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,
      [res.locals.user.id, JSON.stringify(data), consentVersion],
    );
    res.json({ ok: true, updatedAt: now });
  }),
);
app.patch(
  "/api/me/profile/:section",
  accountRoute(async (req, res) => {
    const section = req.params.section as ProfileSection;
    if (!Object.hasOwn(profileSections, section))
      return void res.sendStatus(404);
    const fields = profileSections[section];
    const user = res.locals.user;
    const sectionValues = await transaction(async (q) => {
      const result = await q.query(
        "SELECT data FROM profiles WHERE user_id=$1 FOR UPDATE",
        [user.id],
      );
      if (!result.rows[0])
        throw Object.assign(new Error("Sign the petition first."), {
          status: 400,
        });
      const saved = result.rows[0].data;
      const updates = Object.fromEntries(
        fields
          .filter((key) => Object.hasOwn(req.body ?? {}, key))
          .map((key) => [key, req.body[key]]),
      );
      if (!Object.keys(updates).length)
        throw Object.assign(new Error("No fields to save."), { status: 400 });
      const data = (
        section === "cases" ? profileWriteSchema : profileSchema
      ).parse({ ...saved, ...updates });
      if (section === "profile") await validateDistrict(data);
      if (section === "settings")
        data.reminderEmails = data.reminderEmails.filter(
          (email) => email !== user.email.toLowerCase(),
        );
      const now = new Date().toISOString();
      if (section !== "settings")
        data.cases = data.cases.map((c) => ({
          ...c,
          ...(c.role === "Applicant" && { applicantName: data.name }),
          ...(section === "cases" && { updatedAt: now }),
        }));
      await q.query(
        "UPDATE profiles SET data=$2, updated_at=CASE WHEN $3 THEN now() ELSE updated_at END WHERE user_id=$1",
        [user.id, JSON.stringify(data), section === "cases"],
      );
      return Object.fromEntries(fields.map((key) => [key, data[key]]));
    });
    res.json({ ok: true, fields: sectionValues });
  }),
);
app.post(
  "/api/me/confirm",
  accountRoute(async (_req, res) => {
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
  }),
);
app.put(
  "/api/me/story",
  accountRoute(async (req, res) => {
    const data = storySchema.parse(req.body);
    const p = await db.query(`SELECT data FROM profiles WHERE user_id=$1`, [
      res.locals.user.id,
    ]);
    if (!p.rows[0])
      return void res
        .status(400)
        .json({ error: "Sign the petition before sharing a story" });
    const existing = await db.query(
      "SELECT data FROM stories WHERE user_id=$1",
      [res.locals.user.id],
    );
    const saved = existing.rows[0]?.data;
    const safePhotos = new Set<string>(
      saved?.photosCleaned === true ? saved.photos : [],
    );
    const photos: string[] = [];
    for (const photo of data.photos) {
      photos.push(safePhotos.has(photo) ? photo : await cleanStoryPhoto(photo));
    }
    const cover =
      saved?.photosCleaned && photos[0] === saved.photos[0] && "cover" in saved
        ? saved.cover
        : await storyCover(photos[0]);
    await db.query(
      `INSERT INTO stories(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,
      [
        res.locals.user.id,
        JSON.stringify({ ...data, photos, cover, photosCleaned: true }),
      ],
    );
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/me/story",
  accountRoute(async (_req, res) => {
    await db.query("DELETE FROM stories WHERE user_id=$1", [
      res.locals.user.id,
    ]);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/me/export",
  accountRoute(async (_req, res) => {
    const userId = res.locals.user.id;
    const { rows } = await db.query(
      `SELECT u.email, u.created_at,
       (SELECT jsonb_build_object('data',p.data,'updated_at',p.updated_at,'signed_at',p.signed_at,'consent_version',p.consent_version) FROM profiles p WHERE p.user_id=u.id) AS profile,
       (SELECT s.data FROM stories s WHERE s.user_id=u.id) AS story,
       (SELECT jsonb_agg(jsonb_build_object('createdAt', created_at, 'expiresAt', expires_at) ORDER BY created_at) FROM sessions WHERE user_id=u.id) AS sessions,
       (SELECT jsonb_agg(jsonb_build_object('period', period, 'status', status, 'claimedAt', claimed_at, 'sentAt', sent_at) ORDER BY period) FROM reminder_deliveries WHERE user_id=u.id) AS reminders
     FROM users u WHERE u.id=$1`,
      [userId],
    );
    if (!rows[0]) return void res.sendStatus(401);
    const record = rows[0];
    res.attachment("reunite-now-data.json").json({
      email: record.email,
      accountCreatedAt: record.created_at,
      storageRegion: dual ? region() : undefined,
      profile: record.profile,
      story: record.story ? storySchema.parse(record.story) : null,
      sessions: record.sessions ?? [],
      reminderDeliveries: record.reminders ?? [],
    });
  }),
);
app.delete(
  "/api/me",
  accountRoute(
    async (req, res) => {
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
    },
    { exclusive: true },
  ),
);
app.put(
  "/api/me/region",
  accountRoute(
    async (req, res) => {
      const destination = z.enum(["eu", "us"]).parse(req.body?.region);
      await moveAccount(res.locals.user.id, destination);
      res.json({ storageRegion: destination });
    },
    { exclusive: true },
  ),
);
// Dedicated read-only fixtures. Never mix these records into production statistics.
let previewCache:
  { day: string; data: ReturnType<typeof createDemoData> } | undefined;
app.get("/api/demo", async (_req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  if (!previewCache || previewCache.day !== day)
    previewCache = { day, data: createDemoData() };
  try {
    const data = await previewCache.data;
    res
      .set("Cache-Control", "public, max-age=300")
      .json({ ...data, sample: true });
  } catch (error) {
    previewCache = undefined;
    throw error;
  }
});
const signedProfile =
  "data->>'signed' = 'true' AND data->>'publicConsent' = 'true'";
app.get("/api/stats/coverage", async (req, res) => {
  const params = new URL(req.originalUrl, appUrl).searchParams;
  const filters = {
    statuses: params.getAll("status"),
    involvement: params.getAll("connection"),
    parties: params.getAll("party"),
  };
  const filtered = params.has("filtered");
  const result = await routed(false, () =>
    acrossRegions(() =>
      db.query<PlaceCount>(
        `SELECT data->>'country' AS country, coalesce(data->>'state','') AS state,
     coalesce(data->>'district','') AS district, count(*)::int AS count FROM profiles
     WHERE ${signedProfile} AND ($1::boolean OR (
       data->>'legalStatus' = ANY($2::text[]) AND
       (CASE WHEN data->>'personallyInvolved'='true' THEN 'Yes' ELSE 'No' END) = ANY($3::text[]) AND
       (CASE WHEN data->>'legalStatus'='US citizen' AND data->>'affiliationConsent'='true'
         THEN coalesce(data->>'politicalAffiliation','') ELSE '' END) = ANY($4::text[])
     )) GROUP BY 1,2,3`,
        [!filtered, filters.statuses, filters.involvement, filters.parties],
      ),
    ),
  );
  const samples = demo
    ? filtered
      ? filterSignatures(demo.profiles, filters)
      : demo.profiles
    : [];
  const places = new Map<string, PlaceCount>();
  for (const { country, state, district, count } of [
    ...result.flatMap((r) => r.rows),
    ...samples.map((p) => ({ ...p, count: 1 })),
  ]) {
    const key = JSON.stringify([country, state, district]);
    const previous = places.get(key);
    if (previous) previous.count += count;
    else places.set(key, { country, state, district, count });
  }
  res.json({ places: [...places.values()] });
});

app.get("/api/stats/visas", async (req, res) => {
  const { post, days, status, category, metric } = z
    .object({
      post: z.string().max(120).default(""),
      days: z.coerce.number().int().nonnegative().default(90),
      status: z.enum(["active", "closed"]).default("active"),
      category: z.string().max(100).default(""),
      metric: z
        .enum([
          "sinceFiling",
          "sinceNvc",
          "total",
          "filingInterview",
          "nvcInterview",
          "nvcClosure",
        ])
        .default("sinceFiling"),
    })
    .parse(req.query);
  const result = await routed(false, () =>
    acrossRegions(() =>
      db.query(
        `SELECT updated_at, (SELECT jsonb_agg(jsonb_build_object(
            'post', c->'post', 'category', c->'category', 'nationality', c->'nationality', 'updatedAt', c->'updatedAt',
            'events', (SELECT jsonb_agg(jsonb_build_object('date', e->'date', 'type', e->'type') ORDER BY position)
                      FROM jsonb_array_elements(c->'events') WITH ORDINALITY AS events(e, position))
          )) FROM jsonb_array_elements(data->'cases') AS c) AS cases
         FROM profiles WHERE ${signedProfile} AND jsonb_array_length(data->'cases') > 0`,
      ),
    ),
  );
  const profiles = result.flatMap((r) =>
    r.rows.map((row) => ({
      cases: row.cases,
      updatedAt: new Date(row.updated_at).toISOString(),
    })),
  );
  res.json(
    visaStatistics(
      [...profiles, ...(demo?.profiles ?? [])],
      { post, days, status, category },
      metric,
    ),
  );
});

const publishedStories = `FROM stories s JOIN profiles p ON p.user_id=s.user_id
  WHERE s.data->>'publish'='true' AND p.data->>'signed'='true' AND p.data->>'publicConsent'='true'`;
app.get("/api/story-cards", async (req, res) => {
  const { after, q } = z
    .object({
      after: z.string().max(80).default(""),
      q: z.string().max(250).default(""),
    })
    .parse(req.query);
  const pageSize = 9;
  const result = await routed(false, () =>
    acrossRegions(() =>
      db.query(
        `SELECT s.user_id AS id, s.data->>'title' AS title, p.data->>'country' AS country, p.data->>'name' AS name,
       CASE WHEN s.data->>'photosCleaned'='true' THEN s.data->>'cover' END AS cover
     ${publishedStories} AND s.user_id::text > $1 AND ($2='' OR strpos(lower(concat_ws(' ', s.data->>'title', s.data->>'body',
       p.data->>'name', p.data->>'country', s.data->>'impacts')), lower($2)) > 0)
     ORDER BY s.user_id LIMIT $3`,
        [after, q, pageSize + 1],
      ),
    ),
  );
  const cards: StoryCard[] = result.flatMap((r) =>
    r.rows.map(({ id, name, title, country, cover }) => ({
      id,
      name,
      title,
      country,
      cover,
    })),
  );
  for (const s of demo?.stories ?? []) {
    if (
      s.id > after &&
      [s.title, s.body, s.name, s.country, ...s.impacts]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase())
    )
      cards.push({
        id: s.id,
        name: s.name,
        title: s.title,
        country: s.country,
        cover: s.photos[0] ?? null,
      });
  }
  cards.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  res.json({
    cards: cards.slice(0, pageSize),
    next: cards.length > pageSize ? cards[pageSize - 1].id : null,
  });
});
app.get("/api/story/:id/photo/:index", async (req, res) => {
  const { id, index } = req.params;
  if (!z.uuid().safeParse(id).success || !/^[0-3]$/.test(index))
    return void res.sendStatus(404);
  const result = await routed(false, () =>
    acrossRegions(() =>
      db.query(
        `SELECT s.data->'photos'->>$2::int AS photo ${publishedStories} AND s.user_id=$1 AND s.data->>'photosCleaned'='true'`,
        [id, Number(index)],
      ),
    ),
  );
  const photo = result.flatMap((r) => r.rows)[0]?.photo;
  if (!photo) return void res.sendStatus(404);
  res
    .type("image/webp")
    .send(Buffer.from(photo.slice(photo.indexOf(",") + 1), "base64"));
});
app.get("/api/story/:id", async (req, res) => {
  const { id } = req.params;
  const fixture = demo?.stories.find((s) => s.id === id);
  if (fixture) return void res.json(fixture);
  if (!z.uuid().safeParse(id).success) return void res.sendStatus(404);
  const result = await routed(false, () =>
    acrossRegions(() =>
      db.query(
        `SELECT s.data->>'title' AS title, s.data->>'body' AS body, s.data->>'support' AS support,
       s.data->'impacts' AS impacts, CASE WHEN s.data->>'photosCleaned'='true' THEN jsonb_array_length(s.data->'photos') ELSE 0 END AS photo_count,
       s.updated_at,p.data->>'name' AS name,p.data->>'country' AS country
     ${publishedStories} AND s.user_id=$1`,
        [id],
      ),
    ),
  );
  const row = result.flatMap((r) => r.rows)[0];
  if (!row) return void res.sendStatus(404);
  const { title, body, support, impacts } = row;
  res.json({
    id,
    title,
    body,
    support,
    impacts,
    photos: Array.from(
      { length: row.photo_count },
      (_, i) => `/api/story/${id}/photo/${i}`,
    ),
    updatedAt: row.updated_at,
    name: row.name,
    country: row.country,
  });
});
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
app.use("/demo", (_req, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});
app.get("/stories", (_req, res, next) => {
  res.set(
    "Link",
    "</api/story-cards?q=&after=>; rel=preload; as=fetch; crossorigin=anonymous",
  );
  next();
});
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
await routed(false, () => acrossRegions(cleanHistoricalStoryPhotos));
async function purgeExpiredAuthentication() {
  await routed(false, () =>
    acrossRegions(async () => {
      await db.query("DELETE FROM login_tokens WHERE expires_at <= now()");
      await db.query("DELETE FROM sessions WHERE expires_at <= now()");
    }),
  );
}
await purgeExpiredAuthentication();
setInterval(
  () => {
    purgeExpiredAuthentication().catch(() =>
      console.error("Expired authentication cleanup failed"),
    );
  },
  60 * 60 * 1000,
).unref();
app.listen(
  Number(process.env.PORT || 3001),
  production ? "0.0.0.0" : "127.0.0.1",
  () =>
    console.log(`Reunite Now API ready on port ${process.env.PORT || 3001}`),
);
