import type { ParticipantSearchEntry } from "../../../api/contract";
import type { DashboardState, TournamentPlannerMatch, TournamentPlannerState } from "../../shared/types/app";
import type { RunAuthedAction } from "../../shared/types/actions";
import type { TextKey } from "../../shared/i18n/translations";

export const createParticipantEditors = (args: {
  dashboardState: DashboardState;
  tournamentPlannerState: TournamentPlannerState;
  getEditingSeason: () => DashboardState["seasons"][number] | undefined;
  getEditingTournament: () => DashboardState["tournaments"][number] | undefined;
  getSessionUserId: () => string;
  isLockedSeason: (season: DashboardState["seasons"][number] | undefined) => boolean;
  isLockedTournament: (tournament: DashboardState["tournaments"][number] | undefined) => boolean;
  seasonParticipantList: HTMLElement;
  seasonParticipantSearchInput: HTMLInputElement;
  seasonParticipantResults: HTMLElement;
  participantList: HTMLElement;
  participantSearchInput: HTMLInputElement;
  participantSearchResults: HTMLElement;
  bracketBoard: HTMLElement;
  tournamentSeasonSelect: HTMLSelectElement;
  loadTournamentSelect: HTMLSelectElement;
  setTournamentSharePanelTargetId: (segmentId: string) => void;
  syncDashboardState: () => void;
  runAuthedAction: RunAuthedAction;
  renderPlayerNames: (playerIds: string[], players: DashboardState["players"]) => string;
  findPlayer: (playerId: string | null | undefined, players: DashboardState["players"]) => DashboardState["players"][number] | undefined;
  advanceTournamentBye: (roundIndex: number, matchIndex: number) => Promise<void>;
  prefillMatchFromTournamentPairing: (match: TournamentPlannerMatch) => void;
  assetsBaseUrl: string;
  t: (key: TextKey) => string;
}) => {
  const knownParticipants = new Map<string, ParticipantSearchEntry>();
  let seasonSearchToken = 0;
  let tournamentSearchToken = 0;

  const setParticipantAvatarImage = (
    image: HTMLImageElement,
    participant: Pick<ParticipantSearchEntry, "avatarUrl" | "displayName"> | null | undefined,
  ): void => {
    image.alt = participant?.displayName || "Participant";
    image.onerror = () => {
      image.onerror = null;
      image.src = `${args.assetsBaseUrl}assets/logo.png`;
    };
    image.src = participant?.avatarUrl || `${args.assetsBaseUrl}assets/logo.png`;
  };

  const syncKnownParticipants = (): void => {
    args.dashboardState.players.forEach((player) => {
      knownParticipants.set(player.userId, {
        userId: player.userId,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
        elo: player.elo,
        isSuggested: false,
      });
    });
  };

  const rememberParticipants = (participants: ParticipantSearchEntry[]): void => {
    participants.forEach((participant) => {
      knownParticipants.set(participant.userId, participant);
    });
  };

  const getKnownParticipant = (userId: string): ParticipantSearchEntry | null => {
    syncKnownParticipants();
    return knownParticipants.get(userId) ?? null;
  };

  const getParticipantLabel = (userId: string | null | undefined): string => {
    if (!userId) {
      return "";
    }
    const participant = getKnownParticipant(userId);
    if (participant) {
      return `${participant.displayName} (${participant.elo})`;
    }
    const fallback = args.findPlayer(userId, args.dashboardState.players);
    return fallback ? `${fallback.displayName} (${fallback.elo})` : "Unknown player";
  };

  const isTournamentParticipantEditingLocked = (): boolean => {
    const tournament = args.getEditingTournament();
    if (!tournament) {
      return false;
    }
    return (
      args.isLockedTournament(tournament) ||
      tournament.bracketStatus === "in_progress" ||
      tournament.bracketStatus === "completed"
    );
  };

  const buildSelectedParticipantChip = (participantId: string, locked: boolean, onRemove: () => void): HTMLElement => {
    const participant = getKnownParticipant(participantId);
    const chip = document.createElement("article");
    chip.className = "participant-chip participant-chip--selected";
    chip.dataset.testid = "participant-chip";
    chip.dataset.participantId = participantId;

    const avatar = document.createElement("img");
    avatar.className = "player-avatar player-avatar-small";
    setParticipantAvatarImage(avatar, participant);

    const content = document.createElement("div");
    content.className = "participant-chip__content";

    const name = document.createElement("strong");
    name.className = "participant-chip__name";
    name.textContent = participant?.displayName || "Unknown player";

    const meta = document.createElement("span");
    meta.className = "participant-chip__meta";
    meta.textContent = participant ? `Elo ${participant.elo}` : "";

    content.append(name, meta);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "secondary-button participant-chip__action";
    action.textContent = locked ? args.t("participantLockedLabel") : args.t("participantRemove");
    action.disabled = locked;
    action.dataset.testid = "participant-remove-button";
    action.addEventListener("click", onRemove);

    chip.append(avatar, content, action);
    return chip;
  };

  const buildSearchResultRow = (
    participant: ParticipantSearchEntry,
    selected: boolean,
    locked: boolean,
    onAdd: () => void,
  ): HTMLElement => {
    const row = document.createElement("article");
    row.className = "participant-chip participant-chip--search";
    row.dataset.testid = "participant-search-result";

    const avatar = document.createElement("img");
    avatar.className = "player-avatar player-avatar-small";
    setParticipantAvatarImage(avatar, participant);

    const content = document.createElement("div");
    content.className = "participant-chip__content";

    const name = document.createElement("strong");
    name.className = "participant-chip__name";
    name.textContent = participant.displayName;

    const meta = document.createElement("span");
    meta.className = "participant-chip__meta";
    meta.textContent = participant.isSuggested
      ? `${args.t("participantSuggestedLabel")} • Elo ${participant.elo}`
      : `Elo ${participant.elo}`;

    content.append(name, meta);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "primary-button participant-chip__action";
    action.textContent = selected ? args.t("participantAddedLabel") : args.t("participantAdd");
    action.disabled = selected || locked;
    action.dataset.testid = "participant-add-button";
    action.addEventListener("click", onAdd);

    row.append(avatar, content, action);
    return row;
  };

  const renderEmptyState = (label: string): HTMLElement => {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = label;
    return empty;
  };

  const getSeasonSearchLimit = (): number => 12;

  const getTournamentSearchLimit = (): number => 12;

  const refreshSeasonParticipantResults = async (): Promise<void> => {
    const requestToken = ++seasonSearchToken;
    args.dashboardState.seasonParticipantSearchLoading = true;
    args.dashboardState.seasonParticipantSearchError = "";
    renderSeasonSearchResults();
    args.syncDashboardState();

    try {
      const data = await args.runAuthedAction("searchParticipants", {
        segmentType: "season",
        query: args.dashboardState.seasonParticipantQuery,
        limit: getSeasonSearchLimit(),
      });
      if (requestToken !== seasonSearchToken) {
        return;
      }
      rememberParticipants(data.participants);
      args.dashboardState.seasonParticipantResults = data.participants;
      args.dashboardState.seasonParticipantSearchError = "";
    } catch (error) {
      if (requestToken !== seasonSearchToken) {
        return;
      }
      args.dashboardState.seasonParticipantResults = [];
      args.dashboardState.seasonParticipantSearchError =
        error instanceof Error ? error.message : args.t("participantSearchError");
    } finally {
      if (requestToken === seasonSearchToken) {
        args.dashboardState.seasonParticipantSearchLoading = false;
        renderSeasonSearchResults();
        args.syncDashboardState();
      }
    }
  };

  const refreshTournamentParticipantResults = async (): Promise<void> => {
    const requestToken = ++tournamentSearchToken;
    args.tournamentPlannerState.participantSearchLoading = true;
    args.tournamentPlannerState.participantSearchError = "";
    renderTournamentSearchResults();
    args.syncDashboardState();

    try {
      const data = await args.runAuthedAction("searchParticipants", {
        segmentType: "tournament",
        query: args.tournamentPlannerState.participantQuery,
        seasonId: args.tournamentSeasonSelect.value || null,
        limit: getTournamentSearchLimit(),
      });
      if (requestToken !== tournamentSearchToken) {
        return;
      }
      rememberParticipants(data.participants);
      args.tournamentPlannerState.participantResults = data.participants;
      args.tournamentPlannerState.participantSearchError = "";
    } catch (error) {
      if (requestToken !== tournamentSearchToken) {
        return;
      }
      args.tournamentPlannerState.participantResults = [];
      args.tournamentPlannerState.participantSearchError =
        error instanceof Error ? error.message : args.t("participantSearchError");
    } finally {
      if (requestToken === tournamentSearchToken) {
        args.tournamentPlannerState.participantSearchLoading = false;
        renderTournamentSearchResults();
        args.syncDashboardState();
      }
    }
  };

  const renderSeasonSearchResults = (): void => {
    const locked = args.isLockedSeason(args.getEditingSeason());
    const selected = new Set(args.dashboardState.editingSeasonParticipantIds);
    const visibleResults = args.dashboardState.seasonParticipantResults.filter(
      (participant) => !selected.has(participant.userId),
    );

    if (args.dashboardState.seasonParticipantSearchLoading) {
      args.seasonParticipantResults.replaceChildren(renderEmptyState(args.t("participantSearchLoading")));
      return;
    }

    if (args.dashboardState.seasonParticipantSearchError) {
      const error = document.createElement("p");
      error.className = "form-status";
      error.dataset.status = "error";
      error.textContent = args.dashboardState.seasonParticipantSearchError;
      args.seasonParticipantResults.replaceChildren(error);
      return;
    }

    if (visibleResults.length === 0) {
      const emptyKey = args.dashboardState.seasonParticipantQuery
        ? "participantNoSearchResults"
        : "participantNoSuggestions";
      args.seasonParticipantResults.replaceChildren(renderEmptyState(args.t(emptyKey)));
      return;
    }

    const rows = visibleResults.map((participant) =>
      buildSearchResultRow(
        participant,
        false,
        locked,
        () => {
          if (locked || selected.has(participant.userId)) {
            return;
          }
          args.dashboardState.editingSeasonParticipantIds = [
            ...args.dashboardState.editingSeasonParticipantIds,
            participant.userId,
          ];
          args.dashboardState.seasonFormError = "";
          args.dashboardState.seasonFormMessage = "";
          renderSeasonEditor();
          args.syncDashboardState();
        },
      ),
    );
    args.seasonParticipantResults.replaceChildren(...rows);
  };

  const renderTournamentSearchResults = (): void => {
    const locked = isTournamentParticipantEditingLocked();
    const selected = new Set(args.tournamentPlannerState.participantIds);
    const visibleResults = args.tournamentPlannerState.participantResults.filter(
      (participant) => !selected.has(participant.userId),
    );

    if (args.tournamentPlannerState.participantSearchLoading) {
      args.participantSearchResults.replaceChildren(renderEmptyState(args.t("participantSearchLoading")));
      return;
    }

    if (args.tournamentPlannerState.participantSearchError) {
      const error = document.createElement("p");
      error.className = "form-status";
      error.dataset.status = "error";
      error.textContent = args.tournamentPlannerState.participantSearchError;
      args.participantSearchResults.replaceChildren(error);
      return;
    }

    if (visibleResults.length === 0) {
      const emptyKey = args.tournamentPlannerState.participantQuery
        ? "participantNoSearchResults"
        : "participantNoSuggestions";
      args.participantSearchResults.replaceChildren(renderEmptyState(args.t(emptyKey)));
      return;
    }

    const rows = visibleResults.map((participant) =>
      buildSearchResultRow(
        participant,
        false,
        locked,
        () => {
          if (locked || selected.has(participant.userId)) {
            return;
          }
          args.tournamentPlannerState.participantIds = [...args.tournamentPlannerState.participantIds, participant.userId];
          args.tournamentPlannerState.tournamentId = "";
          args.setTournamentSharePanelTargetId("");
          args.tournamentPlannerState.error = "";
          args.tournamentPlannerState.rounds = [];
          args.tournamentPlannerState.firstRoundMatches = [];
          args.loadTournamentSelect.value = "";
          renderTournamentPlanner();
          args.syncDashboardState();
        },
      ),
    );
    args.participantSearchResults.replaceChildren(...rows);
  };

  const renderSeasonEditor = (): void => {
    syncKnownParticipants();
    args.seasonParticipantSearchInput.value = args.dashboardState.seasonParticipantQuery;
    args.seasonParticipantSearchInput.disabled = args.isLockedSeason(args.getEditingSeason());

    const sessionUserId = args.getSessionUserId();
    const locked = args.isLockedSeason(args.getEditingSeason());
    const selectedIds = args.dashboardState.editingSeasonParticipantIds;

    if (selectedIds.length === 0) {
      args.seasonParticipantList.replaceChildren(renderEmptyState(args.t("participantSelectedEmpty")));
    } else {
      const chips = selectedIds.map((participantId) =>
        buildSelectedParticipantChip(participantId, locked || participantId === sessionUserId, () => {
          if (locked || participantId === sessionUserId) {
            return;
          }
          args.dashboardState.editingSeasonParticipantIds = args.dashboardState.editingSeasonParticipantIds.filter(
            (currentId) => currentId !== participantId,
          );
          args.dashboardState.seasonFormError = "";
          args.dashboardState.seasonFormMessage = "";
          renderSeasonEditor();
          args.syncDashboardState();
        }),
      );
      args.seasonParticipantList.replaceChildren(...chips);
    }

    renderSeasonSearchResults();
    if (
      !args.dashboardState.seasonParticipantSearchLoading &&
      args.dashboardState.seasonParticipantResults.length === 0 &&
      !args.dashboardState.seasonParticipantSearchError
    ) {
      void refreshSeasonParticipantResults();
    }
  };

  const renderTournamentPlanner = (): void => {
    syncKnownParticipants();
    args.participantSearchInput.value = args.tournamentPlannerState.participantQuery;
    const sessionUserId = args.getSessionUserId();

    const seasonId = args.tournamentSeasonSelect.value;
    const seasonParticipantIds = seasonId
      ? new Set(
          args.dashboardState.seasons.find((entry) => entry.id === seasonId)?.participantIds || [],
        )
      : null;
    const editingTournament = args.getEditingTournament();
    const tournamentLocked = args.isLockedTournament(editingTournament);
    const participantEditingLocked = isTournamentParticipantEditingLocked();

    if (seasonParticipantIds) {
      args.tournamentPlannerState.participantIds = args.tournamentPlannerState.participantIds.filter((participantId) =>
        seasonParticipantIds.has(participantId),
      );
    }
    if (sessionUserId && !args.tournamentPlannerState.participantIds.includes(sessionUserId)) {
      args.tournamentPlannerState.participantIds = [sessionUserId, ...args.tournamentPlannerState.participantIds];
    }

    args.participantSearchInput.disabled = participantEditingLocked;

    if (args.tournamentPlannerState.participantIds.length === 0) {
      args.participantList.replaceChildren(renderEmptyState(args.t("participantSelectedEmpty")));
    } else {
      const chips = args.tournamentPlannerState.participantIds.map((participantId) =>
        buildSelectedParticipantChip(participantId, participantEditingLocked || participantId === sessionUserId, () => {
          if (participantEditingLocked || participantId === sessionUserId) {
            return;
          }
          args.tournamentPlannerState.participantIds = args.tournamentPlannerState.participantIds.filter(
            (currentId) => currentId !== participantId,
          );
          args.tournamentPlannerState.tournamentId = "";
          args.setTournamentSharePanelTargetId("");
          args.tournamentPlannerState.error = "";
          args.tournamentPlannerState.rounds = [];
          args.tournamentPlannerState.firstRoundMatches = [];
          args.loadTournamentSelect.value = "";
          renderTournamentPlanner();
          args.syncDashboardState();
        }),
      );
      args.participantList.replaceChildren(...chips);
    }

    renderTournamentSearchResults();
    if (
      !args.tournamentPlannerState.participantSearchLoading &&
      args.tournamentPlannerState.participantResults.length === 0 &&
      !args.tournamentPlannerState.participantSearchError
    ) {
      void refreshTournamentParticipantResults();
    }

    if (args.tournamentPlannerState.rounds.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = args.t("bracketPreviewEmpty");
      args.bracketBoard.replaceChildren(empty);
      return;
    }

    const selectedParticipants = new Set(args.tournamentPlannerState.participantIds);
    const playerOptions = args.tournamentPlannerState.participantIds
      .map((participantId) => getKnownParticipant(participantId))
      .filter((participant): participant is ParticipantSearchEntry => Boolean(participant));

    const roundColumns = args.tournamentPlannerState.rounds.map((round, roundIndex) => {
      const column = document.createElement("section");
      column.className = "bracket-round";

      const title = document.createElement("h4");
      title.className = "card-title";
      title.textContent = round.title;

      const matchNodes = round.matches.map((match, matchIndex) => {
        const cardNode = document.createElement("article");
        cardNode.className = "bracket-match";

        if (roundIndex === 0) {
          const usedIds = args.tournamentPlannerState.firstRoundMatches.flatMap((entry) => [
            entry.leftPlayerId,
            entry.rightPlayerId,
          ]);

          const createMatchSelect = (
            currentValue: string | null,
            onChange: (value: string | null) => void,
          ): HTMLSelectElement => {
            const select = document.createElement("select");
            select.className = "select-input";

            const options = [
              { value: "", label: "Auto-advance" },
              ...playerOptions
                .filter((player) => selectedParticipants.has(player.userId))
                .map((player) => ({
                  value: player.userId,
                  label: `${player.displayName} (${player.elo})`,
                })),
            ];

            select.replaceChildren(
              ...options.map((option) => {
                const node = document.createElement("option");
                node.value = option.value;
                node.textContent = option.label;
                node.selected = option.value === (currentValue || "");
                node.disabled =
                  participantEditingLocked ||
                  option.value !== "" &&
                  option.value !== (currentValue || "") &&
                  usedIds.indexOf(option.value) !== -1;
                return node;
              }),
            );

            select.disabled =
              participantEditingLocked ||
              Boolean(match.createdMatchId) ||
              Boolean(match.locked) ||
              Boolean(match.winnerPlayerId);
            select.title = select.disabled ? "Locked after bracket advancement" : "";

            select.addEventListener("change", () => {
              onChange(select.value || null);
              args.tournamentPlannerState.error = "";
              renderTournamentPlanner();
              args.syncDashboardState();
            });

            return select;
          };

          const leftSelect = createMatchSelect(match.leftPlayerId, (value) => {
            args.tournamentPlannerState.firstRoundMatches[matchIndex].leftPlayerId = value;
          });
          const rightSelect = createMatchSelect(match.rightPlayerId, (value) => {
            args.tournamentPlannerState.firstRoundMatches[matchIndex].rightPlayerId = value;
          });

          cardNode.append(leftSelect, rightSelect);
        } else {
          const previousRound = args.tournamentPlannerState.rounds[roundIndex - 1];
          const previousLeftMatch = previousRound?.matches[matchIndex * 2];
          const previousRightMatch = previousRound?.matches[matchIndex * 2 + 1];
          const canRevealLeft = Boolean(previousLeftMatch?.winnerPlayerId);
          const canRevealRight = Boolean(previousRightMatch?.winnerPlayerId);
          const visibleLeftPlayerId = canRevealLeft ? match.leftPlayerId : null;
          const visibleRightPlayerId = canRevealRight ? match.rightPlayerId : null;

          const left = document.createElement("p");
          left.className = "match-subline";
          const leftText = visibleLeftPlayerId
            ? getParticipantLabel(visibleLeftPlayerId)
            : `Winner ${args.tournamentPlannerState.rounds[roundIndex - 1].title} ${matchIndex * 2 + 1}`;
          const leftPlayer = getKnownParticipant(visibleLeftPlayerId || "");
          const leftAvatar = document.createElement("img");
          leftAvatar.className = "player-avatar player-avatar-small";
          setParticipantAvatarImage(leftAvatar, leftPlayer);
          const leftLabel = document.createElement("span");
          leftLabel.textContent =
            round.title === "Final" && visibleLeftPlayerId && match.winnerPlayerId === visibleLeftPlayerId
              ? `🏆 ${leftText}`
              : leftText;
          if (round.title === "Final" && visibleLeftPlayerId && match.winnerPlayerId === visibleLeftPlayerId) {
            left.classList.add("tournament-winner");
          }
          left.append(leftAvatar, leftLabel);

          const right = document.createElement("p");
          right.className = "match-subline";
          const rightText = visibleRightPlayerId
            ? getParticipantLabel(visibleRightPlayerId)
            : `Winner ${args.tournamentPlannerState.rounds[roundIndex - 1].title} ${matchIndex * 2 + 2}`;
          const rightPlayer = getKnownParticipant(visibleRightPlayerId || "");
          const rightAvatar = document.createElement("img");
          rightAvatar.className = "player-avatar player-avatar-small";
          setParticipantAvatarImage(rightAvatar, rightPlayer);
          const rightLabel = document.createElement("span");
          rightLabel.textContent =
            round.title === "Final" && visibleRightPlayerId && match.winnerPlayerId === visibleRightPlayerId
              ? `🏆 ${rightText}`
              : rightText;
          if (round.title === "Final" && visibleRightPlayerId && match.winnerPlayerId === visibleRightPlayerId) {
            right.classList.add("tournament-winner");
          }
          right.append(rightAvatar, rightLabel);

          cardNode.append(left, right);
        }

        const hasSinglePlayer = Boolean(match.leftPlayerId) !== Boolean(match.rightPlayerId);
        if (hasSinglePlayer && roundIndex === 0) {
          const advanceButton = document.createElement("button");
          advanceButton.type = "button";
          advanceButton.className = "secondary-button bracket-action";
          advanceButton.textContent = match.winnerPlayerId ? "Advanced" : "Advance";
          advanceButton.disabled = !!match.winnerPlayerId || tournamentLocked;
          advanceButton.addEventListener("click", () => {
            void args.advanceTournamentBye(roundIndex, matchIndex);
          });
          cardNode.append(advanceButton);
        } else if (
          match.leftPlayerId &&
          match.rightPlayerId &&
          (roundIndex === 0 ||
            (Boolean(args.tournamentPlannerState.rounds[roundIndex - 1]?.matches[matchIndex * 2]?.winnerPlayerId) &&
              Boolean(args.tournamentPlannerState.rounds[roundIndex - 1]?.matches[matchIndex * 2 + 1]?.winnerPlayerId)))
        ) {
          const createMatchButton = document.createElement("button");
          createMatchButton.type = "button";
          createMatchButton.className = "secondary-button bracket-action";
          createMatchButton.textContent = match.createdMatchId ? "Match created" : "Create match";
          createMatchButton.disabled =
            !!match.createdMatchId || !args.tournamentPlannerState.tournamentId || tournamentLocked;
          createMatchButton.addEventListener("click", () => {
            args.prefillMatchFromTournamentPairing(match);
          });
          cardNode.append(createMatchButton);
        }

        return cardNode;
      });

      column.append(title, ...matchNodes);
      return column;
    });

    args.bracketBoard.replaceChildren(...roundColumns);
  };

  args.seasonParticipantSearchInput.addEventListener("input", () => {
    seasonSearchToken += 1;
    args.dashboardState.seasonParticipantQuery = args.seasonParticipantSearchInput.value.trim();
    args.dashboardState.seasonParticipantResults = [];
    args.dashboardState.seasonParticipantSearchLoading = false;
    args.dashboardState.seasonParticipantSearchError = "";
    renderSeasonEditor();
  });

  args.participantSearchInput.addEventListener("input", () => {
    tournamentSearchToken += 1;
    args.tournamentPlannerState.participantQuery = args.participantSearchInput.value.trim();
    args.tournamentPlannerState.participantResults = [];
    args.tournamentPlannerState.participantSearchLoading = false;
    args.tournamentPlannerState.participantSearchError = "";
    renderTournamentSearchResults();
    void refreshTournamentParticipantResults();
  });

  args.tournamentSeasonSelect.addEventListener("change", () => {
    tournamentSearchToken += 1;
    args.tournamentPlannerState.participantResults = [];
    args.tournamentPlannerState.participantSearchLoading = false;
    args.tournamentPlannerState.participantSearchError = "";
    renderTournamentPlanner();
  });

  return {
    renderSeasonEditor,
    renderTournamentPlanner,
  };
};
