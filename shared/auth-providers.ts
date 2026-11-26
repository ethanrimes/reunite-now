export const signInProviders = [
  "google",
  "apple",
  "yahoo",
  "microsoft",
] as const;
export type Provider = (typeof signInProviders)[number];
export const providerNames = {
  google: "Google",
  apple: "Apple",
  yahoo: "Yahoo",
  microsoft: "Microsoft",
} as const;

const emailDomains: Record<Provider, readonly string[]> = {
  google: ["gmail.com"],
  apple: [
    "icloud.com",
    "me.com",
    "mac.com",
    "privaterelay.appleid.com",
    "private.icloud.com",
  ],
  yahoo: ["yahoo.com", "ymail.com", "rocketmail.com"],
  microsoft: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
};
export function mailboxProvider(address: string) {
  const domain = address.split("@")[1]?.toLowerCase();
  return signInProviders.find((provider) =>
    emailDomains[provider].includes(domain),
  );
}
