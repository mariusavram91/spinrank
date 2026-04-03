import { bindLocalizedText, registerTranslation, t } from "../i18n/runtime";
import type { TextKey } from "../i18n/translations";

type ScoreKey = "left" | "right";

export interface ScoreCardElements {
  overlay: HTMLDivElement;
  openButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  isVisible: () => boolean;
  show: () => void;
  hide: () => void;
}

export const buildScoreCard = (): ScoreCardElements => {
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "secondary-button";
  bindLocalizedText(openButton, "scoreCardButton");

  const overlay = document.createElement("div");
  overlay.className = "score-card-overlay";
  overlay.hidden = true;

  const scoreCard = document.createElement("section");
  scoreCard.className = "score-card";

  const scoreCardHeader = document.createElement("div");
  scoreCardHeader.className = "score-card__header";

  const scoreCardTitle = document.createElement("h3");
  scoreCardTitle.className = "card-title";
  bindLocalizedText(scoreCardTitle, "scoreCardTitle");

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "secondary-button score-card__close-button";
  bindLocalizedText(closeButton, "scoreCardClose");

  const scoreCardInstructions = document.createElement("p");
  scoreCardInstructions.className = "score-card__instructions";
  bindLocalizedText(scoreCardInstructions, "scoreCardInstructions");

  const scoreCardTiles = document.createElement("div");
  scoreCardTiles.className = "score-card__tiles";

  const scoreState: Record<ScoreKey, number> = { left: 0, right: 0 };
  const scoreValueElements: Partial<Record<ScoreKey, HTMLSpanElement>> = {};
  const pointerMeta = new Map<HTMLButtonElement, { startX: number; startY: number; dragged: boolean }>();
  let visible = false;

  const updateScoreCardDisplay = (): void => {
    (Object.keys(scoreState) as ScoreKey[]).forEach((key) => {
      const valueElement = scoreValueElements[key];
      if (valueElement) {
        valueElement.textContent = String(scoreState[key]);
      }
    });
  };

  const reset = (): void => {
    scoreState.left = 0;
    scoreState.right = 0;
    updateScoreCardDisplay();
  };

  const show = (): void => {
    overlay.hidden = false;
    visible = true;
    document.body.classList.add("score-card-open");
  };

  const hide = (): void => {
    overlay.hidden = true;
    visible = false;
    document.body.classList.remove("score-card-open");
  };

  const createScoreTile = (key: ScoreKey, labelKey: TextKey): HTMLButtonElement => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "score-card__tile";

    const tileLabel = document.createElement("span");
    tileLabel.className = "score-card__tile-label";
    registerTranslation(() => {
      tileLabel.textContent = t(labelKey);
    });

    const tileValue = document.createElement("span");
    tileValue.className = "score-card__tile-value";
    tileValue.textContent = "0";
    scoreValueElements[key] = tileValue;

    tile.append(tileLabel, tileValue);

    const handlePointerEnd = (event: PointerEvent): void => {
      const meta = pointerMeta.get(tile);
      if (!meta) {
        return;
      }
      if (meta.dragged) {
        scoreState[key] = Math.max(0, scoreState[key] - 1);
      } else {
        scoreState[key] += 1;
      }
      updateScoreCardDisplay();
      pointerMeta.delete(tile);
      tile.classList.remove("score-card__tile--dragging");
      if (tile.hasPointerCapture(event.pointerId)) {
        tile.releasePointerCapture(event.pointerId);
      }
    };

    tile.addEventListener("pointerdown", (event) => {
      tile.setPointerCapture(event.pointerId);
      pointerMeta.set(tile, { startX: event.clientX, startY: event.clientY, dragged: false });
    });

    tile.addEventListener("pointermove", (event) => {
      const meta = pointerMeta.get(tile);
      if (!meta) {
        return;
      }
      const dx = event.clientX - meta.startX;
      const dy = event.clientY - meta.startY;
      if (!meta.dragged && Math.hypot(dx, dy) >= 10) {
        meta.dragged = true;
        tile.classList.add("score-card__tile--dragging");
      }
    });

    tile.addEventListener("pointerup", handlePointerEnd);
    tile.addEventListener("pointercancel", handlePointerEnd);

    return tile;
  };

  const scoreTileLabels: [ScoreKey, TextKey][] = [
    ["left", "scoreTilePlayerA"],
    ["right", "scoreTilePlayerB"],
  ];

  scoreCardTiles.append(...scoreTileLabels.map(([key, label]) => createScoreTile(key, label)));

  const scoreCardActions = document.createElement("div");
  scoreCardActions.className = "score-card__actions";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "secondary-button";
  bindLocalizedText(resetButton, "resetScoreCard");
  resetButton.addEventListener("click", reset);

  scoreCardActions.append(resetButton);

  scoreCardHeader.append(scoreCardTitle, closeButton);
  scoreCard.append(scoreCardHeader, scoreCardInstructions, scoreCardTiles, scoreCardActions);
  overlay.append(scoreCard);

  return {
    overlay,
    openButton,
    closeButton,
    resetButton,
    isVisible: () => visible,
    show,
    hide,
  };
};
