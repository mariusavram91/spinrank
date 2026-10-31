import type {
  AppSession,
  BootstrapUserData,
  MatchFeedFilter,
  MatchRecord,
  SeasonRecord,
  TournamentBracketRound,
  TournamentRecord,
} from "../../../api/contract";
import type { TextKey } from "../../shared/i18n/translations";
import type { ViewState } from "../../shared/types/app";
import { getDateValueMonthsAgo, getTodayDateValue, isPastDateValue } from "../../shared/utils/format";

export const buildSessionFromBootstrap = (data: BootstrapUserData): AppSession => ({
  sessionToken: data.sessionToken,
  expiresAt: data.expiresAt,
  user: data.user,
});

export const isAuthedState = (
  state: ViewState,
): state is Extract<ViewState, { status: "authenticated" }> => state.status === "authenticated";

export const canSoftDelete = (resource: { createdByUserId?: string | null }, sessionUserId: string): boolean =>
  resource.createdByUserId === sessionUserId;

export const canDeleteMatch = (
  match: Pick<MatchRecord, "createdByUserId" | "deleteLockedAt" | "hasActiveDispute">,
  sessionUserId: string,
  nowIso = new Date().toISOString(),
): boolean => {
  if (match.createdByUserId !== sessionUserId) {
    return false;
  }
  if (match.hasActiveDispute) {
    return true;
  }
  if (!match.deleteLockedAt) {
    return false;
  }
  return new Date(nowIso).getTime() <= new Date(match.deleteLockedAt).getTime();
};

export const getMatchFeedContextLabel = (
  season: SeasonRecord | undefined,
  tournament: TournamentRecord | undefined,
  t: (key: "matchContextCountsToward" | "matchContextStandalone") => string,
): string => {
  if (tournament) {
    return `${t("matchContextCountsToward")} ${tournament.name}`;
  }
  if (season) {
    return `${t("matchContextCountsToward")} ${season.name}`;
  }
  return t("matchContextStandalone");
};

export const getCurrentUserId = (state: ViewState): string => (isAuthedState(state) ? state.session.user.id : "");

export const isCompletedSeason = (season: SeasonRecord | undefined): boolean =>
  Boolean(season && season.status !== "deleted" && isPastDateValue(season.endDate, getTodayDateValue()));

export const isLockedSeason = (season: SeasonRecord | undefined): boolean =>
  Boolean(
    season &&
      (season.status === "deleted" ||
        season.status === "completed" ||
        isCompletedSeason(season)),
  );

export const isCompletedTournament = (tournament: TournamentRecord | undefined): boolean =>
  Boolean(tournament && tournament.bracketStatus === "completed");

export const isLockedTournament = (tournament: TournamentRecord | undefined): boolean =>
  Boolean(
    tournament &&
      (tournament.status === "deleted" || tournament.status === "completed" || isCompletedTournament(tournament)),
  );

const RECENT_COMPLETED_SEASON_LIMIT = 3;
const RECENT_COMPLETION_WINDOW_MONTHS = 2;

const isWithinRecentCompletionWindow = (dateValue: string | null | undefined): boolean =>
  Boolean(dateValue && dateValue >= getDateValueMonthsAgo(RECENT_COMPLETION_WINDOW_MONTHS));

const getSeasonCompletionDate = (season: SeasonRecord): string => season.endDate || season.startDate;

const compareSeasonsByRecency = (left: SeasonRecord, right: SeasonRecord): number => {
  const leftCompletion = getSeasonCompletionDate(left);
  const rightCompletion = getSeasonCompletionDate(right);
  if (leftCompletion !== rightCompletion) {
    return rightCompletion.localeCompare(leftCompletion);
  }
  return right.startDate.localeCompare(left.startDate);
};

/**
 * Season dropdowns list every current season the user belongs to plus only the
 * most recently finished ones; the profile page keeps the full history instead.
 */
export const getSeasonIdsForDropdown = (
  seasons: SeasonRecord[],
  currentUserId: string,
): Set<string> => {
  const associated = seasons.filter(
    (season) =>
      season.status !== "deleted" &&
      (season.createdByUserId === currentUserId || season.participantIds.includes(currentUserId)),
  );
  const completedSeasons = associated
    .filter((season) => isCompletedSeason(season))
    .sort(compareSeasonsByRecency)
    .slice(0, RECENT_COMPLETED_SEASON_LIMIT);

  return new Set([
    ...associated.filter((season) => !isCompletedSeason(season) && season.isActive).map((season) => season.id),
    ...completedSeasons.map((season) => season.id),
  ]);
};

export const shouldShowTournamentInDropdown = (
  tournament: TournamentRecord | undefined,
  currentUserId: string,
): boolean => {
  if (!tournament || tournament.status === "deleted") {
    return false;
  }

  const isAssociated =
    tournament.createdByUserId === currentUserId || tournament.participantIds.includes(currentUserId);
  if (!isAssociated) {
    return false;
  }

  if (tournament.status === "completed") {
    return isWithinRecentCompletionWindow(tournament.completedAt || tournament.date);
  }

  return true;
};

export const getWinnerLabel = (winnerTeam: "A" | "B", teamA: string, teamB: string): string =>
  winnerTeam === "A" ? teamA : teamB;

export const isTournamentBracketMatchReadyForCreation = (
  rounds: TournamentBracketRound[],
  roundIndex: number,
  matchIndex: number,
): boolean => {
  const round = rounds[roundIndex];
  const match = round?.matches[matchIndex];
  if (!match || !match.leftPlayerId || !match.rightPlayerId) {
    return false;
  }
  if (roundIndex === 0) {
    return true;
  }
  const previousRound = rounds[roundIndex - 1];
  if (!previousRound) {
    return false;
  }
  const previousLeft = previousRound.matches[matchIndex * 2];
  const previousRight = previousRound.matches[matchIndex * 2 + 1];
  return Boolean(previousLeft?.winnerPlayerId) && Boolean(previousRight?.winnerPlayerId);
};

export const renderMatchContext = (
  match: MatchRecord,
  seasons: SeasonRecord[],
  tournaments: TournamentRecord[],
  bracketContext: { roundTitle: string; isFinal: boolean } | null,
  t: (
    key:
      | "renderMatchContextTournament"
      | "renderMatchContextSeason"
      | "renderMatchContextOpenPlay"
      | "leaderboardPlacementFinal"
      | "leaderboardPlacementSemifinals"
      | "leaderboardPlacementQuarterfinals"
      | "leaderboardPlacementRoundOf",
  ) => string,
  options?: { includeRound?: boolean; includeTournamentTrophy?: boolean },
): string => {
  const tournament = tournaments.find((entry) => entry.id === match.tournamentId);
  if (tournament) {
    const roundLabel =
      options?.includeRound ?? true
        ? bracketContext?.roundTitle
          ? ` • ${translateBracketRoundTitle(bracketContext.roundTitle, t)}`
          : ""
        : "";
    const trophyLabel =
      options?.includeTournamentTrophy === false ? "" : bracketContext?.isFinal ? "🏆 " : "";
    const prefix = t("renderMatchContextTournament");
    return `${trophyLabel}${prefix} ${tournament.name}${roundLabel}`;
  }

  const season = seasons.find((entry) => entry.id === match.seasonId);
  if (season) {
    return `${t("renderMatchContextSeason")} ${season.name}`;
  }

  return t("renderMatchContextOpenPlay");
};

export const translateBracketRoundTitle = (
  roundTitle: string,
  t: (
    key:
      | "leaderboardPlacementFinal"
      | "leaderboardPlacementSemifinals"
      | "leaderboardPlacementQuarterfinals"
      | "leaderboardPlacementRoundOf",
  ) => string,
): string => {
  if (roundTitle === "Final") {
    return t("leaderboardPlacementFinal") || roundTitle;
  }
  if (roundTitle === "Semifinals") {
    return t("leaderboardPlacementSemifinals") || roundTitle;
  }
  if (roundTitle === "Quarterfinals") {
    return t("leaderboardPlacementQuarterfinals") || roundTitle;
  }
  const roundOfMatch = /^Round of (\d+)$/.exec(roundTitle);
  if (roundOfMatch) {
    return (t("leaderboardPlacementRoundOf") || roundTitle).replace("{count}", roundOfMatch[1] ?? "");
  }
  return roundTitle;
};

export const matchFilterLabels: Record<MatchFeedFilter, TextKey> = {
  recent: "matchFiltersRecent",
  mine: "matchFiltersMine",
  all: "matchFiltersAll",
};

export const getMatchLimitForFilter = (filter: MatchFeedFilter): number =>
  filter === "recent" || filter === "mine" ? 4 : 20;
