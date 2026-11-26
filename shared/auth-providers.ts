export const additionalProviders = ["apple", "yahoo", "microsoft"] as const;
export type Provider = (typeof additionalProviders)[number];
export const providerNames = {
  google: "Google",
  apple: "Apple",
  yahoo: "Yahoo",
  microsoft: "Microsoft",
} as const;
