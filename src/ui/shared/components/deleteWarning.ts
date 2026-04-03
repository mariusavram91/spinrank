import type { DeleteWarningRequest } from "../types/app";
import { deleteWarningCopy } from "../constants/deleteWarning";
import { bindLocalizedAttribute, bindLocalizedText, onLanguageChange, t } from "../i18n/runtime";

export interface DeleteWarningElements {
  overlay: HTMLDivElement;
  prompt: (request: DeleteWarningRequest) => Promise<boolean>;
}

export const buildDeleteWarning = (): DeleteWarningElements => {
  const overlay = document.createElement("div");
  overlay.className = "delete-warning-overlay";
  overlay.hidden = true;
  overlay.tabIndex = -1;

  const modal = document.createElement("div");
  modal.className = "delete-warning-modal";
  modal.setAttribute("role", "alertdialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "delete-warning-title");
  modal.setAttribute("aria-describedby", "delete-warning-description");

  const title = document.createElement("h3");
  title.className = "delete-warning__title";
  title.id = "delete-warning-title";

  const description = document.createElement("p");
  description.className = "delete-warning__description";
  description.id = "delete-warning-description";

  const detail = document.createElement("p");
  detail.className = "delete-warning__detail";
  detail.hidden = true;

  const hint = document.createElement("p");
  hint.className = "delete-warning__hint";
  hint.hidden = true;
  hint.id = "delete-warning-hint";

  const hintLabel = document.createElement("span");
  hintLabel.className = "delete-warning__hint-text";
  bindLocalizedText(hintLabel, "deleteModalSeasonHint");

  const hintValue = document.createElement("strong");
  hintValue.className = "delete-warning__hint-value";

  hint.append(hintLabel, document.createTextNode(" "), hintValue);

  const input = document.createElement("input");
  input.className = "delete-warning__input";
  input.type = "text";
  input.hidden = true;
  input.autocomplete = "off";
  input.setAttribute("aria-describedby", "delete-warning-hint");
  bindLocalizedAttribute(input, "placeholder", "seasonName");
  bindLocalizedAttribute(input, "aria-label", "seasonName");

  const actions = document.createElement("div");
  actions.className = "delete-warning__actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "secondary-button";
  bindLocalizedText(cancelButton, "deleteWarningCancel");

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "secondary-button destructive-button";
  bindLocalizedText(confirmButton, "deleteWarningConfirm");

  actions.append(cancelButton, confirmButton);
  modal.append(title, description, detail, hint, input, actions);
  overlay.append(modal);

  let currentRequest: DeleteWarningRequest | null = null;
  let resolver: ((confirmed: boolean) => void) | null = null;

  const applyCopy = (): void => {
    if (!currentRequest) {
      return;
    }
    const copy = deleteWarningCopy[currentRequest.context];
    title.textContent = t(copy.titleKey);
    description.textContent = t(copy.bodyKey);
    const detailText = currentRequest.detail?.() ?? "";
    detail.textContent = detailText;
    detail.hidden = !detailText;
    const showHint = currentRequest.context === "season" && Boolean(currentRequest.confirmationValue);
    hintValue.textContent = currentRequest.confirmationValue ?? "";
    hint.hidden = !showHint;
    input.hidden = currentRequest.context !== "season";
  };

  const updateConfirmState = (): void => {
    if (!currentRequest) {
      confirmButton.disabled = false;
      return;
    }
    if (currentRequest.context === "season") {
      const confirmationTarget = currentRequest.confirmationValue ?? "";
      confirmButton.disabled = confirmationTarget === "" || input.value.trim() !== confirmationTarget;
      return;
    }
    confirmButton.disabled = false;
  };

  const close = (confirmed: boolean): void => {
    if (!resolver) {
      return;
    }
    const resolve = resolver;
    resolver = null;
    currentRequest = null;
    overlay.hidden = true;
    input.value = "";
    hint.hidden = true;
    detail.hidden = true;
    confirmButton.disabled = false;
    hintValue.textContent = "";
    input.hidden = true;
    resolve(confirmed);
  };

  const prompt = (request: DeleteWarningRequest): Promise<boolean> => {
    if (resolver) {
      close(false);
    }
    currentRequest = request;
    applyCopy();
    updateConfirmState();
    overlay.hidden = false;
    const focusTarget = request.context === "season" ? input : confirmButton;
    focusTarget.focus();
    return new Promise((resolve) => {
      resolver = resolve;
    });
  };

  cancelButton.addEventListener("click", () => close(false));
  confirmButton.addEventListener("click", () => close(true));
  input.addEventListener("input", updateConfirmState);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close(false);
    }
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close(false);
    }
  });

  onLanguageChange(() => {
    applyCopy();
    updateConfirmState();
  });

  return {
    overlay,
    prompt,
  };
};
