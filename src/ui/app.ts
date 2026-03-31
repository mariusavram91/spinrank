import type {
  ApiAction,
  ApiActionMap,
  AppSession,
  BootstrapUserData,
  CreateMatchPayload,
  GetMatchesData,
  LeaderboardEntry,
  MatchRecord,
  SeasonRecord,
  TournamentRecord,
} from "../api/contract";
import { postAction } from "../api/client";
import { isProviderConfigured, renderGoogleButton } from "../auth/providers";
import { clearSession, isExpiredSession, loadSession, saveSession } from "../auth/session";
import { env, hasBackendConfig } from "../config/env";

type ViewState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "error"; message: string }
  | { status: "authenticated"; message: string; session: AppSession };

type SegmentMode = "global" | "season" | "tournament";

interface DashboardState {
  loading: boolean;
  error: string;
  leaderboard: LeaderboardEntry[];
  players: LeaderboardEntry[];
  leaderboardUpdatedAt: string;
  segmentMode: SegmentMode;
  selectedSeasonId: string;
  selectedTournamentId: string;
  seasons: SeasonRecord[];
  tournaments: TournamentRecord[];
  matches: MatchRecord[];
  matchesCursor: string | null;
  matchesLoading: boolean;
  matchSubmitting: boolean;
  matchFormError: string;
  matchFormMessage: string;
  pendingCreateRequestId: string;
}

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));

const buildSessionFromBootstrap = (data: BootstrapUserData): AppSession => ({
  sessionToken: data.sessionToken,
  expiresAt: data.expiresAt,
  user: data.user,
});

const isAuthedState = (state: ViewState): state is Extract<ViewState, { status: "authenticated" }> =>
  state.status === "authenticated";

const renderStreak = (streak: number): string => {
  if (streak > 0) {
    return `W${streak}`;
  }

  if (streak < 0) {
    return `L${Math.abs(streak)}`;
  }

  return "Even";
};

const renderMatchScore = (match: MatchRecord): string =>
  match.score.map((game) => `${game.teamA}-${game.teamB}`).join(" • ");

const toLocalDateTimeValue = (value: string): string => {
  const date = new Date(value);
  const parts = [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ];
  const time = [
    date.getHours().toString().padStart(2, "0"),
    date.getMinutes().toString().padStart(2, "0"),
  ];

  return `${parts.join("-")}T${time.join(":")}`;
};

export const buildApp = (): HTMLElement => {
  const container = document.createElement("main");
  container.className = "shell";

  const card = document.createElement("section");
  card.className = "panel";

  const header = document.createElement("header");
  header.className = "topbar";

  const brandMark = document.createElement("img");
  brandMark.className = "brand-mark";
  brandMark.src = `${import.meta.env.BASE_URL}assets/logo.png`;
  brandMark.alt = "SpinRank logo";

  const providerStack = document.createElement("div");
  providerStack.className = "provider-stack";

  const googleSlot = document.createElement("div");
  googleSlot.className = "google-slot";

  const dashboard = document.createElement("section");
  dashboard.className = "dashboard";

  const dashboardHeader = document.createElement("div");
  dashboardHeader.className = "dashboard-header";

  const welcomeBlock = document.createElement("div");
  welcomeBlock.className = "welcome-block";

  const welcomeTitle = document.createElement("h2");
  welcomeTitle.className = "section-title";

  const welcomeText = document.createElement("p");
  welcomeText.className = "section-copy";

  const actionsBar = document.createElement("div");
  actionsBar.className = "actions-bar";

  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.className = "secondary-button";
  logoutButton.textContent = "Log out";

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "primary-button";
  refreshButton.textContent = "Refresh";

  const dashboardStatus = document.createElement("p");
  dashboardStatus.className = "dashboard-status";

  const viewGrid = document.createElement("div");
  viewGrid.className = "view-grid";

  const leaderboardPanel = document.createElement("section");
  leaderboardPanel.className = "content-card";

  const leaderboardTop = document.createElement("div");
  leaderboardTop.className = "card-header";

  const leaderboardHeading = document.createElement("div");

  const leaderboardTitle = document.createElement("h3");
  leaderboardTitle.className = "card-title";
  leaderboardTitle.textContent = "Leaderboard";

  const leaderboardMeta = document.createElement("p");
  leaderboardMeta.className = "card-meta";

  const segmentToggle = document.createElement("div");
  segmentToggle.className = "segment-toggle";

  const globalButton = document.createElement("button");
  globalButton.type = "button";
  globalButton.textContent = "Global";

  const seasonButton = document.createElement("button");
  seasonButton.type = "button";
  seasonButton.textContent = "Season";

  const tournamentButton = document.createElement("button");
  tournamentButton.type = "button";
  tournamentButton.textContent = "Tournament";

  const seasonSelect = document.createElement("select");
  seasonSelect.className = "select-input";

  const tournamentSelect = document.createElement("select");
  tournamentSelect.className = "select-input";

  const leaderboardList = document.createElement("div");
  leaderboardList.className = "leaderboard-list";

  const matchesPanel = document.createElement("section");
  matchesPanel.className = "content-card";

  const composerPanel = document.createElement("section");
  composerPanel.className = "content-card composer-card";

  const composerTop = document.createElement("div");
  composerTop.className = "card-header";

  const composerHeading = document.createElement("div");

  const composerTitle = document.createElement("h3");
  composerTitle.className = "card-title";
  composerTitle.textContent = "Create match";

  const composerMeta = document.createElement("p");
  composerMeta.className = "card-meta";
  composerMeta.textContent = "Milestone 3 write flow with backend validation";

  const composerStatus = document.createElement("p");
  composerStatus.className = "form-status";

  const matchForm = document.createElement("form");
  matchForm.className = "match-form";

  const matchTypeSelect = document.createElement("select");
  matchTypeSelect.className = "select-input";

  const formatTypeSelect = document.createElement("select");
  formatTypeSelect.className = "select-input";

  const pointsToWinSelect = document.createElement("select");
  pointsToWinSelect.className = "select-input";

  const playedAtInput = document.createElement("input");
  playedAtInput.className = "text-input";
  playedAtInput.type = "datetime-local";

  const formSeasonSelect = document.createElement("select");
  formSeasonSelect.className = "select-input";

  const formTournamentSelect = document.createElement("select");
  formTournamentSelect.className = "select-input";

  const teamA1Select = document.createElement("select");
  teamA1Select.className = "select-input";
  const teamA2Select = document.createElement("select");
  teamA2Select.className = "select-input";
  const teamB1Select = document.createElement("select");
  teamB1Select.className = "select-input";
  const teamB2Select = document.createElement("select");
  teamB2Select.className = "select-input";

  const winnerTeamSelect = document.createElement("select");
  winnerTeamSelect.className = "select-input";

  const scoreGrid = document.createElement("div");
  scoreGrid.className = "score-grid";

  const scoreInputs = Array.from({ length: 3 }, () => ({
    teamA: Object.assign(document.createElement("input"), {
      className: "text-input",
      type: "number",
      min: "0",
      step: "1",
    }),
    teamB: Object.assign(document.createElement("input"), {
      className: "text-input",
      type: "number",
      min: "0",
      step: "1",
    }),
  }));

  const submitMatchButton = document.createElement("button");
  submitMatchButton.type = "submit";
  submitMatchButton.className = "primary-button";
  submitMatchButton.textContent = "Create match";

  const matchesTop = document.createElement("div");
  matchesTop.className = "card-header";

  const matchesHeading = document.createElement("div");

  const matchesTitle = document.createElement("h3");
  matchesTitle.className = "card-title";
  matchesTitle.textContent = "Recent matches";

  const matchesMeta = document.createElement("p");
  matchesMeta.className = "card-meta";
  matchesMeta.textContent = "Cursor-based pagination";

  const matchesList = document.createElement("div");
  matchesList.className = "matches-list";

  const loadMoreButton = document.createElement("button");
  loadMoreButton.type = "button";
  loadMoreButton.className = "secondary-button";
  loadMoreButton.textContent = "Load more";

  const state: { current: ViewState } = {
    current: (() => {
      const existing = loadSession();
      return existing
        ? { status: "authenticated", message: "Signed in", session: existing }
        : hasBackendConfig
          ? { status: "idle", message: "Sign in with Google to open the leaderboard." }
          : { status: "error", message: "Configure the backend URL before testing login." };
    })(),
  };

  const dashboardState: DashboardState = {
    loading: false,
    error: "",
    leaderboard: [],
    players: [],
    leaderboardUpdatedAt: "",
    segmentMode: "global",
    selectedSeasonId: "",
    selectedTournamentId: "",
    seasons: [],
    tournaments: [],
    matches: [],
    matchesCursor: null,
    matchesLoading: false,
    matchSubmitting: false,
    matchFormError: "",
    matchFormMessage: "",
    pendingCreateRequestId: "",
  };

  const syncAuthState = (): void => {
    if (isAuthedState(state.current)) {
      providerStack.replaceChildren(logoutButton);
      dashboard.hidden = false;
      welcomeTitle.textContent = "Dashboard";
      welcomeText.textContent = "";
      return;
    }

    providerStack.replaceChildren(googleSlot);
    dashboard.hidden = true;
  };

  const syncDashboardState = (): void => {
    const activeLabel =
      dashboardState.segmentMode === "global"
        ? "Global leaderboard"
        : dashboardState.segmentMode === "season"
          ? seasonSelect.selectedOptions[0]?.textContent || "Season leaderboard"
          : tournamentSelect.selectedOptions[0]?.textContent || "Tournament leaderboard";

    leaderboardMeta.textContent = dashboardState.leaderboardUpdatedAt
      ? `${activeLabel} • Updated ${formatDateTime(dashboardState.leaderboardUpdatedAt)}`
      : activeLabel;

    dashboardStatus.textContent = dashboardState.error
      ? dashboardState.error
      : dashboardState.loading
        ? "Refreshing..."
        : "";
    dashboardStatus.dataset.status = dashboardState.error ? "error" : "ready";

    [globalButton, seasonButton, tournamentButton].forEach((button) => {
      button.classList.remove("is-active");
    });
    if (dashboardState.segmentMode === "global") {
      globalButton.classList.add("is-active");
    }
    if (dashboardState.segmentMode === "season") {
      seasonButton.classList.add("is-active");
    }
    if (dashboardState.segmentMode === "tournament") {
      tournamentButton.classList.add("is-active");
    }

    seasonSelect.hidden = dashboardState.segmentMode !== "season";
    tournamentSelect.hidden = dashboardState.segmentMode !== "tournament";
    seasonSelect.disabled = dashboardState.loading || dashboardState.seasons.length === 0;
    tournamentSelect.disabled = dashboardState.loading || dashboardState.tournaments.length === 0;
    refreshButton.disabled = dashboardState.loading || dashboardState.matchesLoading;
    loadMoreButton.disabled = dashboardState.matchesLoading;
    loadMoreButton.hidden = !dashboardState.matchesCursor;
    submitMatchButton.disabled = dashboardState.matchSubmitting || dashboardState.loading;
    composerStatus.textContent = dashboardState.matchFormError || dashboardState.matchFormMessage;
    composerStatus.dataset.status = dashboardState.matchFormError ? "error" : "ready";

    if (dashboardState.leaderboard.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent =
        dashboardState.segmentMode === "global"
          ? "No ranked players yet."
          : "No segment standings found for the selected filter.";
      leaderboardList.replaceChildren(empty);
    } else {
      const rows = dashboardState.leaderboard.slice(0, 20).map((entry) => {
        const row = document.createElement("article");
        row.className = "leaderboard-row";

        const rank = document.createElement("div");
        rank.className = "rank-badge";
        rank.textContent = `#${entry.rank}`;

        const player = document.createElement("div");
        player.className = "player-summary";

        const name = document.createElement("strong");
        name.textContent = entry.displayName;

        const record = document.createElement("span");
        record.textContent = `${entry.wins}-${entry.losses} • ${renderStreak(entry.streak)}`;

        player.append(name, record);

        const stats = document.createElement("div");
        stats.className = "player-stats";
        stats.innerHTML = `<strong>${entry.elo}</strong><span>Elo</span>`;

        row.append(rank, player, stats);
        return row;
      });
      leaderboardList.replaceChildren(...rows);
    }

    matchesMeta.textContent = dashboardState.matches.length
      ? `${dashboardState.matches.length} loaded`
      : "Cursor-based pagination";

    if (dashboardState.matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = dashboardState.loading ? "Loading matches..." : "No matches recorded yet.";
      matchesList.replaceChildren(empty);
    } else {
      const matchCards = dashboardState.matches.map((match) => {
        const cardNode = document.createElement("article");
        cardNode.className = "match-row";

        const top = document.createElement("div");
        top.className = "match-topline";

        const format = document.createElement("strong");
        format.textContent = `${match.matchType} • ${match.formatType.replaceAll("_", " ")} • First to ${match.pointsToWin}`;

        const outcome = document.createElement("span");
        outcome.className = "match-status";
        outcome.textContent = match.status === "active" ? `Winner ${match.winnerTeam}` : "Deactivated";

        top.append(format, outcome);

        const meta = document.createElement("p");
        meta.className = "match-meta";
        meta.textContent = `${formatDateTime(match.playedAt)} • Score ${renderMatchScore(match)}`;

        const segment = document.createElement("p");
        segment.className = "match-meta";
        segment.textContent = `Season: ${match.seasonId || "none"} • Tournament: ${match.tournamentId || "none"} • Created by ${match.createdByUserId}`;

        cardNode.append(top, meta, segment);
        return cardNode;
      });
      matchesList.replaceChildren(...matchCards);
    }
  };

  const replaceOptions = (
    select: HTMLSelectElement,
    options: Array<{ value: string; label: string }>,
    selectedValue: string,
    emptyLabel: string,
  ): void => {
    const nextOptions =
      options.length > 0
        ? options
        : [
            {
              value: "",
              label: emptyLabel,
            },
          ];

    select.replaceChildren(
      ...nextOptions.map((option) => {
        const node = document.createElement("option");
        node.value = option.value;
        node.textContent = option.label;
        node.selected = option.value === selectedValue;
        return node;
      }),
    );
  };

  const setIdleState = (): void => {
    state.current = hasBackendConfig
      ? { status: "idle", message: "Sign in with Google to open the leaderboard." }
      : { status: "error", message: "Configure the backend URL before testing login." };
    dashboardState.error = "";
    dashboardState.loading = false;
    syncAuthState();
    syncDashboardState();
  };

  const runAuthedAction = async <TAction extends ApiAction>(
    action: TAction,
    payload: ApiActionMap[TAction]["payload"],
    requestId?: string,
  ): Promise<ApiActionMap[TAction]["data"]> => {
    if (!isAuthedState(state.current)) {
      throw new Error("You must be signed in.");
    }

    const response = await postAction(action, payload, state.current.session.sessionToken, requestId);
    if (!response.ok || !response.data) {
      if (response.error?.code === "UNAUTHORIZED") {
        clearSession();
        state.current = { status: "error", message: "Your session expired. Sign in again." };
        syncAuthState();
      }

      throw new Error(response.error?.message || `Failed to run ${action}.`);
    }

    return response.data;
  };

  const populateSeasonOptions = (): void => {
    const options = dashboardState.seasons.map((season) => {
      const option = document.createElement("option");
      option.value = season.id;
      option.textContent = `${season.name} (${formatDate(season.startDate)})`;
      option.selected = season.id === dashboardState.selectedSeasonId;
      return option;
    });

    if (options.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No seasons available";
      options.push(option);
    }

    seasonSelect.replaceChildren(...options);
  };

  const populateTournamentOptions = (): void => {
    const options = dashboardState.tournaments.map((tournament) => {
      const option = document.createElement("option");
      option.value = tournament.id;
      option.textContent = `${tournament.name} (${formatDate(tournament.date)})`;
      option.selected = tournament.id === dashboardState.selectedTournamentId;
      return option;
    });

    if (options.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No tournaments available";
      options.push(option);
    }

    tournamentSelect.replaceChildren(...options);
  };

  const populateMatchFormOptions = (): void => {
    replaceOptions(
      matchTypeSelect,
      [
        { value: "singles", label: "Singles" },
        { value: "doubles", label: "Doubles" },
      ],
      matchTypeSelect.value || "singles",
      "No match type",
    );

    replaceOptions(
      formatTypeSelect,
      [
        { value: "single_game", label: "Single game" },
        { value: "best_of_3", label: "Best of 3" },
      ],
      formatTypeSelect.value || "single_game",
      "No format",
    );

    replaceOptions(
      pointsToWinSelect,
      [
        { value: "11", label: "11 points" },
        { value: "21", label: "21 points" },
      ],
      pointsToWinSelect.value || "11",
      "No points",
    );

    replaceOptions(
      winnerTeamSelect,
      [
        { value: "A", label: "Team A" },
        { value: "B", label: "Team B" },
      ],
      winnerTeamSelect.value || "A",
      "No winner",
    );

    const playerOptions = dashboardState.players.map((player) => ({
      value: player.userId,
      label: `${player.displayName} (${player.elo})`,
    }));
    [teamA1Select, teamA2Select, teamB1Select, teamB2Select].forEach((select, index) => {
      replaceOptions(select, playerOptions, select.value, `Player ${index + 1} unavailable`);
    });

    replaceOptions(
      formSeasonSelect,
      [
        { value: "", label: "No season" },
        ...dashboardState.seasons.map((season) => ({
          value: season.id,
          label: season.name,
        })),
      ],
      formSeasonSelect.value || dashboardState.selectedSeasonId,
      "No season",
    );

    const filteredTournaments = dashboardState.tournaments.filter((tournament) => {
      return !formSeasonSelect.value || tournament.seasonId === formSeasonSelect.value;
    });

    replaceOptions(
      formTournamentSelect,
      [
        { value: "", label: "No tournament" },
        ...filteredTournaments.map((tournament) => ({
          value: tournament.id,
          label: tournament.name,
        })),
      ],
      formTournamentSelect.value,
      "No tournament",
    );

    const isDoubles = matchTypeSelect.value === "doubles";
    teamA2Select.hidden = !isDoubles;
    teamB2Select.hidden = !isDoubles;

    const visibleGames = formatTypeSelect.value === "best_of_3" ? 3 : 1;
    scoreInputs.forEach((game, index) => {
      const row = scoreGrid.children[index] as HTMLElement | undefined;
      if (row) {
        row.hidden = index >= visibleGames;
      }
    });
  };

  const collectMatchPayload = (): CreateMatchPayload => {
    const playerIdsA = [teamA1Select.value];
    const playerIdsB = [teamB1Select.value];

    if (matchTypeSelect.value === "doubles") {
      playerIdsA.push(teamA2Select.value);
      playerIdsB.push(teamB2Select.value);
    }

    const visibleGames = formatTypeSelect.value === "best_of_3" ? 3 : 1;
    const score = scoreInputs
      .slice(0, visibleGames)
      .filter((game) => game.teamA.value !== "" && game.teamB.value !== "")
      .map((game) => ({
        teamA: Number(game.teamA.value),
        teamB: Number(game.teamB.value),
      }));

    const playedAt = playedAtInput.value ? new Date(playedAtInput.value).toISOString() : "";

    return {
      matchType: matchTypeSelect.value as CreateMatchPayload["matchType"],
      formatType: formatTypeSelect.value as CreateMatchPayload["formatType"],
      pointsToWin: Number(pointsToWinSelect.value) as 11 | 21,
      teamAPlayerIds: playerIdsA,
      teamBPlayerIds: playerIdsB,
      score,
      winnerTeam: winnerTeamSelect.value as CreateMatchPayload["winnerTeam"],
      playedAt,
      seasonId: formSeasonSelect.value || null,
      tournamentId: formTournamentSelect.value || null,
    };
  };

  const loadLeaderboard = async (): Promise<void> => {
    if (dashboardState.segmentMode === "global") {
      const data = await runAuthedAction("getLeaderboard", {});
      dashboardState.leaderboard = data.leaderboard;
      dashboardState.leaderboardUpdatedAt = data.updatedAt;
      return;
    }

    if (dashboardState.segmentMode === "season") {
      if (!dashboardState.selectedSeasonId) {
        dashboardState.leaderboard = [];
        dashboardState.leaderboardUpdatedAt = "";
        return;
      }

      const data = await runAuthedAction("getSegmentLeaderboard", {
        segmentType: "season",
        segmentId: dashboardState.selectedSeasonId,
      });
      dashboardState.leaderboard = data.leaderboard;
      dashboardState.leaderboardUpdatedAt = data.updatedAt;
      return;
    }

    if (!dashboardState.selectedTournamentId) {
      dashboardState.leaderboard = [];
      dashboardState.leaderboardUpdatedAt = "";
      return;
    }

    const data = await runAuthedAction("getSegmentLeaderboard", {
      segmentType: "tournament",
      segmentId: dashboardState.selectedTournamentId,
    });
    dashboardState.leaderboard = data.leaderboard;
    dashboardState.leaderboardUpdatedAt = data.updatedAt;
  };

  const loadDashboard = async (): Promise<void> => {
    dashboardState.loading = true;
    dashboardState.error = "";
    syncDashboardState();

    try {
      const [seasonsData, tournamentsData, globalData, matchesData] = await Promise.all([
        runAuthedAction("getSeasons", {}),
        runAuthedAction("getTournaments", {}),
        runAuthedAction("getLeaderboard", {}),
        runAuthedAction("getMatches", { limit: 10 }),
      ]);

      dashboardState.seasons = seasonsData.seasons;
      dashboardState.tournaments = tournamentsData.tournaments;
      dashboardState.selectedSeasonId =
        dashboardState.selectedSeasonId || seasonsData.seasons.find((season) => season.isActive)?.id || seasonsData.seasons[0]?.id || "";
      dashboardState.selectedTournamentId =
        dashboardState.selectedTournamentId || tournamentsData.tournaments[0]?.id || "";
      dashboardState.players = globalData.leaderboard;
      dashboardState.leaderboard = globalData.leaderboard;
      dashboardState.leaderboardUpdatedAt = globalData.updatedAt;
      dashboardState.matches = matchesData.matches;
      dashboardState.matchesCursor = matchesData.nextCursor;

      populateSeasonOptions();
      populateTournamentOptions();
      populateMatchFormOptions();

      if (dashboardState.segmentMode !== "global") {
        await loadLeaderboard();
      }
    } catch (error) {
      dashboardState.error = error instanceof Error ? error.message : "Failed to load dashboard data.";
    } finally {
      dashboardState.loading = false;
      syncDashboardState();
    }
  };

  const loadMoreMatches = async (): Promise<void> => {
    if (!dashboardState.matchesCursor) {
      return;
    }

    dashboardState.matchesLoading = true;
    syncDashboardState();

    try {
      const data: GetMatchesData = await runAuthedAction("getMatches", {
        cursor: dashboardState.matchesCursor,
        limit: 10,
      });
      dashboardState.matches = [...dashboardState.matches, ...data.matches];
      dashboardState.matchesCursor = data.nextCursor;
    } catch (error) {
      dashboardState.error = error instanceof Error ? error.message : "Failed to load more matches.";
    } finally {
      dashboardState.matchesLoading = false;
      syncDashboardState();
    }
  };

  const applySegmentMode = async (mode: SegmentMode): Promise<void> => {
    dashboardState.segmentMode = mode;
    dashboardState.loading = true;
    dashboardState.error = "";
    syncDashboardState();

    try {
      await loadLeaderboard();
    } catch (error) {
      dashboardState.error = error instanceof Error ? error.message : "Failed to load leaderboard.";
    } finally {
      dashboardState.loading = false;
      syncDashboardState();
    }
  };

  const submitMatch = async (): Promise<void> => {
    dashboardState.matchSubmitting = true;
    dashboardState.matchFormError = "";
    dashboardState.matchFormMessage = "";
    if (!dashboardState.pendingCreateRequestId) {
      dashboardState.pendingCreateRequestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `match_${Date.now()}`;
    }
    syncDashboardState();

    try {
      const payload = collectMatchPayload();
      const data = await runAuthedAction(
        "createMatch",
        payload,
        dashboardState.pendingCreateRequestId,
      );
      dashboardState.matchFormMessage = `Match created for ${formatDateTime(data.match.playedAt)}.`;
      dashboardState.pendingCreateRequestId = "";
      scoreInputs.forEach((game, index) => {
        if (index > 0) {
          game.teamA.value = "";
          game.teamB.value = "";
        }
      });
      playedAtInput.value = toLocalDateTimeValue(new Date().toISOString());
      await loadDashboard();
    } catch (error) {
      dashboardState.matchFormError =
        error instanceof Error ? error.message : "Failed to create match.";
    } finally {
      dashboardState.matchSubmitting = false;
      syncDashboardState();
    }
  };

  const handleBootstrap = async (result: {
    provider: "google";
    idToken: string;
    nonce: string;
    profile?: {
      displayName?: string | null;
      email?: string | null;
      avatarUrl?: string | null;
    };
  }): Promise<void> => {
    state.current = { status: "loading", message: `Signing in with ${result.provider}...` };
    syncAuthState();

    try {
      const response = await postAction("bootstrapUser", {
        provider: result.provider,
        idToken: result.idToken,
        nonce: result.nonce,
        profile: result.profile,
      });

      if (!response.ok || !response.data) {
        throw new Error(response.error?.message || "Backend did not return a session.");
      }

      const session = buildSessionFromBootstrap(response.data);
      saveSession(session);
      state.current = {
        status: "authenticated",
        message: "Signed in",
        session,
      };
      syncAuthState();
      await loadDashboard();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      state.current = { status: "error", message };
    }

    syncAuthState();
  };

  logoutButton.addEventListener("click", () => {
    clearSession();
    setIdleState();
  });

  refreshButton.addEventListener("click", () => {
    void loadDashboard();
  });

  globalButton.addEventListener("click", () => {
    void applySegmentMode("global");
  });

  seasonButton.addEventListener("click", () => {
    void applySegmentMode("season");
  });

  tournamentButton.addEventListener("click", () => {
    void applySegmentMode("tournament");
  });

  seasonSelect.addEventListener("change", () => {
    dashboardState.selectedSeasonId = seasonSelect.value;
    void applySegmentMode("season");
  });

  tournamentSelect.addEventListener("change", () => {
    dashboardState.selectedTournamentId = tournamentSelect.value;
    void applySegmentMode("tournament");
  });

  loadMoreButton.addEventListener("click", () => {
    void loadMoreMatches();
  });

  [matchTypeSelect, formatTypeSelect, formSeasonSelect].forEach((input) => {
    input.addEventListener("change", () => {
      populateMatchFormOptions();
      syncDashboardState();
    });
  });

  matchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitMatch();
  });

  const sessionTicker = window.setInterval(() => {
    if (!isAuthedState(state.current)) {
      return;
    }

    if (isExpiredSession(state.current.session)) {
      clearSession();
      state.current = { status: "error", message: "Your session expired. Sign in again." };
      syncAuthState();
      return;
    }

    syncAuthState();
  }, 30_000);

  window.addEventListener("beforeunload", () => {
    window.clearInterval(sessionTicker);
  });

  leaderboardHeading.append(leaderboardTitle, leaderboardMeta);
  segmentToggle.append(globalButton, seasonButton, tournamentButton);
  leaderboardTop.append(leaderboardHeading, segmentToggle);
  leaderboardPanel.append(leaderboardTop, seasonSelect, tournamentSelect, leaderboardList);

  matchesHeading.append(matchesTitle, matchesMeta);
  matchesTop.append(matchesHeading);
  matchesPanel.append(matchesTop, matchesList, loadMoreButton);

  composerHeading.append(composerTitle, composerMeta);
  composerTop.append(composerHeading);

  const buildField = (labelText: string, input: HTMLElement): HTMLLabelElement => {
    const label = document.createElement("label");
    label.className = "form-field";
    const copy = document.createElement("span");
    copy.className = "field-label";
    copy.textContent = labelText;
    label.append(copy, input);
    return label;
  };

  const teamGrid = document.createElement("div");
  teamGrid.className = "team-grid";
  teamGrid.append(
    buildField("Team A player 1", teamA1Select),
    buildField("Team A player 2", teamA2Select),
    buildField("Team B player 1", teamB1Select),
    buildField("Team B player 2", teamB2Select),
  );

  scoreInputs.forEach((game, index) => {
    const row = document.createElement("div");
    row.className = "score-row";
    row.append(
      buildField(`Game ${index + 1} team A`, game.teamA),
      buildField(`Game ${index + 1} team B`, game.teamB),
    );
    scoreGrid.append(row);
  });

  matchForm.append(
    buildField("Match type", matchTypeSelect),
    buildField("Format", formatTypeSelect),
    buildField("Points to win", pointsToWinSelect),
    buildField("Played at", playedAtInput),
    buildField("Season", formSeasonSelect),
    buildField("Tournament", formTournamentSelect),
    teamGrid,
    buildField("Winner", winnerTeamSelect),
    scoreGrid,
    submitMatchButton,
  );

  composerPanel.append(composerTop, composerStatus, matchForm);

  welcomeBlock.append(welcomeTitle, welcomeText);
  actionsBar.append(refreshButton);
  dashboardHeader.append(welcomeBlock, actionsBar);
  viewGrid.append(leaderboardPanel, matchesPanel);
  dashboard.append(dashboardHeader, dashboardStatus, composerPanel, viewGrid);

  header.append(brandMark, providerStack);
  card.append(header, dashboard);
  container.append(card);

  googleSlot.classList.toggle("provider-disabled", !isProviderConfigured());
  playedAtInput.value = toLocalDateTimeValue(new Date().toISOString());
  populateMatchFormOptions();

  if (hasBackendConfig && isProviderConfigured()) {
    void renderGoogleButton(googleSlot, handleBootstrap).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Google sign in failed to initialize.";
      state.current = { status: "error", message };
      syncAuthState();
    });
  } else {
    googleSlot.textContent = hasBackendConfig
      ? "Configure VITE_GOOGLE_CLIENT_ID to enable Google sign in."
      : "Configure VITE_API_BASE_URL to enable sign in.";
  }

  syncAuthState();
  syncDashboardState();

  if (isAuthedState(state.current)) {
    void loadDashboard();
  }

  return container;
};
