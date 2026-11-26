import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { visaStatistics, type PlaceCount } from "../shared/public-views";
import {
  timelineSnapshot,
  metricRows,
  visaTimelines,
  waitMetrics,
} from "../shared/visa-timelines";
import {
  signatoryPage,
  signatoryPageSize,
  type Signatory,
} from "../shared/signatories";
import {
  combineSignatureGroups,
  filterSignatures,
  signatureGroup,
  type SignatureGroup,
} from "../shared/coverage";
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
import { z } from "zod";
import {
  db,
  publicDb,
  type Queryable,
  externalSchema,
  transaction,
  migrate,
  dual,
  region,
  inRegion,
} from "./storage/db";
import {
  acrossRegions,
  homeForEmail,
  locate,
  moveAccount,
  routed,
} from "./storage/regions";
import { regionForIP } from "./storage/geolocation";
import { feedbackMessageLimit, maintainerEmail } from "../shared/feedback";
import {
  newSignInCode,
  tokenFromCode,
  signInMessage,
} from "./email/signin-message";
import {
  emailTrace,
  linkReference,
  traceEmailSignIn,
  validReference,
} from "./email/signin-log";
import { emailReady, sendEmail } from "./email/delivery";
import {
  storyCover,
  cleanStoryPhoto,
  cleanHistoricalStoryPhotos,
} from "./stories/photos";
import { publicStoryRoutes } from "./stories/public-routes";
import { canonicalHost } from "./http/canonical";
import { sendReminders } from "./jobs/reminders";
import { createDemoData, demoEnabled } from "./demo/fixtures";
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
import { signInProviders } from "../shared/auth-providers";
import * as oidc from "./auth/providers";
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
app.post(
  ["/api/auth/email", "/api/auth/verify", "/api/auth/email-link-error"],
  traceEmailSignIn,
);
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
  handler: (req, res, _next, options) => {
    if (res.locals.emailSignIn) {
      const trace = emailTrace(res);
      // A shared network can hit the limiter before either route handler runs.
      if (
        req.path === "/api/auth/email" &&
        typeof req.body?.email === "string" &&
        req.body.email.length <= 254
      ) {
        const email = z.email().safeParse(req.body.email);
        if (email.success) trace.email = email.data.toLowerCase();
      } else if (req.path === "/api/auth/verify") {
        trace.suppliedRef = validReference(req.body?.ref);
        trace.method = req.body?.code === undefined ? "link" : "code";
        const raw =
          trace.method === "link"
            ? req.body?.token
            : typeof req.body.code === "string" && req.body.code.length <= 80
              ? tokenFromCode(req.body.code)
              : undefined;
        if (typeof raw === "string" && raw.length >= 40 && raw.length <= 100)
          trace.linkId = linkReference(raw);
      }
    }
    res.status(options.statusCode).send(options.message);
  },
});
app.use("/api", (req, res, next) => {
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    !req.path.startsWith("/jobs/")
  ) {
    const origin = req.get("origin");
    const appleCallback =
      req.method === "POST" &&
      req.path === "/auth/apple/callback" &&
      origin === "https://appleid.apple.com";
    if (!appleCallback && origin !== new URL(appUrl).origin)
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
type Handler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;
function accountRoute(
  handler: Handler,
  { optional = false, exclusive = false } = {},
): Handler {
  return async (req, res, next) => {
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
          const result = await db.query<{
            id: string;
            email: string | null;
            microsoft_email: string | null;
          }>(
            `SELECT u.id,u.email,u.microsoft_email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
            [tokenHash],
          );
          return result.rows.map((user) => ({ user, storage: region() }));
        })
      ).flat();
      if (matches.length > 1) throw new Error("Conflicting regional identity");
      const match = matches[0];
      if (!match) return noSession();
      res.locals.user = match.user;
      return inRegion(match.storage, () => handler(req, res, next));
    });
  };
}
const linkedUserSql =
  "SELECT u.id,u.email FROM oauth_identities i JOIN users u ON u.id=i.user_id WHERE i.identity_key=$1";
async function linkedAccount(identity: string) {
  const home = await locate(linkedUserSql, [identity]);
  if (!home) return;
  const user = await inRegion(
    home,
    async () =>
      (
        await db.query<{ id: string; email: string | null }>(linkedUserSql, [
          identity,
        ])
      ).rows[0],
  );
  return user && { ...user, home };
}
type LinkedAccount = Awaited<ReturnType<typeof linkedAccount>>;
const emailConflict = () =>
  Object.assign(
    new Error(
      "This email is already connected to another petition profile. Your existing profiles are separate.",
    ),
    { status: 409 },
  );
async function createSession(
  email: string,
  connection: Queryable,
  identity?: string,
  linked?: LinkedAccount,
) {
  if (linked) {
    // Preserve signatures, cases and the original storage region of older Microsoft accounts.
    const updated = await connection.query(
      "UPDATE users SET email=$1 WHERE id=$2 AND (email IS NULL OR email=$1) AND NOT EXISTS (SELECT 1 FROM users WHERE email=$1 AND id<>$2) RETURNING id",
      [email, linked.id],
    );
    if (!updated.rows.length) throw emailConflict();
    return issueSession(linked.id, connection);
  }
  const u = await connection.query(
    "INSERT INTO users(id,email) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id",
    [randomUUID(), email],
  );
  if (identity) {
    await connection.query(
      "INSERT INTO oauth_identities(identity_key,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [identity, u.rows[0].id],
    );
    if (
      !(
        await connection.query(
          "SELECT 1 FROM oauth_identities WHERE identity_key=$1 AND user_id=$2",
          [identity, u.rows[0].id],
        )
      ).rows.length
    )
      throw Error("Identity already linked");
  }
  return issueSession(u.rows[0].id, connection);
}
async function issueSession(userId: string, connection: Queryable) {
  const raw = token();
  await connection.query(
    `INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')`,
    [hash(raw), userId],
  );
  return raw;
}
async function signInAtHome(
  email: string,
  fallback: "eu" | "us",
  sourceTransaction?: Queryable,
  identity?: string,
  linked?: LinkedAccount,
) {
  const home = await homeForEmail(email, linked?.home ?? fallback);
  if (linked && home !== linked.home) throw emailConflict();
  if (dual) {
    // Before first verification multiple devices may request links in different regions.
    // Revoke any pre-registration links held outside the verified account's home.
    const other = home === "eu" ? "us" : "eu";
    const connection =
      other === fallback && sourceTransaction ? sourceTransaction : db;
    await inRegion(other, () =>
      connection.query(
        "DELETE FROM login_tokens WHERE sha256(convert_to(email,'UTF8'))=decode($1,'hex')",
        [hash(email)],
      ),
    );
  }
  if (home === fallback && sourceTransaction)
    return createSession(email, sourceTransaction, identity, linked);
  return inRegion(home, () =>
    transaction((connection) =>
      createSession(email, connection, identity, linked),
    ),
  );
}
app.get("/api/health", async (_req, res) => {
  await acrossRegions(() => db.query("SELECT 1"));
  res.json({ ok: true, service: "reunite-now", version: "0.1.0" });
});
app.get("/api/config", (_req, res) =>
  res.json({
    emailAuth: emailReady(),
    oauthProviders: signInProviders.filter(
      (p) => p !== "google" && oidc.config(p, appUrl),
    ),
    googleAuth: !!(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    devAuth,
    demoData: !!demo,
    reminders: emailReady(),
    consentVersion,
  }),
);
const feedbackSchema = z.strictObject({
  message: z.string().trim().min(1).max(feedbackMessageLimit),
});
app.post(
  "/api/feedback",
  rateLimit({
    windowMs: 15 * 60000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many messages. Please try again in 15 minutes." },
  }),
  accountRoute(async (_req, _res, next) => next()),
  async (req, res) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: "Enter a message of up to 4,000 characters.",
      });
    const { message } = parsed.data;
    const email = res.locals.user.email;
    try {
      await sendEmail(
        maintainerEmail,
        "Reunite Now project feedback",
        `Submitted through the project feedback form.\nSigned-in account: ${email ?? "Microsoft account (no reply email)"}\n\n${message}`,
        randomUUID(),
        email ?? undefined,
      );
    } catch {
      return res.status(503).json({
        error:
          "We couldn’t confirm your message was sent. Try again or email the maintainer directly.",
      });
    }
    res.json({ sent: true });
  },
);
app.post("/api/auth/email", authLimit, async (req, res) => {
  const { email, intent, connectProvider } = z
    .object({
      intent: z.literal("feedback").optional(),
      connectProvider: z.enum(signInProviders).optional(),
      email: z
        .email()
        .max(254)
        .transform((v) => v.trim().toLowerCase()),
    })
    .parse(req.body);
  const trace = emailTrace(res);
  trace.email = email;
  trace.feedback = intent === "feedback";
  if (!emailReady() && !devAuth) {
    trace.reason = "email_unavailable";
    trace.message =
      "Email sign-in opens once the project’s email service is connected.";
    return void res.status(503).json({
      error:
        "Email sign-in opens once the project’s email service is connected.",
    });
  }
  const code = newSignInCode();
  const raw = tokenFromCode(code)!;
  trace.linkId = linkReference(raw);
  let tokenHash = hash(raw);
  if (connectProvider) {
    const cfg = oidc.config(connectProvider, appUrl);
    if (!cfg)
      return void res
        .status(400)
        .json({ error: "Sign-in could not be completed." });
    const pending = await oidc
      .readTicket(cfg, connectProvider, "link", req.cookies.rn_oidc_link)
      .catch(() => null);
    if (typeof pending?.identity !== "string")
      return void res
        .status(400)
        .json({ error: "Sign-in could not be completed." });
    tokenHash = hash(raw + ":" + pending.identity);
    res.cookie(
      "rn_oidc_proof",
      connectProvider +
        "." +
        (await oidc.ticket(cfg, connectProvider, "proof", {
          identity: pending.identity,
          hash: hash(raw),
        })),
      { ...cookieOptions, maxAge: 900000 },
    );
  }
  trace.stage = "store_link";
  await routed(false, async () =>
    inRegion(await homeForEmail(email, detectedRegion(req)), () => {
      trace.region = region();
      return db.query(
        `INSERT INTO login_tokens(token_hash,email,expires_at) VALUES($1,$2,now()+interval '15 minutes')`,
        [tokenHash, email],
      );
    }),
  );
  const query = new URLSearchParams({ ref: trace.linkId });
  if (trace.feedback) query.set("intent", "feedback");
  const url = `${appUrl}/auth/verify?${query}#token=${raw}`;
  trace.stage = emailReady() ? "send_email" : "local_link";
  if (emailReady()) {
    const body = signInMessage(
      url,
      `${appUrl}/auth/verify?method=code${trace.feedback ? "&intent=feedback" : ""}`,
      code,
    );
    const delivery = await sendEmail(
      email,
      "Your Reunite Now sign-in link",
      body.text,
      `signin/${hash(raw)}`,
      undefined,
      body.html,
    );
    if (/^[0-9a-f-]{36}$/i.test(delivery.id)) trace.deliveryId = delivery.id;
    trace.stage = "email_accepted";
  }
  res.json({
    ok: true,
    ...(devAuth && !emailReady() ? { devLink: url, devCode: code } : {}),
  });
});
app.post("/api/auth/verify", authLimit, async (req, res) => {
  const trace = emailTrace(res);
  trace.suppliedRef = validReference(req.body?.ref);
  const usingCode = req.body?.code !== undefined;
  trace.method = usingCode ? "code" : "link";
  let raw: string;
  if (usingCode) {
    const candidate =
      typeof req.body.code === "string" && req.body.code.length <= 80
        ? tokenFromCode(req.body.code)
        : null;
    if (!candidate) {
      trace.reason = "invalid_code";
      trace.message = "Check the sign-in code and try again.";
      return res.status(400).json({ error: trace.message });
    }
    raw = candidate;
  } else {
    raw = z
      .object({ token: z.string().min(40).max(100) })
      .parse(req.body).token;
  }
  trace.linkId = linkReference(raw);
  trace.stage = "find_link";
  let identity: string | undefined;
  const proof = req.cookies.rn_oidc_proof;
  if (typeof proof === "string") {
    const cut = proof.indexOf(".");
    const provider = signInProviders.find((p) => p === proof.slice(0, cut));
    const cfg = provider && oidc.config(provider, appUrl);
    if (provider && cfg) {
      const pending = await oidc
        .readTicket(cfg, provider, "proof", proof.slice(cut + 1))
        .catch(() => null);
      if (pending?.hash === hash(raw) && typeof pending.identity === "string")
        identity = pending.identity;
    }
  }
  const verified = await routed(true, async () => {
    const linked = identity ? await linkedAccount(identity) : undefined;
    // A linking code must be redeemed in the browser that authenticated the provider.
    const tokenLookup = "SELECT 1 FROM login_tokens WHERE token_hash=$1";
    let tokenHash = hash(identity ? raw + ":" + identity : raw);
    let source = await locate(tokenLookup, [tokenHash]);
    if (!source && identity) {
      // Honor still-valid codes issued before linking codes were bound to the identity.
      tokenHash = hash(raw);
      source = await locate(tokenLookup, [tokenHash]);
    }
    if (!source) {
      trace.reason = "unknown_or_consumed";
      return false;
    }
    const sourceRegion = source;
    trace.region = sourceRegion;
    trace.stage = "redeem_link";
    return inRegion(sourceRegion, () =>
      transaction(async (connection) => {
        const result = await connection.query(
          "DELETE FROM login_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING email",
          [tokenHash],
        );
        const email = result.rows[0]?.email;
        if (!email) {
          trace.reason = "expired_or_removed";
          return false;
        }
        trace.email = email;
        trace.stage = "create_session";
        return signInAtHome(email, sourceRegion, connection, identity, linked);
      }),
    );
  });
  if (!verified) {
    trace.message = usingCode
      ? "This code is incorrect, expired, or already used. Request a new email."
      : "This link has expired or already been used. Request a new link.";
    return void res.status(400).json({ error: trace.message });
  }
  res.cookie("rn_session", verified, {
    ...cookieOptions,
    maxAge: 30 * 86400000,
  });
  if (proof) res.clearCookie("rn_oidc_proof", cookieOptions);
  if (req.cookies.rn_oidc_link) res.clearCookie("rn_oidc_link", cookieOptions);
  trace.stage = "session_created";
  res.json({ ok: true });
});
app.post(
  "/api/auth/email-link-error",
  rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  (req, res) => {
    const parsed = z
      .object({
        reason: z.enum(["missing_token", "verification_unreachable"]),
        ref: z.unknown().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.sendStatus(400);
    const trace = emailTrace(res);
    trace.stage = "browser_report";
    trace.suppliedRef = validReference(parsed.data.ref);
    trace.reason = parsed.data.reason;
    trace.message =
      trace.reason === "missing_token"
        ? "The sign-in link is missing its token. Request a new link."
        : "Browser could not reach the verification service.";
    res.sendStatus(204);
  },
);
async function microsoftGmailLink(cookie: unknown) {
  const cfg = oidc.config("microsoft", appUrl);
  if (!cfg || typeof cookie !== "string") return;
  const pending = await oidc
    .readTicket(cfg, "microsoft", "link", cookie)
    .catch(() => null);
  if (
    typeof pending?.identity !== "string" ||
    typeof pending.address !== "string" ||
    !pending.address.endsWith("@gmail.com")
  )
    return;
  return {
    identity: pending.identity,
    address: pending.address,
    digest: hash(cookie),
  };
}
for (const provider of signInProviders) {
  const start = "/api/auth/" + provider;
  const flowCookie = "rn_flow_" + provider;
  const options = {
    ...cookieOptions,
    secure: appUrl.startsWith("https://"),
    sameSite: provider === "apple" ? ("none" as const) : ("lax" as const),
    path: start + "/callback",
  };
  app.get(start, authLimit, async (req, res) => {
    const cfg = oidc.config(provider, appUrl);
    if (!cfg) return res.redirect("/login?error=oauth");
    const connectingMicrosoft =
      provider === "google" && req.query.connect === "microsoft";
    const pending = connectingMicrosoft
      ? await microsoftGmailLink(req.cookies.rn_oidc_link)
      : undefined;
    if (connectingMicrosoft && !pending)
      return res.redirect("/login?error=oauth");
    const flow = await oidc.begin(
      provider,
      cfg,
      req.query.intent === "feedback",
      pending,
    );
    res.cookie(flowCookie, flow.cookie, { ...options, maxAge: 600000 });
    res.redirect(flow.url);
  });
  app.get(start + "/pending-email", async (req, res) => {
    const cfg = oidc.config(provider, appUrl);
    const pending =
      cfg &&
      (await oidc
        .readTicket(cfg, provider, "link", req.cookies.rn_oidc_link)
        .catch(() => null));
    res.json({
      email: typeof pending?.address === "string" ? pending.address : "",
    });
  });
  const callback: Handler = async (req, res) => {
    res.clearCookie(flowCookie, options);
    const cfg = oidc.config(provider, appUrl);
    try {
      if (!cfg) throw Error("Unavailable provider");
      const info = await oidc.finish(
        provider,
        cfg,
        req.cookies[flowCookie],
        req.method === "POST" ? req.body : req.query,
      );
      const pending =
        info.microsoftLink &&
        (await microsoftGmailLink(req.cookies.rn_oidc_link));
      if (
        info.microsoftLink &&
        (provider !== "google" ||
          !pending ||
          pending.digest !== info.microsoftLink ||
          !info.authoritative ||
          info.address !== pending.address)
      ) {
        return res.redirect(
          303,
          "/login?connect=microsoft&error=oauth" +
            (info.destination === "/feedback" ? "&intent=feedback" : ""),
        );
      }
      const result = await routed(true, async () => {
        const linked = await linkedAccount(info.identity);
        if (pending) {
          // Both callbacks must belong to the same browser and agree on the Gmail address.
          if (linked && linked.email !== pending.address) throw emailConflict();
          const microsoftAccount = await linkedAccount(pending.identity);
          const session = await signInAtHome(
            pending.address,
            detectedRegion(req),
            undefined,
            pending.identity,
            microsoftAccount,
          );
          return { session, needsEmail: false };
        }
        if (linked) {
          if (!linked.email && info.authoritative && provider === "microsoft") {
            try {
              const session = await signInAtHome(
                info.address,
                linked.home,
                undefined,
                info.identity,
                linked,
              );
              return { session, needsEmail: false };
            } catch (err) {
              if (!(
                err instanceof Error &&
                "status" in err &&
                err.status === 409
              ))
                throw err;
            }
          }
          const session = await inRegion(linked.home, () =>
            transaction((q) => issueSession(linked.id, q)),
          );
          return { session, needsEmail: !linked.email };
        }
        if (info.authoritative) {
          const session = await signInAtHome(
            info.address,
            detectedRegion(req),
            undefined,
            info.identity,
          );
          return { session, needsEmail: false };
        }
        return { session: undefined, needsEmail: true };
      });
      if (result.session) {
        res.cookie("rn_session", result.session, {
          ...cookieOptions,
          maxAge: 30 * 86400000,
        });
      }
      res.clearCookie("rn_oidc_proof", cookieOptions);
      if (result.needsEmail) {
        res.cookie(
          "rn_oidc_link",
          await oidc.ticket(cfg, provider, "link", {
            identity: info.identity,
            address: info.address,
          }),
          { ...cookieOptions, maxAge: 900000 },
        );
        return res.redirect(
          303,
          "/login?connect=" +
            provider +
            (provider === "microsoft" &&
            info.address.endsWith("@gmail.com") &&
            oidc.config("google", appUrl)
              ? "&method=google"
              : "") +
            (info.destination === "/feedback" ? "&intent=feedback" : ""),
        );
      }
      res.clearCookie("rn_oidc_link", cookieOptions);
      res.redirect(303, info.destination);
    } catch {
      res.redirect(303, "/login?error=oauth");
    }
  };
  if (provider === "apple")
    app.post(
      start + "/callback",
      authLimit,
      express.urlencoded({ extended: false, limit: "8kb" }),
      callback,
    );
  else app.get(start + "/callback", authLimit, callback);
}
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
      if (req.query.view === "session" || req.query.view === "feedback")
        return void res.json({
          user:
            req.query.view === "feedback"
              ? { id: u.id, email: u.email }
              : { id: u.id },
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
          ...(u.microsoft_email && { microsoftEmail: u.microsoft_email }),
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
      (email) => email !== res.locals.user.email?.trim().toLowerCase(),
    );
    await validateDistrict(data);
    const now = new Date().toISOString();
    data.cases = data.cases.map((c) => ({ ...c, updatedAt: now }));
    const profileValues = [res.locals.user.id, JSON.stringify(data)];
    if (data.listSignature === true) {
      await db.query(
        `INSERT INTO profiles(user_id,data,consent_version) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,
        [...profileValues, consentVersion],
      );
    } else {
      // Older clients can update a signature without resending its publication choice.
      const updated = await db.query(
        `UPDATE profiles SET data=jsonb_strip_nulls(jsonb_build_object('listSignature',data->'listSignature')) || $2::jsonb,
         updated_at=now() WHERE user_id=$1`,
        profileValues,
      );
      if (!updated.rowCount)
        return void res.status(400).json({
          error: "To sign, consent to publishing your name and signing time.",
        });
    }
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
          (email) => email !== user.email?.toLowerCase(),
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
      `SELECT u.email, u.microsoft_email, u.created_at,
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
      ...(record.microsoft_email && { microsoftEmail: record.microsoft_email }),
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
app.get("/api/signatories", async (req, res) => {
  const { before } = z
    .object({ before: z.string().datetime({ precision: 6 }).optional() })
    .parse(req.query);
  const results = await routed(false, () =>
    acrossRegions(() =>
      publicDb.query<{
        signatories: Signatory[];
        total: number;
        listed: number;
      }>(
        `SELECT (SELECT coalesce(sum(count),0)::int FROM public.rn_signature_groups) AS total,
                (SELECT count(*)::int FROM public.rn_signatories) AS listed,
                ARRAY(SELECT row_to_json(entry) FROM (
                  SELECT name, to_char(signed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "signedAt"
                  FROM public.rn_signatories
                  WHERE ($1::timestamptz IS NULL OR signed_at < $1)
                  ORDER BY signed_at DESC FETCH FIRST $2 ROWS WITH TIES
                ) entry) AS signatories`,
        [before ?? null, signatoryPageSize + 1],
      ),
    ),
  );
  const regions = results.flatMap((result) => result.rows);
  const samples = demo?.profiles ?? [];
  const listedSamples = samples.filter((p) => p.listSignature);
  const total = regions.reduce((count, r) => count + r.total, samples.length);
  const listed = regions.reduce(
    (count, r) => count + r.listed,
    listedSamples.length,
  );
  res.set("Cache-Control", "no-store").json({
    ...signatoryPage(
      [...regions.flatMap((r) => r.signatories), ...listedSamples],
      before,
    ),
    total,
    anonymousCount: total - listed,
  });
});
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
      publicDb.query<PlaceCount>(
        `SELECT country,state,district,sum(count)::int AS count FROM public.rn_signature_groups
         WHERE $1::boolean OR (status=ANY($2::text[]) AND connection=ANY($3::text[]) AND party=ANY($4::text[]))
         GROUP BY 1,2,3`,
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

app.get("/api/stats/coverage/groups", async (_req, res) => {
  const regions = await routed(false, () =>
    acrossRegions(() =>
      publicDb.query<SignatureGroup>(
        "SELECT country,state,district,status,connection,party,count FROM public.rn_signature_groups",
      ),
    ),
  );
  res.json(
    combineSignatureGroups([
      ...regions.flatMap((r) => r.rows),
      ...(demo?.profiles.map(signatureGroup) ?? []),
    ]),
  );
});

async function timelineProfiles() {
  const result = await routed(false, () =>
    acrossRegions(() =>
      publicDb.query(`SELECT updated_at,cases FROM public.rn_visa_samples`),
    ),
  );
  const profiles = result.flatMap((r) =>
    r.rows.map((row) => ({
      cases: row.cases,
      updatedAt: new Date(row.updated_at).toISOString(),
    })),
  );
  return [...profiles, ...(demo?.profiles ?? [])];
}
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
  res.json(
    visaStatistics(
      await timelineProfiles(),
      { post, days, status, category },
      metric,
    ),
  );
});
app.get("/api/stats/visas/rows", async (req, res) => {
  const { days, metric } = z
    .object({
      days: z.coerce.number().int().nonnegative().default(90),
      metric: z.enum(waitMetrics).default("nvc"),
    })
    .parse(req.query);
  res.json(visaTimelines(await timelineProfiles(), metric, days));
});
app.get("/api/stats/visas/snapshot", async (req, res) => {
  const snapshot = timelineSnapshot(await timelineProfiles());
  if (req.query.view === "cases") return void res.json(snapshot);
  const { cases, ...summary } = snapshot;
  res.json({
    ...summary,
    metrics: Object.fromEntries(
      waitMetrics.map((metric) => [metric, metricRows(snapshot, metric)]),
    ),
  });
});
app.use("/api", publicStoryRoutes(demo?.stories ?? []));
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
  if (err instanceof z.ZodError) {
    const message = err.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    if (res.locals.emailSignIn) {
      // Only our fixed email/token schemas produce these validation messages.
      emailTrace(res).reason = "validation_failed";
      emailTrace(res).message = message;
    }
    return void res.status(400).json({ error: message });
  }
  if (res.locals.emailSignIn) {
    // Provider messages/stacks can contain addresses, SQL or request URLs.
    const code = err.code || err.name;
    if (
      typeof code === "string" &&
      /^[A-Za-z][A-Za-z0-9_.]{0,35}$|^[0-9A-Z]{5}$/.test(code)
    )
      emailTrace(res).serviceCode = code;
  }
  console.error("Request failed", err.code || err.name || "Error");
  res.status(err.status || 500).json({
    error: err.status ? err.message : "Something went wrong. Please try again.",
  });
});
if (externalSchema) {
  await acrossRegions(async () => {
    // Check inherited grants too. A mistakenly configured admin login must
    // fail startup even if its URL has the expected host and database.
    const runtime =
      await db.query(`SELECT has_schema_privilege('public','CREATE')
      OR has_database_privilege(current_database(),'CREATE')
      OR has_table_privilege('public.users','TRUNCATE') AS oversized`);
    if (runtime.rows[0].oversized)
      throw new Error("Runtime login has administrative privileges");
    const reader =
      await publicDb.query(`SELECT has_schema_privilege('public','CREATE')
      OR EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND
        (has_any_column_privilege(c.oid,'SELECT,INSERT,UPDATE') OR has_table_privilege(c.oid,'DELETE,TRUNCATE')))
      AS oversized`);
    if (reader.rows[0].oversized)
      throw new Error("Reader login has private table or schema privileges");
    await publicDb.query(
      "SELECT country FROM public.rn_signature_groups LIMIT 0",
    );
    await publicDb.query(
      "SELECT name,signed_at FROM public.rn_signatories LIMIT 0",
    );
    await publicDb.query("SELECT cases FROM public.rn_visa_samples LIMIT 0");
    await publicDb.query("SELECT id FROM public.rn_published_stories LIMIT 0");
  });
} else {
  await migrate();
  await routed(false, () => acrossRegions(cleanHistoricalStoryPhotos));
}
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
export const server = app.listen(
  Number(process.env.PORT || 3001),
  production ? "0.0.0.0" : "127.0.0.1",
  () =>
    console.log(`Reunite Now API ready on port ${process.env.PORT || 3001}`),
);
