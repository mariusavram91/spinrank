import { bindLocalizedText, onLanguageChange, t } from "../i18n/runtime";

export interface LoginViewElements {
  loginView: HTMLElement;
  googleSlot: HTMLDivElement;
}

type LoginFeatureCard = {
  title: HTMLHeadingElement;
  text: HTMLParagraphElement;
};

type LoginFaqCard = {
  title: HTMLHeadingElement;
  text: HTMLParagraphElement;
};

export const buildLoginView = (): LoginViewElements => {
  const loginView = document.createElement("section");
  loginView.className = "login-view";
  loginView.hidden = true;

  const loginWelcome = document.createElement("div");
  loginWelcome.className = "login-welcome";

  const loginEyebrow = document.createElement("p");
  loginEyebrow.className = "eyebrow";
  bindLocalizedText(loginEyebrow, "loginEyebrow");

  const loginTitle = document.createElement("h1");
  loginTitle.className = "login-title";
  bindLocalizedText(loginTitle, "loginTitle");

  const loginText = document.createElement("p");
  loginText.className = "login-text";
  bindLocalizedText(loginText, "loginText");

  const googleContainer = document.createElement("div");
  googleContainer.className = "google-container login-cta-inline";
  const googleSlot = document.createElement("div");
  googleSlot.className = "google-slot";
  googleContainer.append(googleSlot);

  const loginSubtext = document.createElement("p");
  loginSubtext.className = "login-subtext";
  bindLocalizedText(loginSubtext, "loginSubtext");

  loginWelcome.append(loginEyebrow, loginTitle, loginText, googleContainer, loginSubtext);

  const loginActions = document.createElement("div");
  loginActions.className = "login-actions";

  const loginLinks = document.createElement("div");
  loginLinks.className = "login-links";

  const featuresLink = document.createElement("a");
  featuresLink.className = "secondary-button link-button";
  featuresLink.href = "#features";
  bindLocalizedText(featuresLink, "loginFeaturesLink");

  const faqLink = document.createElement("a");
  faqLink.className = "secondary-button link-button";
  faqLink.href = "#faq";
  bindLocalizedText(faqLink, "loginFaqLink");

  loginLinks.append(featuresLink, faqLink);
  loginActions.append(loginLinks);

  const loginFeaturesSection = document.createElement("section");
  loginFeaturesSection.className = "login-section";

  const loginFeaturesTitle = document.createElement("h2");
  loginFeaturesTitle.className = "section-title login-section__title";
  bindLocalizedText(loginFeaturesTitle, "loginHighlightsTitle");

  const loginFeaturesGrid = document.createElement("div");
  loginFeaturesGrid.className = "login-feature-grid";

  const featureCards: LoginFeatureCard[] = Array.from({ length: 4 }, () => {
    const card = document.createElement("article");
    card.className = "login-feature-card";

    const title = document.createElement("h3");
    title.className = "card-title login-feature-card__title";

    const text = document.createElement("p");
    text.className = "login-feature-card__text";

    card.append(title, text);
    loginFeaturesGrid.append(card);
    return { title, text };
  });

  loginFeaturesSection.append(loginFeaturesTitle, loginFeaturesGrid);

  const loginSearchSection = document.createElement("section");
  loginSearchSection.className = "login-section login-section--story";

  const loginSearchTitle = document.createElement("h2");
  loginSearchTitle.className = "section-title login-section__title";
  bindLocalizedText(loginSearchTitle, "loginSearchTitle");

  const loginSearchText = document.createElement("p");
  loginSearchText.className = "section-copy";
  bindLocalizedText(loginSearchText, "loginSearchText");

  const loginSearchList = document.createElement("ul");
  loginSearchList.className = "login-story-list";

  const searchItems = Array.from({ length: 4 }, () => {
    const item = document.createElement("li");
    loginSearchList.append(item);
    return item;
  });

  loginSearchSection.append(loginSearchTitle, loginSearchText, loginSearchList);

  const loginFaqSection = document.createElement("section");
  loginFaqSection.className = "login-section";

  const loginFaqTitle = document.createElement("h2");
  loginFaqTitle.className = "section-title login-section__title";
  bindLocalizedText(loginFaqTitle, "loginFaqPreviewTitle");

  const loginFaqGrid = document.createElement("div");
  loginFaqGrid.className = "login-faq-grid";

  const faqCards: LoginFaqCard[] = Array.from({ length: 3 }, () => {
    const card = document.createElement("article");
    card.className = "faq-card login-faq-card";

    const title = document.createElement("h3");
    title.className = "card-title faq-card__title";

    const text = document.createElement("p");
    text.className = "faq-card__text";

    card.append(title, text);
    loginFaqGrid.append(card);
    return { title, text };
  });

  const loginFaqFooter = document.createElement("p");
  loginFaqFooter.className = "section-copy";
  bindLocalizedText(loginFaqFooter, "loginFaqFooter");

  loginFaqSection.append(loginFaqTitle, loginFaqGrid, loginFaqFooter);

  const syncLocalizedContent = (): void => {
    const featureKeys = [
      ["loginFeature1Title", "loginFeature1Text"],
      ["loginFeature2Title", "loginFeature2Text"],
      ["loginFeature3Title", "loginFeature3Text"],
      ["loginFeature4Title", "loginFeature4Text"],
    ] as const;
    featureCards.forEach((card, index) => {
      const [titleKey, textKey] = featureKeys[index];
      card.title.textContent = t(titleKey);
      card.text.textContent = t(textKey);
    });

    const searchKeys = [
      "loginSearchPoint1",
      "loginSearchPoint2",
      "loginSearchPoint3",
      "loginSearchPoint4",
    ] as const;
    searchItems.forEach((item, index) => {
      item.textContent = t(searchKeys[index]);
    });

    const faqKeys = [
      ["loginFaq1Title", "loginFaq1Text"],
      ["loginFaq2Title", "loginFaq2Text"],
      ["loginFaq3Title", "loginFaq3Text"],
    ] as const;
    faqCards.forEach((card, index) => {
      const [titleKey, textKey] = faqKeys[index];
      card.title.textContent = t(titleKey);
      card.text.textContent = t(textKey);
    });
  };

  onLanguageChange(syncLocalizedContent);
  syncLocalizedContent();

  loginView.append(loginWelcome, loginActions, loginFeaturesSection, loginSearchSection, loginFaqSection);

  return {
    loginView,
    googleSlot,
  };
};
