import { faqEntries } from "./faqContent";
import { bindLocalizedText, getCurrentLanguage, onLanguageChange, t } from "../../shared/i18n/runtime";

export interface HelpScreenElements {
  faqScreen: HTMLElement;
  faqBackButton: HTMLButtonElement;
  privacyScreen: HTMLElement;
  privacyBackButton: HTMLButtonElement;
}

export const buildHelpScreens = (): HelpScreenElements => {
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
  faqBackButton.className = "secondary-button faq-screen__back-button";
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
  ];

  faqSummaryGrid.append(...summaryCards.map((entry) => entry.card));
  faqSummary.append(faqSummaryHeading, faqSummaryIntro, faqSummaryGrid);

  const faqGrid = document.createElement("div");
  faqGrid.className = "faq-grid";

  const getLocalizedText = (detail: { en: string; de: string }): string =>
    getCurrentLanguage() === "de" ? detail.de : detail.en;

  const renderFaqCards = (): void => {
    const cards = faqEntries.map((entry) => {
      const card = document.createElement("article");
      card.className = "faq-card";

      const cardTitle = document.createElement("h3");
      cardTitle.className = "card-title faq-card__title";
      cardTitle.textContent = getCurrentLanguage() === "de" ? entry.titleDe : entry.titleEn;

      const cardBody = document.createElement("div");
      cardBody.className = "faq-card__body";

      entry.details.forEach((detail) => {
        const detailBlock = document.createElement("div");
        detailBlock.className = "faq-card__detail";

        const paragraph = document.createElement("p");
        paragraph.className = "faq-card__text";
        paragraph.textContent = getLocalizedText(detail);

        detailBlock.append(paragraph);
        cardBody.append(detailBlock);
      });

      card.append(cardTitle, cardBody);
      return card;
    });
    faqGrid.replaceChildren(...cards);
  };

  const renderFaqSummary = (): void => {
    const summaryKeys = [
      ["faqSummaryEloLabel", "faqSummaryEloValue", "faqSummaryEloDetail"],
      ["faqSummarySinglesLabel", "faqSummarySinglesValue", "faqSummarySinglesDetail"],
      ["faqSummaryPaceLabel", "faqSummaryPaceValue", "faqSummaryPaceDetail"],
      ["faqSummarySeasonLabel", "faqSummarySeasonValue", "faqSummarySeasonDetail"],
      ["faqSummarySeasonOnlyLabel", "faqSummarySeasonOnlyValue", "faqSummarySeasonOnlyDetail"],
      ["faqSummaryCarryLabel", "faqSummaryCarryValue", "faqSummaryCarryDetail"],
      ["faqSummaryAttendanceLabel", "faqSummaryAttendanceValue", "faqSummaryAttendanceDetail"],
      ["faqSummaryTournamentLabel", "faqSummaryTournamentValue", "faqSummaryTournamentDetail"],
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
  renderFaqSummary();
  renderFaqCards();

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
  privacyBackButton.className = "secondary-button faq-screen__back-button";
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

  privacyScreen.append(privacyHeader, privacyIntro, ...privacyParagraphs, privacyPara3);

  return {
    faqScreen,
    faqBackButton,
    privacyScreen,
    privacyBackButton,
  };
};
