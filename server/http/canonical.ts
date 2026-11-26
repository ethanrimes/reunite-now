import type { RequestHandler } from "express";

// Keep browser sessions and OAuth callbacks on the configured public hostname.
// API writes retain their normal origin checks; Azure health probes stay local.
export function canonicalHost(appUrl: string): RequestHandler {
  const canonical = new URL(appUrl);
  return (req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) ||
      req.path === "/api/health" ||
      req.get("host")?.toLowerCase() === canonical.host.toLowerCase()
    ) {
      next();
      return;
    }
    // Concatenate the path to a trusted origin. Resolving //paths with new URL
    // would allow a request path to replace the destination hostname.
    res.redirect(308, canonical.origin + req.originalUrl);
  };
}
