import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import type { Request, Response, NextFunction } from "express";

// Private App Service storage, outside both the web root and general application logs.
const directory =
  process.env.NODE_ENV === "production" && process.env.WEBSITE_SITE_NAME
    ? "/home/data/email-signin"
    : path.resolve(".local/email-signin");
const dayMs = 86400000;
const serverId = randomUUID();
let pending = 0;
let lastWarning = 0;
function warn() {
  if (Date.now() - lastWarning < 60_000) return;
  lastWarning = Date.now();
  console.error("Private email sign-in diagnostics unavailable");
}
async function expireFiles() {
  const oldest = new Date(Date.now() - 6 * dayMs).toISOString().slice(0, 10);
  try {
    for (const name of await readdir(directory)) {
      if (
        /^\d{4}-\d{2}-\d{2}-[a-f0-9-]{36}\.jsonl$/.test(name) &&
        name.slice(0, 10) < oldest
      )
        await unlink(path.join(directory, name)).catch((e) => {
          if (e.code !== "ENOENT") throw e;
        });
    }
  } catch (e: any) {
    if (e.code !== "ENOENT") warn();
  }
}
void expireFiles();
setInterval(() => void expireFiles(), 3600_000).unref();

export function linkReference(raw: string) {
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}
export function validReference(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-f0-9]{24}$/.test(value)
    ? value
    : undefined;
}
export type EmailTrace = {
  stage: string;
  email?: string;
  linkId?: string;
  suppliedRef?: string;
  feedback?: boolean;
  method?: "code" | "link";
  region?: string;
  reason?: string;
  message?: string;
  serviceCode?: string;
  deliveryId?: string;
};
export function emailTrace(res: Response): EmailTrace {
  return res.locals.emailSignIn;
}
export function traceEmailSignIn(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const operation = req.path.endsWith("/email")
    ? "issue"
    : req.path.endsWith("/verify")
      ? "verify"
      : "browser";
  const trace: EmailTrace = { stage: "request" };
  res.locals.emailSignIn = trace;
  res.once("close", () => {
    const status = res.statusCode;
    if (operation === "browser" && trace.stage !== "browser_report") return;
    const failed = !res.writableFinished || status >= 400 || !!trace.reason;
    const known = !res.writableFinished
      ? ["connection_closed", "Connection closed before the response finished."]
      : status === 429
        ? ["rate_limited", "Too many attempts. Please try again in 15 minutes."]
        : status === 403
          ? ["origin_rejected", "Request origin not allowed"]
          : status === 413
            ? ["request_too_large", "Request body is too large."]
            : status === 400
              ? ["invalid_request", "Invalid email sign-in request."]
              : ["internal_error", "Something went wrong. Please try again."];
    const timestamp = new Date().toISOString();
    // Construct only from validated fields. Never serialize a request, exception, cookie or URL.
    const record = {
      timestamp,
      operation,
      method: trace.method,
      stage: trace.stage,
      status,
      outcome: failed ? "failure" : "success",
      email: trace.email,
      linkId: trace.linkId,
      suppliedRef: trace.suppliedRef,
      linkPath: trace.linkId || trace.suppliedRef ? "/auth/verify" : undefined,
      intent:
        trace.feedback === undefined
          ? undefined
          : trace.feedback
            ? "feedback"
            : "account",
      region: trace.region,
      reason: failed ? trace.reason || known[0] : undefined,
      message: failed ? trace.message || known[1] : undefined,
      serviceCode: trace.serviceCode,
      deliveryId: trace.deliveryId,
    };
    if (pending >= 256) return warn();
    pending++;
    const file = path.join(
      directory,
      timestamp.slice(0, 10) + "-" + serverId + ".jsonl",
    );
    void mkdir(directory, { recursive: true, mode: 0o700 })
      .then(() =>
        appendFile(file, JSON.stringify(record) + "\n", { mode: 0o600 }),
      )
      .catch(warn)
      .finally(() => pending--);
  });
  next();
}
