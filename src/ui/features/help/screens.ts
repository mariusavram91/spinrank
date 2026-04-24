import { faqEntries, faqEntriesEs } from "./faqContent";
import { bindLocalizedText, getCurrentLanguage, onLanguageChange, t } from "../../shared/i18n/runtime";

export interface HelpScreenElements {
  featuresScreen: HTMLElement;
  featuresBackButton: HTMLButtonElement;
  faqScreen: HTMLElement;
  faqBackButton: HTMLButtonElement;
  privacyScreen: HTMLElement;
  privacyBackButton: HTMLButtonElement;
}

function renderInlineFaqText(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      fragment.append(document.createTextNode(text.slice(lastIndex, index)));
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      fragment.append(strong);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      const emphasis = document.createElement("em");
      emphasis.textContent = token.slice(1, -1);
      fragment.append(emphasis);
    } else {
      fragment.append(document.createTextNode(token));
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    fragment.append(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

export const buildHelpScreens = (): HelpScreenElements => {
  const featuresScreen = document.createElement("section");
  featuresScreen.className = "dashboard faq-screen";
  featuresScreen.hidden = true;

  const featuresHeader = document.createElement("div");
  featuresHeader.className = "faq-screen__header";

  const featuresHeading = document.createElement("h2");
  featuresHeading.className = "section-title";
  bindLocalizedText(featuresHeading, "featuresTitle");

  const featuresBackButton = document.createElement("button");
  featuresBackButton.type = "button";
  featuresBackButton.className = "secondary-button faq-screen__back-button compact-header-button";
  bindLocalizedText(featuresBackButton, "back");

  featuresHeader.append(featuresHeading, featuresBackButton);

  const featuresHero = document.createElement("section");
  featuresHero.className = "faq-summary features-hero";

  const featuresHeroTitle = document.createElement("h3");
  featuresHeroTitle.className = "faq-summary__heading";
  bindLocalizedText(featuresHeroTitle, "featuresHeroTitle");

  const featuresHeroIntro = document.createElement("p");
  featuresHeroIntro.className = "faq-summary__intro";
  bindLocalizedText(featuresHeroIntro, "featuresHeroIntro");

  const featuresHeroGrid = document.createElement("div");
  featuresHeroGrid.className = "faq-summary__grid";

  const createFeatureSummaryCard = () => {
    const card = document.createElement("article");
    card.className = "faq-summary-card";

    const label = document.createElement("p");
    label.className = "faq-summary-card__label";

    const value = document.createElement("p");
    value.className = "faq-summary-card__value";

    const detail = document.createElement("p");
    detail.className = "faq-summary-card__detail";

    card.append(label, value, detail);
    return { card, label, value, detail };
  };

  const featureSummaryCards = [
    createFeatureSummaryCard(),
    createFeatureSummaryCard(),
    createFeatureSummaryCard(),
    createFeatureSummaryCard(),
  ];
  featuresHeroGrid.append(...featureSummaryCards.map((entry) => entry.card));
  featuresHero.append(featuresHeroTitle, featuresHeroIntro, featuresHeroGrid);

  const featuresGrid = document.createElement("div");
  featuresGrid.className = "faq-grid";

  const createFeatureCard = () => {
    const card = document.createElement("article");
    card.className = "faq-card feature-card";

    const title = document.createElement("h3");
    title.className = "card-title faq-card__title";

    const detail = document.createElement("p");
    detail.className = "faq-card__text";

    card.append(title, detail);
    return { card, title, detail };
  };

  const featureCards = Array.from({ length: 6 }, () => createFeatureCard());
  featuresGrid.append(...featureCards.map((entry) => entry.card));

  const featuresSeoSection = document.createElement("section");
  featuresSeoSection.className = "faq-summary features-copy";

  const featuresSeoTitle = document.createElement("h3");
  featuresSeoTitle.className = "faq-summary__heading";
  bindLocalizedText(featuresSeoTitle, "featuresSeoTitle");

  const featuresSeoText = document.createElement("p");
  featuresSeoText.className = "faq-summary__intro";
  bindLocalizedText(featuresSeoText, "featuresSeoText");

  const featuresSeoList = document.createElement("ul");
  featuresSeoList.className = "login-story-list features-copy__list";
  const featureSeoItems = Array.from({ length: 4 }, () => {
    const item = document.createElement("li");
    featuresSeoList.append(item);
    return item;
  });

  featuresSeoSection.append(featuresSeoTitle, featuresSeoText, featuresSeoList);

  const faqScreen = document.createElement("section");
  faqScreen.className = "dashboard faq-screen";
  faqScreen.hidden = true;

  const faqHeader = document.createElement("div");
  faqHeader.className = "faq-screen__header";

  const faqHeading = document.createElement("h2");
  faqHeading.className = "section-title";
  bindLocalizedText(faqHeading, "faqTitle");

  const faqBackButton = document.createElement("button");
  faqBackButton.type = "button";
  faqBackButton.className = "secondary-button faq-screen__back-button compact-header-button";
  bindLocalizedText(faqBackButton, "back");

  faqHeader.append(faqHeading, faqBackButton);

  const faqIntro = document.createElement("p");
  faqIntro.className = "section-copy";
  bindLocalizedText(faqIntro, "faqIntro");

  const faqSummary = document.createElement("section");
  faqSummary.className = "faq-summary";

  const faqSummaryHeading = document.createElement("h3");
  faqSummaryHeading.className = "faq-summary__heading";
  bindLocalizedText(faqSummaryHeading, "faqSummaryTitle");

  const faqSummaryIntro = document.createElement("p");
  faqSummaryIntro.className = "faq-summary__intro";
  bindLocalizedText(faqSummaryIntro, "faqSummaryIntro");

  const faqSummaryGrid = document.createElement("div");
  faqSummaryGrid.className = "faq-summary__grid";

  const createSummaryCard = () => {
    const card = document.createElement("article");
    card.className = "faq-summary-card";

    const label = document.createElement("p");
    label.className = "faq-summary-card__label";

    const value = document.createElement("p");
    value.className = "faq-summary-card__value";

    const detail = document.createElement("p");
    detail.className = "faq-summary-card__detail";

    card.append(label, value, detail);
    return { card, label, value, detail };
  };

  const summaryCards = [
    createSummaryCard(),
    createSummaryCard(),
    createSummaryCard(),
    createSummaryCard(),
    createSummaryCard(),
    createSummaryCard(),
    createSummaryCard(),
    createSummaryCard(),
    createSummaryCard(),
    createSummaryCard(),
  ];

  faqSummaryGrid.append(...summaryCards.map((entry) => entry.card));
  faqSummary.append(faqSummaryHeading, faqSummaryIntro, faqSummaryGrid);

  const faqGrid = document.createElement("div");
  faqGrid.className = "faq-grid";

  const getLocalizedText = (detail: { en: string; de: string; es?: string }): string => {
    const language = getCurrentLanguage();
    if (language === "de") {
      return detail.de;
    }
    if (language === "es") {
      return detail.es ?? detail.en;
    }
    return detail.en;
  };

  const renderFaqCards = (): void => {
    let cardIndex = 0;
    const createFaqCard = (
      title: string,
      details: string[],
      renderDetail: (detailText: string, cardBody: HTMLDivElement) => void,
    ): HTMLElement => {
      const card = document.createElement("article");
      card.className = "faq-card";

      const cardTitle = document.createElement("h3");
      cardTitle.className = "card-title faq-card__title";

      const cardToggle = document.createElement("button");
      cardToggle.type = "button";
      cardToggle.className = "faq-card__toggle";
      cardToggle.textContent = title;
      cardToggle.setAttribute("aria-expanded", "false");

      const cardBody = document.createElement("div");
      cardBody.className = "faq-card__body";
      cardBody.hidden = true;
      cardIndex += 1;
      const bodyId = `faq-card-body-${cardIndex}`;
      cardBody.id = bodyId;
      cardToggle.setAttribute("aria-controls", bodyId);

      cardToggle.addEventListener("click", () => {
        const nextExpanded = cardBody.hidden;
        cardBody.hidden = !nextExpanded;
        cardToggle.setAttribute("aria-expanded", String(nextExpanded));
        card.classList.toggle("faq-card--expanded", nextExpanded);
      });

      details.forEach((detailText) => renderDetail(detailText, cardBody));

      cardTitle.append(cardToggle);
      card.append(cardTitle, cardBody);
      return card;
    };

    if (getCurrentLanguage() === "es") {
      const cards = faqEntriesEs.map((entry) => {
        return createFaqCard(entry.title, entry.details, (detailText, cardBody) => {
          const detailBlock = document.createElement("div");
          detailBlock.className = "faq-card__detail";

          const paragraph = document.createElement("p");
          paragraph.className = "faq-card__text";
          paragraph.textContent = detailText;
          detailBlock.append(paragraph);
          cardBody.append(detailBlock);
        });
      });
      faqGrid.replaceChildren(...cards);
      return;
    }

    const cards = faqEntries.map((entry) => {
      const title =
        getCurrentLanguage() === "de"
          ? entry.titleDe
          : getCurrentLanguage() === "es"
            ? (entry.titleEs ?? entry.titleEn)
            : entry.titleEn;

      const details = entry.details.map((detail) => getLocalizedText(detail));
      return createFaqCard(title, details, (detailText, cardBody) => {
        const detailBlock = document.createElement("div");
        detailBlock.className = "faq-card__detail";

        const paragraph = document.createElement("p");
        paragraph.className = "faq-card__text";
        paragraph.append(renderInlineFaqText(detailText));

        detailBlock.append(paragraph);
        cardBody.append(detailBlock);
      });
    });
    faqGrid.replaceChildren(...cards);
  };

  const renderFaqSummary = (): void => {
    const summaryKeys = [
      ["faqSummaryCompareLabel", "faqSummaryCompareValue", "faqSummaryCompareDetail"],
      ["faqSummaryEloLabel", "faqSummaryEloValue", "faqSummaryEloDetail"],
      ["faqSummarySeasonLabel", "faqSummarySeasonValue", "faqSummarySeasonDetail"],
      ["faqSummaryTournamentLabel", "faqSummaryTournamentValue", "faqSummaryTournamentDetail"],
      ["faqSummarySinglesLabel", "faqSummarySinglesValue", "faqSummarySinglesDetail"],
      ["faqSummaryPaceLabel", "faqSummaryPaceValue", "faqSummaryPaceDetail"],
      ["faqSummaryAttendanceLabel", "faqSummaryAttendanceValue", "faqSummaryAttendanceDetail"],
      ["faqSummaryCarryLabel", "faqSummaryCarryValue", "faqSummaryCarryDetail"],
      ["faqSummarySeasonOnlyLabel", "faqSummarySeasonOnlyValue", "faqSummarySeasonOnlyDetail"],
      ["faqSummaryAchievementsLabel", "faqSummaryAchievementsValue", "faqSummaryAchievementsDetail"],
    ] as const;

    summaryCards.forEach((card, index) => {
      const [labelKey, valueKey, detailKey] = summaryKeys[index];
      card.label.textContent = t(labelKey);
      card.value.textContent = t(valueKey);
      card.detail.textContent = t(detailKey);
    });
  };

  onLanguageChange(renderFaqCards);
  onLanguageChange(renderFaqSummary);
  const renderFeatureCards = (): void => {
    const summaryKeys = [
      ["featuresSummary1Label", "featuresSummary1Value", "featuresSummary1Detail"],
      ["featuresSummary2Label", "featuresSummary2Value", "featuresSummary2Detail"],
      ["featuresSummary3Label", "featuresSummary3Value", "featuresSummary3Detail"],
      ["featuresSummary4Label", "featuresSummary4Value", "featuresSummary4Detail"],
    ] as const;
    featureSummaryCards.forEach((card, index) => {
      const [labelKey, valueKey, detailKey] = summaryKeys[index];
      card.label.textContent = t(labelKey);
      card.value.textContent = t(valueKey);
      card.detail.textContent = t(detailKey);
    });

    const featureKeys = [
      ["featuresCard1Title", "featuresCard1Text"],
      ["featuresCard2Title", "featuresCard2Text"],
      ["featuresCard3Title", "featuresCard3Text"],
      ["featuresCard4Title", "featuresCard4Text"],
      ["featuresCard5Title", "featuresCard5Text"],
      ["featuresCard6Title", "featuresCard6Text"],
    ] as const;
    featureCards.forEach((card, index) => {
      const [titleKey, textKey] = featureKeys[index];
      card.title.textContent = t(titleKey);
      card.detail.textContent = t(textKey);
    });

    const seoKeys = [
      "featuresSeoPoint1",
      "featuresSeoPoint2",
      "featuresSeoPoint3",
      "featuresSeoPoint4",
    ] as const;
    featureSeoItems.forEach((item, index) => {
      item.textContent = t(seoKeys[index]);
    });
  };

  onLanguageChange(renderFeatureCards);
  renderFaqSummary();
  renderFaqCards();
  renderFeatureCards();

  featuresScreen.append(featuresHeader, featuresHero, featuresGrid, featuresSeoSection);

  faqScreen.append(faqHeader, faqSummary, faqIntro, faqGrid);

  const privacyScreen = document.createElement("section");
  privacyScreen.className = "dashboard faq-screen";
  privacyScreen.hidden = true;

  const privacyHeader = document.createElement("div");
  privacyHeader.className = "faq-screen__header";

  const privacyHeading = document.createElement("h2");
  privacyHeading.className = "section-title";
  bindLocalizedText(privacyHeading, "privacyTitle");

  const privacyBackButton = document.createElement("button");
  privacyBackButton.type = "button";
  privacyBackButton.className = "secondary-button faq-screen__back-button compact-header-button";
  bindLocalizedText(privacyBackButton, "back");

  privacyHeader.append(privacyHeading, privacyBackButton);

  const privacyIntro = document.createElement("p");
  privacyIntro.className = "section-copy";
  bindLocalizedText(privacyIntro, "privacyIntro");

  const privacyParagraphKeys = ["privacyPara1", "privacyPara2"] as const;
  const privacyParagraphs = privacyParagraphKeys.map((key) => {
    const paragraph = document.createElement("p");
    paragraph.className = "section-copy";
    bindLocalizedText(paragraph, key);
    return paragraph;
  });

  const privacyTermsHeading = document.createElement("h3");
  privacyTermsHeading.className = "faq-summary__heading";
  bindLocalizedText(privacyTermsHeading, "privacyTermsTitle");

  const privacyTermsParagraphKeys = ["privacyTermsPara1", "privacyTermsPara2", "privacyTermsPara3"] as const;
  const privacyTermsParagraphs = privacyTermsParagraphKeys.map((key) => {
    const paragraph = document.createElement("p");
    paragraph.className = "section-copy";
    bindLocalizedText(paragraph, key);
    return paragraph;
  });

  const privacyPara3 = document.createElement("p");
  privacyPara3.className = "section-copy";
  const privacyPara3Text = document.createElement("span");
  const privacyPara3Link = document.createElement("a");
  privacyPara3Link.href = "https://github.com/mariusavram91/spinrank/issues";
  privacyPara3Link.target = "_blank";
  privacyPara3Link.rel = "noreferrer noopener";
  privacyPara3.append(privacyPara3Text, privacyPara3Link);

  const updatePrivacyPara3 = (): void => {
    privacyPara3Text.textContent = t("privacyPara3Prefix");
    privacyPara3Link.textContent = t("privacyPara3Link");
  };
  onLanguageChange(updatePrivacyPara3);
  updatePrivacyPara3();

  privacyScreen.append(
    privacyHeader,
    privacyIntro,
    ...privacyParagraphs,
    privacyTermsHeading,
    ...privacyTermsParagraphs,
    privacyPara3,
  );

  return {
    featuresScreen,
    featuresBackButton,
    faqScreen,
    faqBackButton,
    privacyScreen,
    privacyBackButton,
  };
};
