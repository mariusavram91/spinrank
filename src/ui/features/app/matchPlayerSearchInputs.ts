import type { DashboardState } from "../../shared/types/app";

type SlotKey = "teamA1" | "teamA2" | "teamB1" | "teamB2";

type PickerControl = {
  input: HTMLInputElement;
  list: HTMLDataListElement;
  optionsByLabel: Map<string, string>;
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

  let listIdCounter = 0;
  const createPicker = (slot: SlotKey): PickerControl => {
    const input = document.createElement("input");
    input.type = "search";
    input.className = "text-input match-player-search-input";
    input.autocomplete = "off";
    input.spellcheck = false;

    const list = document.createElement("datalist");
    list.id = `match-player-search-${slot}-${++listIdCounter}`;
    input.setAttribute("list", list.id);

    return {
      input,
      list,
      optionsByLabel: new Map<string, string>(),
    };
  };

  const pickerBySlot: Record<SlotKey, PickerControl> = {
    teamA1: createPicker("teamA1"),
    teamA2: createPicker("teamA2"),
    teamB1: createPicker("teamB1"),
    teamB2: createPicker("teamB2"),
  };

  const getPlayerLabel = (playerId: string): string => {
    const player = args.dashboardState.players.find((entry) => entry.userId === playerId);
    return player ? `${player.displayName} (${player.elo})` : "";
  };

  const getBlockedIds = (slot: SlotKey): string[] => {
    const currentValue = selectBySlot[slot].value;
    return (Object.keys(selectBySlot) as SlotKey[])
      .filter((key) => key !== slot)
      .map((key) => selectBySlot[key].value)
      .filter((value) => Boolean(value) && value !== currentValue);
  };

  const getSuggestedPlayers = (slot: SlotKey): DashboardState["players"] => {
    const currentUserId = args.getCurrentUserId();
    const blockedIds = new Set(getBlockedIds(slot));
    const currentValue = selectBySlot[slot].value;
    return [...args.dashboardState.players]
      .filter((player) => !blockedIds.has(player.userId) || player.userId === currentValue)
      .sort((left, right) => {
        if (left.userId === currentUserId) {
          return -1;
        }
        if (right.userId === currentUserId) {
          return 1;
        }
        return left.rank - right.rank;
      })
      .slice(0, 8);
  };

  const getMatchingPlayers = (slot: SlotKey, query: string): DashboardState["players"] => {
    const normalized = query.trim().toLowerCase();
    const blockedIds = new Set(getBlockedIds(slot));
    const currentValue = selectBySlot[slot].value;
    return args.dashboardState.players
      .filter((player) => !blockedIds.has(player.userId) || player.userId === currentValue)
      .filter((player) => {
        if (!normalized) {
          return true;
        }
        const optionLabel = `${player.displayName} (${player.elo})`.toLowerCase();
        return (
          player.displayName.toLowerCase().includes(normalized) ||
          optionLabel.includes(normalized)
        );
      })
      .slice(0, 12);
  };

  const populateOptions = (slot: SlotKey, query: string): void => {
    const picker = pickerBySlot[slot];
    const players = query.trim() ? getMatchingPlayers(slot, query) : getSuggestedPlayers(slot);
    picker.optionsByLabel = new Map(
      players.map((player) => [`${player.displayName} (${player.elo})`, player.userId]),
    );
    picker.list.replaceChildren(
      ...players.map((player) => {
        const option = document.createElement("option");
        option.value = `${player.displayName} (${player.elo})`;
        return option;
      }),
    );
  };

  const dispatchBackingSelectChange = (slot: SlotKey): void => {
    selectBySlot[slot].dispatchEvent(new Event("change", { bubbles: true }));
  };

  const syncInputValue = (slot: SlotKey): void => {
    const picker = pickerBySlot[slot];
    picker.input.value = getPlayerLabel(selectBySlot[slot].value);
  };

  const commitInputValue = (slot: SlotKey): void => {
    const picker = pickerBySlot[slot];
    const nextValue = picker.input.value.trim();
    if (!nextValue) {
      if (selectBySlot[slot].value) {
        selectBySlot[slot].value = "";
        dispatchBackingSelectChange(slot);
      } else {
        syncInputValue(slot);
      }
      return;
    }

    populateOptions(slot, nextValue);
    const matchedUserId = picker.optionsByLabel.get(nextValue) || "";
    if (!matchedUserId) {
      syncInputValue(slot);
      return;
    }
    if (selectBySlot[slot].value !== matchedUserId) {
      selectBySlot[slot].value = matchedUserId;
      dispatchBackingSelectChange(slot);
      return;
    }
    syncInputValue(slot);
  };

  (Object.keys(fieldBySlot) as SlotKey[]).forEach((slot) => {
    const field = fieldBySlot[slot];
    const select = selectBySlot[slot];
    const picker = pickerBySlot[slot];

    select.classList.add("match-player-select--hidden");
    field.append(picker.input, picker.list);

    picker.input.addEventListener("focus", () => {
      populateOptions(slot, picker.input.value);
    });

    picker.input.addEventListener("input", () => {
      populateOptions(slot, picker.input.value);
    });

    picker.input.addEventListener("change", () => {
      commitInputValue(slot);
    });

    picker.input.addEventListener("blur", () => {
      window.setTimeout(() => {
        syncInputValue(slot);
      }, 0);
    });
  });

  const sync = (): void => {
    (Object.keys(selectBySlot) as SlotKey[]).forEach((slot) => {
      populateOptions(slot, pickerBySlot[slot].input.value);
      syncInputValue(slot);
    });
  };

  return { sync };
};
