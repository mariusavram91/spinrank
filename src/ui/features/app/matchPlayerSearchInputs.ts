import type { DashboardState } from "../../shared/types/app";

type SlotKey = "teamA1" | "teamA2" | "teamB1" | "teamB2";

const inputTestIdBySlot: Record<SlotKey, string> = {
  teamA1: "match-player-search-team-a-1",
  teamA2: "match-player-search-team-a-2",
  teamB1: "match-player-search-team-b-1",
  teamB2: "match-player-search-team-b-2",
};

type PickerControl = {
  field: HTMLDivElement;
  input: HTMLInputElement;
  clearButton: HTMLButtonElement;
  menu: HTMLDivElement;
  optionsByLabel: Map<string, string>;
  visible: boolean;
  ignoreBlur: boolean;
};

export const createMatchPlayerSearchInputs = (args: {
  dashboardState: DashboardState;
  getCurrentUserId: () => string;
  teamA1Field: HTMLElement;
  teamA2Field: HTMLElement;
  teamB1Field: HTMLElement;
  teamB2Field: HTMLElement;
  teamA1Select: HTMLSelectElement;
  teamA2Select: HTMLSelectElement;
  teamB1Select: HTMLSelectElement;
  teamB2Select: HTMLSelectElement;
}) => {
  const fieldBySlot: Record<SlotKey, HTMLElement> = {
    teamA1: args.teamA1Field,
    teamA2: args.teamA2Field,
    teamB1: args.teamB1Field,
    teamB2: args.teamB2Field,
  };

  const selectBySlot: Record<SlotKey, HTMLSelectElement> = {
    teamA1: args.teamA1Select,
    teamA2: args.teamA2Select,
    teamB1: args.teamB1Select,
    teamB2: args.teamB2Select,
  };

  const getPlayerOptionLabel = (player: DashboardState["players"][number], currentUserId: string): string =>
    `${player.displayName} (${player.elo})${player.userId === currentUserId ? " (You)" : ""}`;

  const getPlayerLabel = (playerId: string): string => {
    const currentUserId = args.getCurrentUserId();
    const player = args.dashboardState.players.find((entry) => entry.userId === playerId);
    return player ? getPlayerOptionLabel(player, currentUserId) : "";
  };

  const getBlockedIds = (slot: SlotKey): string[] => {
    const currentValue = selectBySlot[slot].value;
    return (Object.keys(selectBySlot) as SlotKey[])
      .filter((key) => key !== slot)
      .map((key) => selectBySlot[key].value)
      .filter((value) => Boolean(value) && value !== currentValue);
  };

  const getVisiblePlayers = (slot: SlotKey, query: string): DashboardState["players"] => {
    const currentUserId = args.getCurrentUserId();
    const normalized = query.trim().toLowerCase();
    const blockedIds = new Set(getBlockedIds(slot));
    const currentValue = selectBySlot[slot].value;
    return args.dashboardState.players
      .filter((player) => !blockedIds.has(player.userId) || player.userId === currentValue)
      .filter((player) => {
        if (!normalized) {
          return true;
        }
        const optionLabel = getPlayerOptionLabel(player, currentUserId).toLowerCase();
        return (
          player.displayName.toLowerCase().includes(normalized) ||
          optionLabel.includes(normalized)
        );
      })
      .sort((left, right) => {
        if (!normalized) {
          if (left.userId === currentUserId) {
            return -1;
          }
          if (right.userId === currentUserId) {
            return 1;
          }
        }
        return left.rank - right.rank;
      })
      .slice(0, normalized ? 12 : 8);
  };

  const createPicker = (slot: SlotKey): PickerControl => {
    const field = document.createElement("div");
    field.className = "score-card__player-search-field match-player-search-field";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "text-input score-card__player-search match-player-search-input";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.dataset.testid = inputTestIdBySlot[slot];
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("role", "combobox");

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "score-card__player-search-clear";
    clearButton.setAttribute("aria-label", "Clear player search");
    clearButton.textContent = "x";

    const menu = document.createElement("div");
    menu.className = "score-card__player-search-menu match-player-search-menu";
    menu.hidden = true;

    let control!: PickerControl;

    const updateMenuPlacement = (): void => {
      const viewportHeight = globalThis.visualViewport?.height ?? globalThis.innerHeight;
      const fieldRect = field.getBoundingClientRect();
      const menuHeight = Math.min(menu.scrollHeight || 180, 180);
      const gap = 6;
      const spaceBelow = viewportHeight - fieldRect.bottom;
      const spaceAbove = fieldRect.top;
      const shouldOpenAbove = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow;
      menu.dataset.placement = shouldOpenAbove ? "top" : "bottom";
    };

    const setMenuVisibility = (visible: boolean): void => {
      menu.hidden = !visible;
      field.classList.toggle("score-card__player-search-field--open", visible);
      input.setAttribute("aria-expanded", String(visible));
      control.visible = visible;
      if (visible) {
        requestAnimationFrame(updateMenuPlacement);
      } else {
        delete menu.dataset.placement;
      }
    };

    const updateClearButtonVisibility = (): void => {
      clearButton.hidden = input.value.trim().length === 0;
    };

    const populateOptions = (query: string): void => {
      const currentUserId = args.getCurrentUserId();
      const players = getVisiblePlayers(slot, query);
      control.optionsByLabel = new Map(
        players.map((player) => [getPlayerOptionLabel(player, currentUserId), player.userId]),
      );

      menu.replaceChildren(
        ...(
          players.length > 0
            ? players.map((player) => {
              const option = document.createElement("button");
              option.type = "button";
              option.className = "score-card__player-search-option";
              option.textContent = getPlayerOptionLabel(player, currentUserId);
              option.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                control.ignoreBlur = true;
              });
              option.addEventListener("click", () => {
                input.value = getPlayerOptionLabel(player, currentUserId);
                selectBySlot[slot].value = player.userId;
                updateClearButtonVisibility();
                setMenuVisibility(false);
                selectBySlot[slot].dispatchEvent(new Event("change", { bubbles: true }));
              });
              return option;
            })
            : [(() => {
              const emptyState = document.createElement("div");
              emptyState.className = "score-card__player-search-empty";
              emptyState.textContent = "No players found.";
              return emptyState;
            })()]
        ),
      );
    };

    const syncInputValue = (): void => {
      input.value = getPlayerLabel(selectBySlot[slot].value);
      updateClearButtonVisibility();
      if (control.visible) {
        populateOptions(input.value);
      }
    };

    const commitInputValue = (): void => {
      const nextValue = input.value.trim();
      if (!nextValue) {
        if (selectBySlot[slot].value) {
          selectBySlot[slot].value = "";
          selectBySlot[slot].dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }
        syncInputValue();
        return;
      }

      populateOptions(nextValue);
      const matchedUserId = control.optionsByLabel.get(nextValue);
      if (!matchedUserId) {
        syncInputValue();
        return;
      }
      if (selectBySlot[slot].value !== matchedUserId) {
        selectBySlot[slot].value = matchedUserId;
        selectBySlot[slot].dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      syncInputValue();
    };

    input.addEventListener("focus", () => {
      populateOptions(input.value);
      setMenuVisibility(true);
    });

    input.addEventListener("input", () => {
      populateOptions(input.value);
      updateClearButtonVisibility();
      setMenuVisibility(true);
    });

    input.addEventListener("change", () => {
      commitInputValue();
    });

    input.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (control.ignoreBlur) {
          control.ignoreBlur = false;
          return;
        }
        setMenuVisibility(false);
        syncInputValue();
      }, 0);
    });

    clearButton.addEventListener("click", () => {
      control.ignoreBlur = true;
      input.value = "";
      updateClearButtonVisibility();
      if (selectBySlot[slot].value) {
        selectBySlot[slot].value = "";
        selectBySlot[slot].dispatchEvent(new Event("change", { bubbles: true }));
      }
      populateOptions("");
      setMenuVisibility(true);
      input.focus();
    });

    field.append(input, clearButton, menu);

    control = {
      field,
      input,
      clearButton,
      menu,
      optionsByLabel: new Map<string, string>(),
      visible: false,
      ignoreBlur: false,
    };

    updateClearButtonVisibility();

    globalThis.visualViewport?.addEventListener("resize", () => {
      if (control.visible) {
        requestAnimationFrame(updateMenuPlacement);
      }
    });

    return control;
  };

  const pickerBySlot: Record<SlotKey, PickerControl> = {
    teamA1: createPicker("teamA1"),
    teamA2: createPicker("teamA2"),
    teamB1: createPicker("teamB1"),
    teamB2: createPicker("teamB2"),
  };

  (Object.keys(fieldBySlot) as SlotKey[]).forEach((slot) => {
    const field = fieldBySlot[slot];
    const select = selectBySlot[slot];
    const picker = pickerBySlot[slot];

    select.classList.add("match-player-select--hidden");
    field.append(picker.field);
  });

  const sync = (): void => {
    (Object.keys(selectBySlot) as SlotKey[]).forEach((slot) => {
      const picker = pickerBySlot[slot];
      picker.input.value = getPlayerLabel(selectBySlot[slot].value);
      picker.clearButton.hidden = picker.input.value.trim().length === 0;
      const currentUserId = args.getCurrentUserId();
      const players = getVisiblePlayers(slot, picker.input.matches(":focus") ? picker.input.value : "");
      picker.optionsByLabel = new Map(
        players.map((player) => [getPlayerOptionLabel(player, currentUserId), player.userId]),
      );

      picker.menu.replaceChildren(
        ...(
          players.length > 0
            ? players.map((player) => {
              const option = document.createElement("button");
              option.type = "button";
              option.className = "score-card__player-search-option";
              option.textContent = getPlayerOptionLabel(player, currentUserId);
              option.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                picker.ignoreBlur = true;
              });
              option.addEventListener("click", () => {
                picker.input.value = getPlayerOptionLabel(player, currentUserId);
                selectBySlot[slot].value = player.userId;
                picker.clearButton.hidden = false;
                picker.menu.hidden = true;
                picker.field.classList.remove("score-card__player-search-field--open");
                picker.input.setAttribute("aria-expanded", "false");
                picker.visible = false;
                selectBySlot[slot].dispatchEvent(new Event("change", { bubbles: true }));
              });
              return option;
            })
            : [(() => {
              const emptyState = document.createElement("div");
              emptyState.className = "score-card__player-search-empty";
              emptyState.textContent = "No players found.";
              return emptyState;
            })()]
        ),
      );
    });
  };

  return { sync };
};
