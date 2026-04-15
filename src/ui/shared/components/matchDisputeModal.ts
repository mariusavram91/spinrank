export interface MatchDisputePromptRequest {
  title: string;
  detail?: string;
  initialComment?: string;
}

export interface MatchDisputeModalElements {
  overlay: HTMLDivElement;
  prompt: (request: MatchDisputePromptRequest) => Promise<string | null>;
}

export const buildMatchDisputeModal = (): MatchDisputeModalElements => {
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

  const description = document.createElement("p");
  description.className = "delete-warning__description";
  description.textContent = "Explain what is wrong so the creator can delete and recreate the match if needed.";

  const detail = document.createElement("p");
  detail.className = "delete-warning__detail";
  detail.hidden = true;

  const textarea = document.createElement("textarea");
  textarea.className = "delete-warning__input";
  textarea.rows = 4;
  textarea.placeholder = "Wrong score, wrong teammate, duplicate match, or similar";

  const actions = document.createElement("div");
  actions.className = "delete-warning__actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "secondary-button";
  cancelButton.textContent = "Cancel";

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "primary-button";
  confirmButton.textContent = "Save dispute";

  actions.append(cancelButton, confirmButton);
  modal.append(title, description, detail, textarea, actions);
  overlay.append(modal);

  let resolver: ((value: string | null) => void) | null = null;

  const updateConfirmState = (): void => {
    confirmButton.disabled = textarea.value.trim().length === 0;
  };

  const close = (value: string | null): void => {
    if (!resolver) {
      return;
    }
    const resolve = resolver;
    resolver = null;
    overlay.hidden = true;
    textarea.value = "";
    detail.hidden = true;
    detail.textContent = "";
    resolve(value);
  };

  const prompt = (request: MatchDisputePromptRequest): Promise<string | null> => {
    if (resolver) {
      close(null);
    }

    title.textContent = request.title;
    detail.textContent = request.detail || "";
    detail.hidden = !request.detail;
    textarea.value = request.initialComment || "";
    updateConfirmState();
    overlay.hidden = false;
    textarea.focus();

    return new Promise((resolve) => {
      resolver = resolve;
    });
  };

  cancelButton.addEventListener("click", () => close(null));
  confirmButton.addEventListener("click", () => close(textarea.value.trim() || null));
  textarea.addEventListener("input", updateConfirmState);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close(null);
    }
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close(null);
    }
  });

  return {
    overlay,
    prompt,
  };
};
