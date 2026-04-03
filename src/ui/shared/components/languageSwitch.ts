import {
  bindLocalizedAttribute,
  getCurrentLanguage,
  onLanguageChange,
  setLanguage,
} from "../i18n/runtime";
import { languageOptions, type LanguageCode } from "../i18n/translations";

export interface LanguageSwitchElements {
  element: HTMLDivElement;
  closeIfOutside: (target: EventTarget | null) => void;
}

export const buildLanguageSwitch = (): LanguageSwitchElements => {
  const languageSwitch = document.createElement("div");
  languageSwitch.className = "language-switch";

  const languageTrigger = document.createElement("button");
  languageTrigger.type = "button";
  languageTrigger.className = "language-switch__trigger";
  languageTrigger.setAttribute("aria-haspopup", "true");
  languageTrigger.setAttribute("aria-expanded", "false");

  const languageMenu = document.createElement("div");
  languageMenu.className = "language-switch__menu";
  languageMenu.hidden = true;

  const languageButtons = new Map<LanguageCode, HTMLButtonElement>();
  let languageMenuOpen = false;

  const updateLanguageMenuState = (): void => {
    languageMenu.hidden = !languageMenuOpen;
    languageTrigger.setAttribute("aria-expanded", String(languageMenuOpen));
  };

  const refreshLanguageTriggerFlag = (): void => {
    languageTrigger.textContent = languageOptions[getCurrentLanguage()].flag;
  };

  const refreshLanguageButtonStates = (): void => {
    languageButtons.forEach((button, code) => {
      button.setAttribute("aria-pressed", String(code === getCurrentLanguage()));
    });
  };

  const selectLanguage = (language: LanguageCode): void => {
    languageMenuOpen = false;
    updateLanguageMenuState();
    setLanguage(language);
    refreshLanguageTriggerFlag();
    refreshLanguageButtonStates();
  };

  onLanguageChange(() => {
    refreshLanguageTriggerFlag();
    refreshLanguageButtonStates();
    languageMenuOpen = false;
    updateLanguageMenuState();
  });

  (Object.keys(languageOptions) as LanguageCode[]).forEach((code) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "language-switch__option";
    option.textContent = `${languageOptions[code].flag} ${languageOptions[code].label}`;
    option.setAttribute("aria-pressed", String(code === getCurrentLanguage()));
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      selectLanguage(code);
    });
    languageButtons.set(code, option);
    languageMenu.append(option);
  });
  refreshLanguageButtonStates();

  languageTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    languageMenuOpen = !languageMenuOpen;
    updateLanguageMenuState();
  });

  languageSwitch.append(languageTrigger, languageMenu);
  bindLocalizedAttribute(languageTrigger, "aria-label", "languageMenuLabel");
  refreshLanguageTriggerFlag();

  return {
    element: languageSwitch,
    closeIfOutside: (target) => {
      if (languageMenuOpen && target instanceof Node && !languageSwitch.contains(target)) {
        languageMenuOpen = false;
        updateLanguageMenuState();
      }
    },
  };
};
