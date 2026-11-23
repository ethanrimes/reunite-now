export type Language = "en" | "es" | "pt" | "tl" | "ar" | "bn" | "zh-Hant" | "vi";
export const languageNames = {
  en: "English",
  es: "Español",
  pt: "Português",
  tl: "Tagalog",
  ar: "العربية",
  bn: "বাংলা",
  "zh-Hant": "繁體中文",
  vi: "Tiếng Việt",
};
export const localeNames: Record<Language, string> = {
  en: "en-US",
  es: "es",
  pt: "pt-BR",
  tl: "fil-PH",
  ar: "ar",
  bn: "bn",
  "zh-Hant": "zh-Hant",
  vi: "vi",
};
export const languageDirection = (value: Language) =>
  value === "ar" ? "rtl" : "ltr";
export const storageKey = "reunite-now-language";
export function validLanguage(value: unknown): value is Language {
  return typeof value === "string" && Object.hasOwn(languageNames, value);
}
function initialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(storageKey);
    return validLanguage(stored) ? stored : "en";
  } catch {
    return "en";
  }
}
type Catalog = Record<string, string>;
const catalogs: Partial<Record<Language, Catalog>> = {};
async function loadCatalog(value: Language) {
  if (value === "en" || catalogs[value]) return;
  if (value === "ar") catalogs.ar = (await import("./locales/ar.json")).default;
  else if (value === "bn")
    catalogs.bn = (await import("./locales/bn.json")).default;
  else if (value === "vi")
    catalogs.vi = (await import("./locales/vi.json")).default;
  else if (value === "zh-Hant")
    catalogs[value] = (await import("./locales/zh-Hant.json")).default;
  else {
    const messages = (await import("./locales/messages.json")).default;
    catalogs[value] = Object.fromEntries(
      Object.entries(messages).map(([key, entry]) => [key, entry[value]]),
    );
  }
}
let language: Language = "en";
let requested = 0;
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getLocale = () => localeNames[language];
export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function setLanguage(value: Language) {
  if (!validLanguage(value)) return;
  const sequence = ++requested;
  await loadCatalog(value);
  if (sequence !== requested) return;
  language = value;
  try {
    if (typeof window !== "undefined")
      window.localStorage.setItem(storageKey, value);
  } catch {
    /* Selection still works when storage is unavailable. */
  }
  updateDocument();
  listeners.forEach((listener) => listener());
}
export function translate(
  text: string,
  lang: Language,
  values: Record<string, string | number> = {},
) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const catalog = catalogs[lang];
  const translated =
    catalog && Object.hasOwn(catalog, normalized)
      ? catalog[normalized]
      : normalized;
  const result = translated.replace(/\{(\w+)\}/g, (match, key) =>
    values[key] === undefined ? match : String(values[key]),
  );
  return (
    (text.match(/^\s+/)?.[0] || "") + result + (text.match(/\s+$/)?.[0] || "")
  );
}
export function t(text: string, values?: Record<string, string | number>) {
  // API validation errors include internal field paths. Show readable guidance
  // and translated domain rules, without translating or changing submitted data.
  if (language !== "en" && /^\w+(?:\.\w+)*: /.test(text)) {
    const catalog = catalogs[language] ?? {};
    const details = text
      .split("; ")
      .map((part) => part.replace(/^.*?: /, ""))
      .filter((message) => message in catalog)
      .map((message) => translate(message, language));
    return [
      translate(
        "Please review the form fields and required consents.",
        language,
      ),
      ...new Set(details),
    ].join(" ");
  }
  return translate(text, language, values);
}
export const number = (value: number) => value.toLocaleString(getLocale());
function updateDocument() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = localeNames[language];
  document.documentElement.dir = languageDirection(language);
  document.title = `Reunite Now — ${t("Visa processing needs to change.")}`;
}
updateDocument();
if (typeof window !== "undefined") {
  const restore = (value: Language) => {
    void setLanguage(value).catch(() => {});
  };
  restore(initialLanguage());
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey)
      restore(validLanguage(event.newValue) ? event.newValue : "en");
  });
}
