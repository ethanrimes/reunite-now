import messages from "./locales/messages.json";
import arabic from "./locales/ar.json";
import bengali from "./locales/bn.json";
import traditionalChinese from "./locales/zh-Hant.json";
const additionalCatalogs: Record<string, Record<string, string>> = {
  ar: arabic,
  bn: bengali,
  "zh-Hant": traditionalChinese,
};
export type Language = "en" | "es" | "pt" | "tl" | "ar" | "bn" | "zh-Hant";
export const languageNames = {
  en: "English",
  es: "Español",
  pt: "Português",
  tl: "Tagalog",
  ar: "العربية",
  bn: "বাংলা",
  "zh-Hant": "繁體中文",
};
export const localeNames: Record<Language, string> = {
  en: "en-US",
  es: "es",
  pt: "pt-BR",
  tl: "fil-PH",
  ar: "ar",
  bn: "bn",
  "zh-Hant": "zh-Hant",
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
let language: Language = initialLanguage();
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getLocale = () => localeNames[language];
export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setLanguage(value: Language) {
  if (!validLanguage(value)) return;
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
  const entry = (messages as Record<string, Partial<Record<Language, string>>>)[
    normalized
  ];
  const translated =
    lang === "en"
      ? normalized
      : (additionalCatalogs[lang]?.[normalized] ?? entry?.[lang] ?? normalized);
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
    const catalog = messages as Record<
      string,
      Partial<Record<Language, string>>
    >;
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
  const district = text.match(
    /^Found ([A-Z]{2}-\d{2}) in the 119th Congress\. Your search address has been cleared\. Review the result before saving\.$/,
  );
  if (district)
    return translate(
      "Found {district} in the 119th Congress. Your search address has been cleared. Review the result before saving.",
      language,
      { district: district[1] },
    );
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
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey) return;
    language = validLanguage(event.newValue) ? event.newValue : "en";
    updateDocument();
    listeners.forEach((listener) => listener());
  });
