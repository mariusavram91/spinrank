import type {
  GetDashboardData,
  GetMatchesData,
  LeaderboardEntry,
  MatchBracketContext,
  MatchFeedFilter,
  SegmentType,
} from "../../../api/contract";
import type { DashboardState, SegmentMode, SharePanelElements } from "../../shared/types/app";
import type { RunAuthedAction } from "../../shared/types/actions";
import type { TextKey } from "../../shared/i18n/translations";

type TranslationFn = (key: TextKey) => string;

export const createDashboardActions = (args: {
  dashboardState: DashboardState;
  runAuthedAction: RunAuthedAction;
  hasUnreadAchievements: (data: GetDashboardData["achievements"] | null) => boolean;
  syncAuthState: () => void;
  syncDashboardState: () => void;
  setGlobalLoading: (active: boolean, label?: string) => void;
  markLeaderboardDirty: () => void;
  populateSeasonOptions: () => void;
  populateSeasonManagerLoadOptions: () => void;
  populateTournamentOptions: () => void;
  populateTournamentPlannerLoadOptions: () => void;
  populateMatchFormOptions: () => void;
  renderSeasonEditor: () => void;
  renderTournamentPlanner: () => void;
  buildSegmentShareKey: (segmentType: SegmentType, segmentId: string) => string;
  animateSharePanel: (panel: SharePanelElements) => void;
  showShareAlert: (message: string) => void;
  isAuthenticated: () => boolean;
  t: TranslationFn;
  getMatchLimitForFilter: (filter: MatchFeedFilter) => number;
}) => {
  const mergePlayers = (
    ...groups: Array<
      Array<
        Pick<LeaderboardEntry, "userId" | "displayName" | "avatarUrl" | "elo"> &
        Partial<Pick<LeaderboardEntry, "wins" | "losses" | "streak" | "rank">>
      >
    >
  ): LeaderboardEntry[] => {
    const players = new Map<string, LeaderboardEntry>();
    groups.flat().forEach((player) => {
      const existing = players.get(player.userId);
      players.set(player.userId, {
        wins: 0,
        losses: 0,
        streak: 0,
        rank: Number.MAX_SAFE_INTEGER,
        ...existing,
        ...player,
      });
    });
    return [...players.values()];
  };

  const isVisibleSeasonId = (seasonId: string): boolean =>
    Boolean(seasonId && args.dashboardState.seasons.some((season) => season.id === seasonId));

  const isVisibleTournamentId = (tournamentId: string): boolean =>
    Boolean(tournamentId && args.dashboardState.tournaments.some((tournament) => tournament.id === tournamentId));

  const buildClientShareUrl = (shareToken: string, fallbackUrl: string): string => {
    if (typeof window === "undefined" || !window.location?.href) {
      return fallbackUrl;
    }
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("shareToken", shareToken);
    return url.toString();
  };

  const loadLeaderboard = async (): Promise<void> => {
    const requestedMode = args.dashboardState.segmentMode;
    const requestedSeasonId = args.dashboardState.selectedSeasonId;
    const requestedTournamentId = args.dashboardState.selectedTournamentId;

    if (requestedMode === "global") {
      const data = await args.runAuthedAction("getLeaderboard", {});
      if (args.dashboardState.segmentMode !== requestedMode) {
        return;
      }
      args.dashboardState.leaderboard = data.leaderboard;
      args.dashboardState.leaderboardUpdatedAt = data.updatedAt;
      args.dashboardState.leaderboardStats = null;
      args.dashboardState.tournamentBracket = [];
      args.markLeaderboardDirty();
      return;
    }

    if (requestedMode === "season") {
      if (!isVisibleSeasonId(requestedSeasonId)) {
        args.dashboardState.leaderboard = [];
        args.dashboardState.leaderboardUpdatedAt = "";
        args.dashboardState.leaderboardStats = null;
        args.markLeaderboardDirty();
        return;
      }

      const data = await args.runAuthedAction("getSegmentLeaderboard", {
        segmentType: "season",
        segmentId: requestedSeasonId,
      });
      if (
        args.dashboardState.segmentMode !== requestedMode ||
        args.dashboardState.selectedSeasonId !== requestedSeasonId
      ) {
        return;
      }
      args.dashboardState.players = mergePlayers(args.dashboardState.players, data.leaderboard);
      args.dashboardState.leaderboard = data.leaderboard;
      args.dashboardState.leaderboardUpdatedAt = data.updatedAt;
      args.dashboardState.leaderboardStats = data.stats;
      args.dashboardState.tournamentBracket = [];
      args.markLeaderboardDirty();
      return;
    }

    if (!isVisibleTournamentId(requestedTournamentId)) {
      args.dashboardState.leaderboard = [];
      args.dashboardState.leaderboardUpdatedAt = "";
      args.dashboardState.leaderboardStats = null;
      args.dashboardState.tournamentBracket = [];
      args.markLeaderboardDirty();
      return;
    }

    const [leaderboardData, bracketData] = await Promise.all([
      args.runAuthedAction("getSegmentLeaderboard", {
        segmentType: "tournament",
        segmentId: requestedTournamentId,
      }),
      args.runAuthedAction("getTournamentBracket", {
        tournamentId: requestedTournamentId,
      }),
    ]);
    if (
      args.dashboardState.segmentMode !== requestedMode ||
      args.dashboardState.selectedTournamentId !== requestedTournamentId
    ) {
      return;
    }
    args.dashboardState.players = mergePlayers(
      args.dashboardState.players,
      leaderboardData.leaderboard,
      bracketData.participants,
    );
    args.dashboardState.leaderboard = leaderboardData.leaderboard;
    args.dashboardState.leaderboardUpdatedAt = leaderboardData.updatedAt;
    args.dashboardState.leaderboardStats = leaderboardData.stats;
    args.dashboardState.tournamentBracket = bracketData.rounds;
    args.markLeaderboardDirty();
  };

  const loadDashboard = async (): Promise<void> => {
    args.dashboardState.loading = true;
    args.dashboardState.error = "";
    args.setGlobalLoading(true, args.t("loadingDashboard"));
    args.syncDashboardState();

    try {
      const data: GetDashboardData = await args.runAuthedAction("getDashboard", {
        matchesLimit: args.getMatchLimitForFilter(args.dashboardState.matchesFilter),
        matchesFilter: args.dashboardState.matchesFilter,
      });

      args.dashboardState.seasons = data.seasons;
      args.dashboardState.tournaments = data.tournaments;
      const visibleSeasonIds = new Set(data.seasons.map((season) => season.id));
      const visibleTournamentIds = new Set(data.tournaments.map((tournament) => tournament.id));
      args.dashboardState.selectedSeasonId = visibleSeasonIds.has(args.dashboardState.selectedSeasonId)
        ? args.dashboardState.selectedSeasonId
        : data.seasons.find((season) => season.isActive)?.id || data.seasons[0]?.id || "";
      args.dashboardState.selectedTournamentId = visibleTournamentIds.has(args.dashboardState.selectedTournamentId)
        ? args.dashboardState.selectedTournamentId
        : data.tournaments[0]?.id || "";
      args.dashboardState.players = mergePlayers(data.players ?? [], data.leaderboard);
      args.dashboardState.leaderboard = data.leaderboard;
      args.dashboardState.leaderboardUpdatedAt = data.leaderboardUpdatedAt;
      args.dashboardState.tournamentBracket = [];
      args.markLeaderboardDirty();
      args.dashboardState.userProgress = data.userProgress;
      args.dashboardState.achievements = data.achievements;
      args.dashboardState.hasNewAchievements = args.hasUnreadAchievements(data.achievements);
      args.dashboardState.matches = data.matches;
      args.dashboardState.disputedMatches = data.disputedMatches ?? [];
      args.dashboardState.matchesCursor = data.nextCursor;
      args.dashboardState.matchBracketContextByMatchId = data.matchBracketContextByMatchId;

      args.populateSeasonOptions();
      args.populateSeasonManagerLoadOptions();
      args.populateTournamentOptions();
      args.populateTournamentPlannerLoadOptions();
      args.populateMatchFormOptions();
      args.renderSeasonEditor();
      args.renderTournamentPlanner();

      if (args.dashboardState.segmentMode !== "global") {
        await loadLeaderboard();
      }
    } catch (error) {
      args.dashboardState.error =
        error instanceof Error ? error.message : "Failed to load dashboard data.";
    } finally {
      args.dashboardState.loading = false;
      args.setGlobalLoading(false);
      args.syncAuthState();
      args.syncDashboardState();
    }
  };

  async function loadMatches(options: { reset?: boolean; filter?: MatchFeedFilter } = {}): Promise<void> {
    const filter = options.filter ?? args.dashboardState.matchesFilter;
    const limit = args.getMatchLimitForFilter(filter);
    const cursor = options.reset ? undefined : args.dashboardState.matchesCursor ?? undefined;

    args.dashboardState.matchesLoading = true;
    args.setGlobalLoading(true, args.t("loadingOverlay"));
    args.syncDashboardState();

    try {
      const data: GetMatchesData = await args.runAuthedAction("getMatches", {
        filter,
        limit,
        cursor,
      });
      const bracketContext = Object.fromEntries(
        data.matches
          .filter((match) => Boolean(match.bracketContext))
          .map((match) => [match.id, match.bracketContext as MatchBracketContext]),
      );

      args.dashboardState.matches = options.reset ? data.matches : [...args.dashboardState.matches, ...data.matches];
      args.dashboardState.players = mergePlayers(args.dashboardState.players, data.players ?? []);
      args.dashboardState.matchesCursor = data.nextCursor;
      args.dashboardState.matchBracketContextByMatchId = options.reset
        ? bracketContext
        : {
            ...args.dashboardState.matchBracketContextByMatchId,
            ...bracketContext,
          };
      args.dashboardState.matchesFilter = filter;
    } catch (error) {
      args.dashboardState.error = error instanceof Error ? error.message : "Failed to load matches.";
    } finally {
      args.dashboardState.matchesLoading = false;
      args.setGlobalLoading(false);
      args.syncDashboardState();
    }
  }

  const ensureVisibleMatches = async (matchIds: string[], filter: MatchFeedFilter): Promise<void> => {
    const missingMatchIds = matchIds.filter((matchId) => !args.dashboardState.matches.some((match) => match.id === matchId));
    if (missingMatchIds.length === 0) {
      return;
    }

    const data: GetMatchesData = await args.runAuthedAction("getMatches", {
      filter,
      limit: missingMatchIds.length,
      targetMatchIds: missingMatchIds,
    });
    if (data.matches.length === 0) {
      return;
    }

    const fetchedMatchIds = new Set(data.matches.map((match) => match.id));
    args.dashboardState.matches = [
      ...data.matches,
      ...args.dashboardState.matches.filter((match) => !fetchedMatchIds.has(match.id)),
    ];
    args.dashboardState.players = mergePlayers(args.dashboardState.players, data.players ?? []);
    const bracketContext = Object.fromEntries(
      data.matches
        .filter((match) => Boolean(match.bracketContext))
        .map((match) => [match.id, match.bracketContext as MatchBracketContext]),
    );
    args.dashboardState.matchBracketContextByMatchId = {
      ...bracketContext,
      ...args.dashboardState.matchBracketContextByMatchId,
    };
    args.syncDashboardState();
  };

  const applyMatchFilter = async (
    filter: MatchFeedFilter,
    options: { force?: boolean; ensureMatchIds?: string[] } = {},
  ): Promise<void> => {
    if ((options.ensureMatchIds ?? []).length === 0) {
      args.dashboardState.highlightedMatchId = "";
      args.dashboardState.highlightedMatchIds = [];
      args.dashboardState.pendingHighlightedMatchIds = [];
    }

    if (
      !options.force &&
      args.dashboardState.matchesFilter === filter &&
      args.dashboardState.matches.length > 0 &&
      !args.dashboardState.matchesLoading
    ) {
      await ensureVisibleMatches(options.ensureMatchIds ?? [], filter);
      return;
    }

    args.dashboardState.matchesFilter = filter;
    args.dashboardState.matches = [];
    args.dashboardState.matchesCursor = null;
    args.dashboardState.matchBracketContextByMatchId = {};
    await loadMatches({ reset: true, filter });
    await ensureVisibleMatches(options.ensureMatchIds ?? [], filter);
  };

  const loadMoreMatches = async (): Promise<void> => {
    if (!args.dashboardState.matchesCursor) {
      return;
    }

    await loadMatches({ reset: false });
  };

  const applySegmentMode = async (mode: SegmentMode): Promise<void> => {
    args.dashboardState.segmentMode = mode;
    args.dashboardState.loading = true;
    args.dashboardState.error = "";
    args.setGlobalLoading(true, args.t("loadingOverlay"));
    args.syncDashboardState();

    try {
      await loadLeaderboard();
    } catch (error) {
      args.dashboardState.error = error instanceof Error ? error.message : "Failed to load leaderboard.";
    } finally {
      args.dashboardState.loading = false;
      args.setGlobalLoading(false);
      args.syncDashboardState();
    }
  };

  const refreshSegmentShareLink = async (
    segmentType: SegmentType,
    segmentId: string,
    panel: SharePanelElements | null = null,
  ): Promise<void> => {
    if (
      !segmentId ||
      args.dashboardState.shareLoadingSegmentKey === args.buildSegmentShareKey(segmentType, segmentId)
    ) {
      return;
    }
    const key = args.buildSegmentShareKey(segmentType, segmentId);
    args.dashboardState.shareLoadingSegmentKey = key;
    delete args.dashboardState.shareErrors[key];
    args.syncDashboardState();

    try {
      const data = await args.runAuthedAction("createSegmentShareLink", { segmentType, segmentId });
      args.dashboardState.shareCache[key] = {
        segmentType,
        segmentId,
        shareToken: data.shareToken,
        url: buildClientShareUrl(data.shareToken, data.url),
        expiresAt: data.expiresAt,
      };
      delete args.dashboardState.shareErrors[key];
      if (panel) {
        args.animateSharePanel(panel);
      }
    } catch (error) {
      args.dashboardState.shareErrors[key] =
        error instanceof Error ? error.message : args.t("shareCreateFailure");
    } finally {
      args.dashboardState.shareLoadingSegmentKey = "";
      args.syncDashboardState();
    }
  };

  const tryRedeemPendingShareToken = async (): Promise<void> => {
    if (!args.dashboardState.pendingShareToken || !args.isAuthenticated()) {
      return;
    }
    const token = args.dashboardState.pendingShareToken;
    args.dashboardState.pendingShareToken = "";
    try {
      const data = await args.runAuthedAction("redeemSegmentShareLink", { shareToken: token });
      const noticeKey =
        data.segmentType === "season"
          ? data.joined
            ? "shareJoinedSeason"
            : "shareAlreadyJoinedSeason"
          : data.joined
            ? "shareJoinedTournament"
            : "shareAlreadyJoinedTournament";
      args.showShareAlert(args.t(noticeKey));
    } catch (error) {
      const message = error instanceof Error ? error.message : args.t("shareJoinFailure");
      args.showShareAlert(message);
    }
  };

  const initAuthenticatedDashboard = async (): Promise<void> => {
    await tryRedeemPendingShareToken();
    await loadDashboard();
  };

  return {
    loadLeaderboard,
    loadDashboard,
    loadMatches,
    applyMatchFilter,
    loadMoreMatches,
    applySegmentMode,
    refreshSegmentShareLink,
    tryRedeemPendingShareToken,
    initAuthenticatedDashboard,
  };
};
