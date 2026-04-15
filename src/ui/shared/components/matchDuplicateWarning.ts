export type MatchDuplicateWarningItem = {
  players: string;
  score: string;
  context: string;
  playedAt: string;
  createdBy: string;
};

export type MatchDuplicateWarningResult = "cancel" | "review" | "confirm";

export interface MatchDuplicateWarningElements {
  overlay: HTMLDivElement;
  prompt: (items: MatchDuplicateWarningItem[]) => Promise<MatchDuplicateWarningResult>;
}

export const buildMatchDuplicateWarning = (): MatchDuplicateWarningElements => {
  const overlay = document.createElement("div");
  overlay.className = "delete-warning-overlay";
  overlay.hidden = true;
  overlay.tabIndex = -1;

  const modal = document.createElement("div");
  modal.className = "delete-warning-modal";
  modal.setAttribute("role", "alertdialog");
  modal.setAttribute("aria-modal", "true");

  const title = document.createElement("h3");
  title.className = "delete-warning__title";
  title.textContent = "Possible duplicate match";

  const description = document.createElement("p");
  description.className = "delete-warning__description";
  description.textContent = "A similar match was recorded within the last 10 minutes. Review it before creating another one.";

  const list = document.createElement("div");
  list.className = "profile-card-list";

  const actions = document.createElement("div");
  actions.className = "delete-warning__actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "secondary-button";
  cancelButton.textContent = "Cancel";

  const reviewButton = document.createElement("button");
  reviewButton.type = "button";
  reviewButton.className = "secondary-button";
  reviewButton.textContent = "Review matches";

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "primary-button";
  confirmButton.textContent = "Create anyway";

  actions.append(reviewButton, cancelButton, confirmButton);
  modal.append(title, description, list, actions);
  overlay.append(modal);

  let resolver: ((result: MatchDuplicateWarningResult) => void) | null = null;

  const close = (result: MatchDuplicateWarningResult): void => {
    if (!resolver) {
      return;
    }
    const resolve = resolver;
    resolver = null;
    overlay.hidden = true;
    list.replaceChildren();
    resolve(result);
  };

  const prompt = (items: MatchDuplicateWarningItem[]): Promise<MatchDuplicateWarningResult> => {
    if (resolver) {
      close("cancel");
    }

    list.replaceChildren(
      ...items.map((item) => {
        const card = document.createElement("article");
        card.className = "match-row";
        const line = document.createElement("div");
        line.className = "match-row__detail-line";

        const players = document.createElement("span");
        players.className = "match-type";
        players.textContent = item.players;

        const score = document.createElement("span");
        score.className = "match-round";
        score.textContent = item.score;

        const context = document.createElement("span");
        context.className = "match-context";
        context.textContent = item.context;

        const playedAt = document.createElement("span");
        playedAt.className = "match-round";
        playedAt.textContent = item.playedAt;

        const createdBy = document.createElement("span");
        createdBy.className = "match-round";
        createdBy.textContent = `By ${item.createdBy}`;

        line.append(players, score, context, playedAt, createdBy);
        card.append(line);
        return card;
      }),
    );

    overlay.hidden = false;
    reviewButton.focus();
    return new Promise((resolve) => {
      resolver = resolve;
    });
  };

  cancelButton.addEventListener("click", () => close("cancel"));
  reviewButton.addEventListener("click", () => close("review"));
  confirmButton.addEventListener("click", () => close("confirm"));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close("cancel");
    }
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close("cancel");
    }
  });

  return {
    overlay,
    prompt,
  };
};
