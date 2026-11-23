import { createHash, randomBytes } from "node:crypto";
import { maintainerEmail } from "../shared/feedback";

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const newSignInCode = () =>
  Array.from(randomBytes(20), (byte) => alphabet[byte % 32]).join("");

export function tokenFromCode(code: string) {
  const normalized = code
    .replace(/[\s-]/g, "")
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (!/^[0-9A-HJKMNP-TV-Z]{20}$/.test(normalized)) return null;
  return createHash("sha256")
    .update("email-signin-v1:" + normalized)
    .digest("base64url");
}

export function signInMessage(url: string, manualUrl: string, code: string) {
  const grouped = code.match(/.{4}/g)!.join("-");
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const timing =
    "The link and code expire in 15 minutes. Use either one to sign in once.";
  const fallback =
    "If the link doesn’t open or says its token is missing, enter this code on the sign-in page:";
  const help = `If the supplied link is missing #token= and you still need help, contact ${maintainerEmail}. Keep the link and code private.`;
  const ignore = "If you did not request this email, you can ignore it.";
  return {
    text: [
      "Sign in to Reunite Now:",
      url,
      timing,
      fallback,
      grouped,
      manualUrl,
      "You can also copy the full sign-in URL, including #token= and everything after it, into your browser.",
      help,
      ignore,
    ].join("\n\n"),
    html: `<p><a href="${escape(url)}">Sign in to Reunite Now</a></p><p>${timing}</p><p>${fallback}</p><p><strong>${grouped}</strong></p><p><a href="${escape(manualUrl)}">Enter the code</a> or open the Reunite Now sign-in page in your browser.</p><p>You can also copy the full URL into your browser:</p><p>${escape(url)}</p><p>${help}</p><p>${ignore}</p>`,
  };
}
