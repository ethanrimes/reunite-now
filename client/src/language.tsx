import { useSyncExternalStore } from "react";
import { Globe2 } from "lucide-react";
import {
  getLanguage,
  setLanguage,
  subscribeLanguage,
  languageNames,
  validLanguage,
  t,
} from "./i18n";
export function useLanguage() {
  return useSyncExternalStore(
    subscribeLanguage,
    getLanguage,
    () => "en" as const,
  );
}
export function LanguageSelector() {
  const language = useLanguage();
  return (
    <label className="language-selector">
      <Globe2 size={16} aria-hidden="true" />
      <span className="sr-only">{t("Language")}</span>
      <select
        value={language}
        onChange={(event) => {
          if (validLanguage(event.target.value))
            setLanguage(event.target.value);
        }}
      >
        {Object.entries(languageNames).map(([code, name]) => (
          <option key={code} value={code} lang={code}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
