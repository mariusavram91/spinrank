import de from "./de.json";
import en from "./en.json";
import es from "./es.json";

export const languageOptions = {
  en: { label: "English", flag: "🇬🇧" },
  de: { label: "Deutsch", flag: "🇩🇪" },
  es: { label: "Español", flag: "🇪🇸" },
} as const;

export const translations = {
  en,
  de,
  es,
} as const;

export type LanguageCode = keyof typeof languageOptions;
export type TextKey = keyof typeof translations.en;
