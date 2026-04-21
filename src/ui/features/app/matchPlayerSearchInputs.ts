import type { DashboardState } from "../../shared/types/app";
import type { TextKey } from "../../shared/i18n/translations";

type MatchPlayerEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  elo: number;
  rank: number;
};

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
  searchToken: number;
  creatingGuest: boolean;
};

export const createMatchPlayerSearchInputs = (args: {
  dashboardState: DashboardState;
  t?: (key: TextKey) => string;
  getCurrentUserId: () => string;
  getAllowedMatchPlayerIds: () => string[] | null;
  getMatchPlayerEntries: () => MatchPlayerEntry[];
  searchPlayers?: (query: string) => Promise<MatchPlayerEntry[]>;
  createGuestPlayer?: (displayName: string) => Promise<MatchPlayerEntry | null>;
  formSeasonSelect: HTMLSelectElement;
  formTournamentSelect: HTMLSelectElement;
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

  const rememberedPlayers = new Map<string, MatchPlayerEntry>();

  const rememberPlayers = (players: MatchPlayerEntry[]): void => {
    players.forEach((player) => {
      rememberedPlayers.set(player.userId, player);
    });
  };

  const getAllPlayers = (): MatchPlayerEntry[] => {
    rememberPlayers(args.getMatchPlayerEntries());
    return [...rememberedPlayers.values()];
  };

  const getPlayerOptionLabel = (player: MatchPlayerEntry, currentUserId: string): string =>
    `${player.displayName} (${player.elo})${player.userId === currentUserId ? ` (${args.t ? args.t("youLabel") : "You"})` : ""}`;

  const getPlayerLabel = (playerId: string): string => {
    const currentUserId = args.getCurrentUserId();
    const player = getAllPlayers().find((entry) => entry.userId === playerId);
    return player ? getPlayerOptionLabel(player, currentUserId) : "";
  };

  const getBlockedIds = (slot: SlotKey): string[] => {
    const currentValue = selectBySlot[slot].value;
    return (Object.keys(selectBySlot) as SlotKey[])
      .filter((key) => key !== slot)
      .map((key) => selectBySlot[key].value)
      .filter((value) => Boolean(value) && value !== currentValue);
  };

  const getAvailablePlayers = (): MatchPlayerEntry[] => {
    const matchPlayers = getAllPlayers();
    const allowedIds = new Set(args.getAllowedMatchPlayerIds() ?? matchPlayers.map((player) => player.userId));
    return matchPlayers.filter((player) => allowedIds.has(player.userId));
  };

  const getVisiblePlayersFromEntries = (entries: MatchPlayerEntry[], slot: SlotKey, query: string): MatchPlayerEntry[] => {
    const currentUserId = args.getCurrentUserId();
    const normalized = query.trim().toLowerCase();
    const blockedIds = new Set(getBlockedIds(slot));
    const currentValue = selectBySlot[slot].value;
    return entries
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
      .slice(0, 15);
  };

  const getVisiblePlayers = (slot: SlotKey, query: string): MatchPlayerEntry[] =>
    getVisiblePlayersFromEntries(getAvailablePlayers(), slot, query);

  const ensureSelectHasPlayerOption = (slot: SlotKey, player: MatchPlayerEntry): void => {
    const select = selectBySlot[slot];
    if (Array.from(select.options).some((option) => option.value === player.userId)) {
      return;
    }
    const option = document.createElement("option");
    option.value = player.userId;
    option.textContent = `${player.displayName} (${player.elo})`;
    select.append(option);
  };

  const renderOptions = (control: PickerControl, slot: SlotKey, players: MatchPlayerEntry[]): void => {
    const currentUserId = args.getCurrentUserId();
    control.optionsByLabel = new Map(
      players.map((player) => [getPlayerOptionLabel(player, currentUserId), player.userId]),
    );

    const options: HTMLElement[] = [];
    if (players.length > 0) {
      players.forEach((player) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "score-card__player-search-option";
        option.dataset.testid = "match-player-search-option";
        option.textContent = getPlayerOptionLabel(player, currentUserId);
        option.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          control.ignoreBlur = true;
        });
        option.addEventListener("click", () => {
          ensureSelectHasPlayerOption(slot, player);
          inputBySlot[slot].value = getPlayerOptionLabel(player, currentUserId);
          selectBySlot[slot].value = player.userId;
          clearButtonBySlot[slot].hidden = false;
          setMenuVisibilityBySlot[slot](false);
          selectBySlot[slot].dispatchEvent(new Event("change", { bubbles: true }));
        });
        options.push(option);
      });
    } else {
      const emptyState = document.createElement("div");
      emptyState.className = "score-card__player-search-empty";
      emptyState.textContent = "No players found.";
      options.push(emptyState);

      const guestName = inputBySlot[slot].value.trim();
      if (args.createGuestPlayer && guestName && !args.formTournamentSelect.value) {
        const createGuestOption = document.createElement("button");
        createGuestOption.type = "button";
        createGuestOption.className = "score-card__player-search-option";
        createGuestOption.dataset.testid = "match-player-search-create-guest";
        createGuestOption.textContent = args.t
          ? `${args.t("scoreCardCreateGuestPlayer")}: ${guestName}`
          : `Create guest player: ${guestName}`;
        createGuestOption.disabled = control.creatingGuest;
        createGuestOption.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          control.ignoreBlur = true;
        });
        createGuestOption.addEventListener("click", async () => {
          if (!args.createGuestPlayer || control.creatingGuest) {
            return;
          }
          control.creatingGuest = true;
          createGuestOption.disabled = true;
          createGuestOption.textContent = args.t ? args.t("scoreCardCreatingGuestPlayer") : "Creating guest player...";
          try {
            const createdPlayer = await args.createGuestPlayer(guestName);
            if (!createdPlayer) {
              return;
            }
            rememberPlayers([createdPlayer]);
            ensureSelectHasPlayerOption(slot, createdPlayer);
            const label = getPlayerOptionLabel(createdPlayer, currentUserId);
            inputBySlot[slot].value = label;
            selectBySlot[slot].value = createdPlayer.userId;
            clearButtonBySlot[slot].hidden = false;
            setMenuVisibilityBySlot[slot](false);
            selectBySlot[slot].dispatchEvent(new Event("change", { bubbles: true }));
          } finally {
            control.creatingGuest = false;
          }
        });
        options.push(createGuestOption);
      }
    }

    control.menu.replaceChildren(...options);
  };

  const inputBySlot = {} as Record<SlotKey, HTMLInputElement>;
  const clearButtonBySlot = {} as Record<SlotKey, HTMLButtonElement>;
  const setMenuVisibilityBySlot = {} as Record<SlotKey, (visible: boolean) => void>;

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
    setMenuVisibilityBySlot[slot] = setMenuVisibility;

    const updateClearButtonVisibility = (): void => {
      clearButton.hidden = input.value.trim().length === 0;
    };
    inputBySlot[slot] = input;
    clearButtonBySlot[slot] = clearButton;

    const populateOptions = async (query: string): Promise<void> => {
      renderOptions(control, slot, getVisiblePlayers(slot, query));

      if (!args.searchPlayers || !query.trim() || args.formTournamentSelect.value) {
        return;
      }

      const requestToken = ++control.searchToken;
      try {
        const remotePlayers = await args.searchPlayers(query.trim());
        if (requestToken !== control.searchToken) {
          return;
        }
        rememberPlayers(remotePlayers);
        renderOptions(control, slot, getVisiblePlayers(slot, query));
      } catch {
        if (requestToken !== control.searchToken) {
          return;
        }
      }
    };

    const syncInputValue = (): void => {
      input.value = getPlayerLabel(selectBySlot[slot].value);
      updateClearButtonVisibility();
      if (control.visible) {
        void populateOptions(input.value);
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

      void populateOptions(nextValue);
      const matchedUserId = control.optionsByLabel.get(nextValue);
      if (!matchedUserId) {
        syncInputValue();
        return;
      }
      if (selectBySlot[slot].value !== matchedUserId) {
        const matchedPlayer = getAllPlayers().find((player) => player.userId === matchedUserId);
        if (matchedPlayer) {
          ensureSelectHasPlayerOption(slot, matchedPlayer);
        }
        selectBySlot[slot].value = matchedUserId;
        selectBySlot[slot].dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      syncInputValue();
    };

    input.addEventListener("focus", () => {
      void populateOptions(input.value);
      setMenuVisibility(true);
    });

    input.addEventListener("input", () => {
      void populateOptions(input.value);
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

    clearButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      control.ignoreBlur = true;
    });

    clearButton.addEventListener("click", () => {
      input.value = "";
      updateClearButtonVisibility();
      if (selectBySlot[slot].value) {
        selectBySlot[slot].value = "";
        selectBySlot[slot].dispatchEvent(new Event("change", { bubbles: true }));
      }
      void populateOptions("");
      setMenuVisibility(true);
      input.focus();
      control.ignoreBlur = false;
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
      searchToken: 0,
      creatingGuest: false,
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
      const disabled = selectBySlot[slot].disabled;
      picker.input.value = getPlayerLabel(selectBySlot[slot].value);
      picker.clearButton.hidden = picker.input.value.trim().length === 0;
      picker.input.disabled = disabled;
      picker.clearButton.disabled = disabled;
      const players = getVisiblePlayers(slot, picker.input.matches(":focus") ? picker.input.value : "");
      renderOptions(picker, slot, players);
      const currentValue = selectBySlot[slot].value;
      if (currentValue && !picker.optionsByLabel.size) {
        const matchedPlayer = getAllPlayers().find((player) => player.userId === currentValue);
        if (matchedPlayer) {
          ensureSelectHasPlayerOption(slot, matchedPlayer);
        }
      }
      picker.menu.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        button.disabled = disabled;
      });
    });
  };

  return { sync };
};
