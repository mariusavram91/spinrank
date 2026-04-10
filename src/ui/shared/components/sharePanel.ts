import { bindLocalizedText, t } from "../i18n/runtime";
import type { SegmentType } from "../../../api/contract";
import type { SharePanelElements } from "../types/app";

export const buildSharePanel = (segmentType: SegmentType): SharePanelElements => {
  const section = document.createElement("section");
  section.className = "panel-section share-panel panel-section--editor panel-section--editor-share";
  section.dataset.testid = `${segmentType}-share-panel`;

  const heading = document.createElement("h4");
  heading.className = "card-title";
  const titleSegmentKey =
    segmentType === "season" ? "shareSegmentTypeSeason" : "shareSegmentTypeTournament";
  heading.textContent = t("shareInviteTitle").replace("{segment}", t(titleSegmentKey));

  const description = document.createElement("p");
  description.className = "share-panel__description";
  bindLocalizedText(description, "sharePanelDescription");

  const controls = document.createElement("div");
  controls.className = "share-panel__controls";

  const buttonRow = document.createElement("div");
  buttonRow.className = "share-panel__button-row";

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "primary-button share-panel__create-button";
  bindLocalizedText(createButton, "shareCreateLink");
  createButton.dataset.testid = `${segmentType}-share-create`;

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "secondary-button share-panel__copy-button";
  bindLocalizedText(copyButton, "shareCopyLink");
  copyButton.dataset.testid = `${segmentType}-share-copy`;
  buttonRow.append(createButton, copyButton);

  const buttonStack = document.createElement("div");
  buttonStack.className = "share-panel__button-stack";
  const copyFeedback = document.createElement("span");
  copyFeedback.className = "share-panel__copy-feedback";
  copyFeedback.dataset.testid = `${segmentType}-share-copy-feedback`;
  buttonStack.append(buttonRow, copyFeedback);

  const qrWrapper = document.createElement("div");
  qrWrapper.className = "share-panel__qr";
  const qrCanvas = document.createElement("canvas");
  qrCanvas.className = "share-panel__qr-canvas";
  qrCanvas.dataset.testid = `${segmentType}-share-qr`;
  qrWrapper.append(qrCanvas);
  qrWrapper.hidden = true;

  controls.append(buttonStack, qrWrapper);

  const status = document.createElement("p");
  status.className = "form-status share-panel__status";
  status.dataset.status = "ready";
  status.dataset.testid = `${segmentType}-share-status`;

  section.append(heading, description, controls, status);

  return {
    section,
    createButton,
    copyButton,
    status,
    qrCanvas,
    qrWrapper,
    copyFeedback,
    animationTimer: null,
  };
};
