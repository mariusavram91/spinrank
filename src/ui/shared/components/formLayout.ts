import { bindLocalizedText } from "../i18n/runtime";
import type { TextKey } from "../i18n/translations";

export const buildField = (labelKey: TextKey, input: HTMLElement): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "form-field";
  const copy = document.createElement("span");
  copy.className = "field-label";
  bindLocalizedText(copy, labelKey);
  label.append(copy, input);
  return label;
};

export const createPanelSection = (titleKey: TextKey, ...children: HTMLElement[]): HTMLElement => {
  const section = document.createElement("section");
  section.className = "panel-section";
  const heading = document.createElement("h4");
  heading.className = "section-caption";
  bindLocalizedText(heading, titleKey);
  section.append(heading, ...children);
  return section;
};
