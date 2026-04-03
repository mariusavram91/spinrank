import de from "./de.json";
import en from "./en.json";

export const languageOptions = {
  en: { label: "English", flag: "🇬🇧" },
  de: { label: "Deutsch", flag: "🇩🇪" },
} as const;

export const translations = {
  en,
  de,
} as const;

export type LanguageCode = keyof typeof languageOptions;
export type TextKey = keyof typeof translations.en;
