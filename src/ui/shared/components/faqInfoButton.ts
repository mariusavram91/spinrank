import { bindLocalizedAttribute } from "../i18n/runtime";

export const buildFaqInfoButton = (testId?: string): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button title-help-button";

  const glyph = document.createElement("span");
  glyph.className = "title-help-button__glyph";
  glyph.textContent = "i";
  glyph.setAttribute("aria-hidden", "true");

  button.append(glyph);
  bindLocalizedAttribute(button, "aria-label", "faqShortcutLabel");
  bindLocalizedAttribute(button, "title", "faqShortcutLabel");
  if (testId) {
    button.dataset.testid = testId;
  }
  return button;
};
