import type {
  AppSession,
  BootstrapUserData,
  MatchFeedFilter,
  MatchRecord,
  SeasonRecord,
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

const getRecentCompletionCutoff = (): string => getDateValueMonthsAgo(2);

const isWithinRecentCompletionWindow = (dateValue: string | null | undefined): boolean =>
  Boolean(dateValue && dateValue >= getRecentCompletionCutoff());

export const shouldShowSeasonInDropdown = (
  season: SeasonRecord | undefined,
  currentUserId: string,
): boolean => {
  if (!season || season.status === "deleted") {
    return false;
  }

  const isAssociated =
    season.createdByUserId === currentUserId || season.participantIds.includes(currentUserId);
  if (!isAssociated) {
    return false;
  }

  if (isCompletedSeason(season)) {
    return isWithinRecentCompletionWindow(season.endDate);
  }

  return season.isActive;
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

export const renderMatchContext = (
  match: MatchRecord,
  seasons: SeasonRecord[],
  tournaments: TournamentRecord[],
  bracketContext: { roundTitle: string; isFinal: boolean } | null,
  t: (
    key: "renderMatchContextTournament" | "renderMatchContextSeason" | "renderMatchContextOpenPlay",
  ) => string,
  options?: { includeRound?: boolean; includeTournamentTrophy?: boolean },
): string => {
  const tournament = tournaments.find((entry) => entry.id === match.tournamentId);
  if (tournament) {
    const roundLabel =
      options?.includeRound ?? true
        ? bracketContext?.roundTitle
          ? ` • ${bracketContext.roundTitle}`
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

export const matchFilterLabels: Record<MatchFeedFilter, TextKey> = {
  recent: "matchFiltersRecent",
  mine: "matchFiltersMine",
  all: "matchFiltersAll",
};

export const getMatchLimitForFilter = (filter: MatchFeedFilter): number =>
  filter === "recent" || filter === "mine" ? 4 : 20;
