import type { DashboardState, TournamentPlannerState } from "../../shared/types/app";
import type { SeasonRecord, TournamentRecord } from "../../../api/contract";

export const createLockHelpers = (args: {
  dashboardState: DashboardState;
  tournamentPlannerState: TournamentPlannerState;
  formSeasonSelect: HTMLSelectElement;
  formTournamentSelect: HTMLSelectElement;
  submitMatchButton: HTMLButtonElement;
  matchLockNotice: HTMLElement;
  getActiveTournamentBracketMatchId: () => string | null;
  isLockedSeason: (season: SeasonRecord | undefined) => boolean;
  isLockedTournament: (tournament: TournamentRecord | undefined) => boolean;
  t: (key: "matchLockTournamentComplete" | "matchLockSeasonComplete" | "matchLockBracketLocked") => string;
}) => {
  const syncMatchFormLockState = (): void => {
    const season = args.dashboardState.seasons.find((entry) => entry.id === args.formSeasonSelect.value);
    const tournament = args.dashboardState.tournaments.find((entry) => entry.id === args.formTournamentSelect.value);
    const locked =
      args.isLockedSeason(season) ||
      args.isLockedTournament(tournament) ||
      Boolean(
        args.getActiveTournamentBracketMatchId() &&
          args.tournamentPlannerState.rounds.some((round) =>
            round.matches.some(
              (match) =>
                match.id === args.getActiveTournamentBracketMatchId() &&
                (match.locked || Boolean(match.createdMatchId)),
            ),
          ),
      );

    args.submitMatchButton.disabled = args.dashboardState.matchSubmitting || args.dashboardState.loading || locked;
    args.matchLockNotice.hidden = !locked;

    if (tournament && args.isLockedTournament(tournament)) {
      args.matchLockNotice.textContent = args.t("matchLockTournamentComplete");
    } else if (season && args.isLockedSeason(season)) {
      args.matchLockNotice.textContent = args.t("matchLockSeasonComplete");
    } else if (locked) {
      args.matchLockNotice.textContent = args.t("matchLockBracketLocked");
    }
  };

  const hasTournamentProgress = (): boolean =>
    args.tournamentPlannerState.rounds.some((round, roundIndex) =>
      round.matches.some((match) => {
        if (match.createdMatchId || match.winnerPlayerId) {
          return true;
        }
        return roundIndex > 0 && Boolean(match.leftPlayerId || match.rightPlayerId);
      }),
    );

  return {
    syncMatchFormLockState,
    hasTournamentProgress,
  };
};
