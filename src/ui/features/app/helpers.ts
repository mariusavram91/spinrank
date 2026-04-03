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

export const isLockedSeason = (season: SeasonRecord | undefined): boolean =>
  Boolean(season && season.status !== "active");

export const isLockedTournament = (tournament: TournamentRecord | undefined): boolean =>
  Boolean(tournament && tournament.status !== "active");

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
  options?: { includeRound?: boolean },
): string => {
  const tournament = tournaments.find((entry) => entry.id === match.tournamentId);
  if (tournament) {
    const roundLabel =
      options?.includeRound ?? true
        ? bracketContext?.roundTitle
          ? ` • ${bracketContext.roundTitle}`
          : ""
        : "";
    const trophyLabel = bracketContext?.isFinal ? "🏆 " : "";
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

export const getMatchLimitForFilter = (filter: MatchFeedFilter): number => (filter === "recent" ? 4 : 20);
