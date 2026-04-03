import { onLanguageChange, t } from "../i18n/runtime";

export interface FooterElements {
  footer: HTMLElement;
  faqButton: HTMLButtonElement;
  privacyButton: HTMLButtonElement;
}

export const buildFooter = (): FooterElements => {
  const footer = document.createElement("footer");
  footer.className = "app-footer";

  const footerLinks = document.createElement("div");
  footerLinks.className = "footer-links";

  const faqButton = document.createElement("button");
  faqButton.type = "button";
  faqButton.className = "footer-link-button";

  const privacyButton = document.createElement("button");
  privacyButton.type = "button";
  privacyButton.className = "footer-link-button";

  footerLinks.append(faqButton, privacyButton);
  footer.append(footerLinks);

  const setFooterTexts = (): void => {
    faqButton.textContent = t("footerFaqLink");
    privacyButton.textContent = t("footerPrivacyLink");
  };

  onLanguageChange(setFooterTexts);
  setFooterTexts();

  return {
    footer,
    faqButton,
    privacyButton,
  };
};
