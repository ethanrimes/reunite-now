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
