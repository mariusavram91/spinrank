import type { DashboardState, TournamentPlannerMatch, TournamentPlannerState } from "../../shared/types/app";
import type { TextKey } from "../../shared/i18n/translations";
import { setAvatarImage } from "../../shared/utils/avatar";

export const createParticipantEditors = (args: {
  dashboardState: DashboardState;
  tournamentPlannerState: TournamentPlannerState;
  getEditingSeason: () => DashboardState["seasons"][number] | undefined;
  getEditingTournament: () => DashboardState["tournaments"][number] | undefined;
  getSessionUserId: () => string;
  isLockedSeason: (season: DashboardState["seasons"][number] | undefined) => boolean;
  isLockedTournament: (tournament: DashboardState["tournaments"][number] | undefined) => boolean;
  seasonParticipantList: HTMLElement;
  seasonSelectAllParticipantsInput: HTMLInputElement;
  participantList: HTMLElement;
  tournamentSelectAllParticipantsInput: HTMLInputElement;
  bracketBoard: HTMLElement;
  loadTournamentSelect: HTMLSelectElement;
  setTournamentSharePanelTargetId: (segmentId: string) => void;
  syncDashboardState: () => void;
  renderPlayerNames: (playerIds: string[], players: DashboardState["players"]) => string;
  findPlayer: (playerId: string | null | undefined, players: DashboardState["players"]) => DashboardState["players"][number] | undefined;
  advanceTournamentBye: (roundIndex: number, matchIndex: number) => Promise<void>;
  prefillMatchFromTournamentPairing: (match: TournamentPlannerMatch) => void;
  assetsBaseUrl: string;
  t: (key: TextKey) => string;
}) => {
  const getSelectableSeasonParticipantIds = (): string[] => {
    const locked = args.isLockedSeason(args.getEditingSeason());
    if (locked) {
      return [];
    }
    const sessionUserId = args.getSessionUserId();
    return args.dashboardState.players
      .filter((player) => player.userId !== sessionUserId)
      .map((player) => player.userId);
  };

  const updateSeasonSelectAllState = (): void => {
    const selectableIds = getSelectableSeasonParticipantIds();
    const locked = args.isLockedSeason(args.getEditingSeason());
    args.seasonSelectAllParticipantsInput.disabled = locked || selectableIds.length === 0;

    if (selectableIds.length === 0) {
      args.seasonSelectAllParticipantsInput.checked = false;
      args.seasonSelectAllParticipantsInput.indeterminate = false;
      return;
    }

    const selectedSet = new Set(args.dashboardState.editingSeasonParticipantIds);
    const selectedCount = selectableIds.filter((id) => selectedSet.has(id)).length;
    args.seasonSelectAllParticipantsInput.checked = selectedCount === selectableIds.length;
    args.seasonSelectAllParticipantsInput.indeterminate = selectedCount > 0 && selectedCount < selectableIds.length;
  };

  const getSelectableTournamentParticipantIds = (): string[] => {
    const locked = args.isLockedTournament(args.getEditingTournament());
    if (locked) {
      return [];
    }
    return args.dashboardState.players.map((player) => player.userId);
  };

  const updateTournamentSelectAllState = (): void => {
    const selectableIds = getSelectableTournamentParticipantIds();
    const locked = args.isLockedTournament(args.getEditingTournament());
    args.tournamentSelectAllParticipantsInput.disabled = locked || selectableIds.length === 0;

    if (selectableIds.length === 0) {
      args.tournamentSelectAllParticipantsInput.checked = false;
      args.tournamentSelectAllParticipantsInput.indeterminate = false;
      return;
    }

    const selectedSet = new Set(args.tournamentPlannerState.participantIds);
    const selectedCount = selectableIds.filter((id) => selectedSet.has(id)).length;
    args.tournamentSelectAllParticipantsInput.checked = selectedCount === selectableIds.length;
    args.tournamentSelectAllParticipantsInput.indeterminate =
      selectedCount > 0 && selectedCount < selectableIds.length;
  };

  const renderSeasonEditor = (): void => {
    const selectedParticipants = new Set(args.dashboardState.editingSeasonParticipantIds);
    const sessionUserId = args.getSessionUserId();
    const locked = args.isLockedSeason(args.getEditingSeason());

    const participantCards = args.dashboardState.players.map((player) => {
      const label = document.createElement("label");
      label.className = "participant-chip";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedParticipants.has(player.userId);
      input.disabled = player.userId === sessionUserId || locked;
      input.addEventListener("change", () => {
        if (input.checked) {
          args.dashboardState.editingSeasonParticipantIds = [
            ...args.dashboardState.editingSeasonParticipantIds,
            player.userId,
          ];
        } else {
          args.dashboardState.editingSeasonParticipantIds = args.dashboardState.editingSeasonParticipantIds.filter(
            (participantId) => participantId !== player.userId,
          );
        }
        args.dashboardState.seasonFormError = "";
        args.dashboardState.seasonFormMessage = "";
        renderSeasonEditor();
        args.syncDashboardState();
      });

      const text = document.createElement("span");
      text.textContent = `${player.displayName} (${player.elo})`;

      label.append(input, text);
      return label;
    });

    args.seasonParticipantList.replaceChildren(...participantCards);
    updateSeasonSelectAllState();
  };

  const renderTournamentPlanner = (): void => {
    const selectedParticipants = new Set(args.tournamentPlannerState.participantIds);
    const playerOptions = args.dashboardState.players;
    const editingTournament = args.getEditingTournament();
    const tournamentLocked = args.isLockedTournament(editingTournament);

    const participantCards = playerOptions.map((player) => {
      const label = document.createElement("label");
      label.className = "participant-chip";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedParticipants.has(player.userId);
      input.disabled = tournamentLocked;
      input.addEventListener("change", () => {
        if (input.checked) {
          args.tournamentPlannerState.participantIds = [...args.tournamentPlannerState.participantIds, player.userId];
        } else {
          args.tournamentPlannerState.participantIds = args.tournamentPlannerState.participantIds.filter(
            (participantId) => participantId !== player.userId,
          );
        }
        args.tournamentPlannerState.tournamentId = "";
        args.setTournamentSharePanelTargetId("");
        args.tournamentPlannerState.error = "";
        args.tournamentPlannerState.rounds = [];
        args.tournamentPlannerState.firstRoundMatches = [];
        args.loadTournamentSelect.value = "";
        renderTournamentPlanner();
        args.syncDashboardState();
      });

      const text = document.createElement("span");
      text.textContent = `${player.displayName} (${player.elo})`;

      label.append(input, text);
      return label;
    });

    args.participantList.replaceChildren(...participantCards);

    if (args.tournamentPlannerState.rounds.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = args.t("bracketPreviewEmpty");
      args.bracketBoard.replaceChildren(empty);
      updateTournamentSelectAllState();
      return;
    }

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
                  option.value !== "" &&
                  option.value !== (currentValue || "") &&
                  usedIds.indexOf(option.value) !== -1;
                return node;
              }),
            );

            select.disabled =
              tournamentLocked ||
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
          const left = document.createElement("p");
          left.className = "match-subline";
          const leftText = match.leftPlayerId
            ? args.renderPlayerNames([match.leftPlayerId], args.dashboardState.players)
            : `Winner ${args.tournamentPlannerState.rounds[roundIndex - 1].title} ${matchIndex * 2 + 1}`;
          const leftPlayer = args.findPlayer(match.leftPlayerId, args.dashboardState.players);
          const leftAvatar = document.createElement("img");
          leftAvatar.className = "player-avatar player-avatar-small";
          setAvatarImage(
            leftAvatar,
            leftPlayer?.userId,
            leftPlayer?.avatarUrl,
            `${args.assetsBaseUrl}assets/logo.png`,
            leftText,
          );
          const leftLabel = document.createElement("span");
          leftLabel.textContent =
            round.title === "Final" && match.winnerPlayerId === match.leftPlayerId
              ? `🏆 ${leftText}`
              : leftText;
          if (round.title === "Final" && match.winnerPlayerId === match.leftPlayerId) {
            left.classList.add("tournament-winner");
          }
          left.append(leftAvatar, leftLabel);

          const right = document.createElement("p");
          right.className = "match-subline";
          const rightText = match.rightPlayerId
            ? args.renderPlayerNames([match.rightPlayerId], args.dashboardState.players)
            : `Winner ${args.tournamentPlannerState.rounds[roundIndex - 1].title} ${matchIndex * 2 + 2}`;
          const rightPlayer = args.findPlayer(match.rightPlayerId, args.dashboardState.players);
          const rightAvatar = document.createElement("img");
          rightAvatar.className = "player-avatar player-avatar-small";
          setAvatarImage(
            rightAvatar,
            rightPlayer?.userId,
            rightPlayer?.avatarUrl,
            `${args.assetsBaseUrl}assets/logo.png`,
            rightText,
          );
          const rightLabel = document.createElement("span");
          rightLabel.textContent =
            round.title === "Final" && match.winnerPlayerId === match.rightPlayerId
              ? `🏆 ${rightText}`
              : rightText;
          if (round.title === "Final" && match.winnerPlayerId === match.rightPlayerId) {
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
        } else if (match.leftPlayerId && match.rightPlayerId) {
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
    updateTournamentSelectAllState();
  };

  const onSeasonSelectAllChange = (): void => {
    if (args.seasonSelectAllParticipantsInput.disabled) {
      return;
    }
    const selectableIds = getSelectableSeasonParticipantIds();
    if (args.seasonSelectAllParticipantsInput.checked) {
      const nextIds = new Set(args.dashboardState.editingSeasonParticipantIds);
      selectableIds.forEach((id) => nextIds.add(id));
      args.dashboardState.editingSeasonParticipantIds = Array.from(nextIds);
    } else {
      args.dashboardState.editingSeasonParticipantIds = args.dashboardState.editingSeasonParticipantIds.filter(
        (participantId) => !selectableIds.includes(participantId),
      );
    }
    args.dashboardState.seasonFormError = "";
    args.dashboardState.seasonFormMessage = "";
    renderSeasonEditor();
    args.syncDashboardState();
  };

  const onTournamentSelectAllChange = (): void => {
    if (args.tournamentSelectAllParticipantsInput.disabled) {
      return;
    }
    const selectableIds = getSelectableTournamentParticipantIds();
    if (args.tournamentSelectAllParticipantsInput.checked) {
      const nextIds = new Set(args.tournamentPlannerState.participantIds);
      selectableIds.forEach((id) => nextIds.add(id));
      args.tournamentPlannerState.participantIds = Array.from(nextIds);
    } else {
      args.tournamentPlannerState.participantIds = args.tournamentPlannerState.participantIds.filter(
        (participantId) => !selectableIds.includes(participantId),
      );
    }
    args.tournamentPlannerState.tournamentId = "";
    args.setTournamentSharePanelTargetId("");
    args.tournamentPlannerState.error = "";
    args.tournamentPlannerState.rounds = [];
    args.tournamentPlannerState.firstRoundMatches = [];
    args.loadTournamentSelect.value = "";
    renderTournamentPlanner();
    args.syncDashboardState();
  };

  return {
    renderSeasonEditor,
    renderTournamentPlanner,
    onSeasonSelectAllChange,
    onTournamentSelectAllChange,
  };
};
