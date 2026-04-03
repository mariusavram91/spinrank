import { languageOptions, translations, type LanguageCode, type TextKey } from "./translations";

const translationObservers: Array<() => void> = [];
const languageChangeHandlers: Array<() => void> = [];
const LANGUAGE_STORAGE_KEY = "spinrank.language";
const defaultLanguage: LanguageCode = "en";

const loadStoredLanguage = (): LanguageCode => {
  if (typeof window === "undefined") {
    return defaultLanguage;
  }
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && stored in languageOptions) {
      return stored as LanguageCode;
    }
  } catch {
    // ignore
  }
  return defaultLanguage;
};

let currentLanguage: LanguageCode = loadStoredLanguage();

export const getCurrentLanguage = (): LanguageCode => currentLanguage;

export const t = (key: TextKey): string =>
  translations[currentLanguage][key] ?? translations[defaultLanguage][key];

export const registerTranslation = (updater: () => void): void => {
  translationObservers.push(updater);
  updater();
};

const applyTranslations = (): void => {
  translationObservers.forEach((updater) => updater());
};

export const onLanguageChange = (handler: () => void): void => {
  languageChangeHandlers.push(handler);
};

export const setLanguage = (language: LanguageCode): void => {
  if (language === currentLanguage) {
    return;
  }
  currentLanguage = language;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  } catch {
    // ignore
  }
  applyTranslations();
  languageChangeHandlers.forEach((handler) => handler());
};

export const bindLocalizedText = (element: HTMLElement, key: TextKey): void => {
  registerTranslation(() => {
    element.textContent = t(key);
  });
};

export const bindLocalizedAttribute = (element: HTMLElement, attribute: string, key: TextKey): void => {
  registerTranslation(() => {
    element.setAttribute(attribute, t(key));
  });
};
