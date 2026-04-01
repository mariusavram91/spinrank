import type {
  ApiAction,
  ApiActionMap,
  AppSession,
  BootstrapUserData,
  CreateMatchPayload,
  CreateTournamentPayload,
  GetMatchesData,
  GetTournamentBracketData,
  LeaderboardEntry,
  MatchRecord,
  SeasonRecord,
  TournamentBracketRound,
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
  screen: "dashboard" | "createMatch" | "createTournament";
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
  matchBracketContextByMatchId: Record<string, { roundTitle: string; isFinal: boolean }>;
  matchSubmitting: boolean;
  matchFormError: string;
  matchFormMessage: string;
  pendingCreateRequestId: string;
}

interface FairPlayerProfile {
  userId: string;
  displayName: string;
  elo: number;
  winRate: number;
}

interface SuggestedMatchup {
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  fairnessScore: number;
}

interface TournamentPlannerMatch {
  id: string;
  leftPlayerId: string | null;
  rightPlayerId: string | null;
  createdMatchId?: string | null;
  winnerPlayerId?: string | null;
}

interface TournamentPlannerRound {
  title: string;
  matches: TournamentPlannerMatch[];
}

interface TournamentPlannerState {
  name: string;
  tournamentId: string;
  participantIds: string[];
  firstRoundMatches: TournamentPlannerMatch[];
  rounds: TournamentPlannerRound[];
  error: string;
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

const renderPlayerNames = (playerIds: string[], players: LeaderboardEntry[]): string => {
  const playersById = new Map(players.map((player) => [player.userId, player.displayName]));
  return playerIds.map((playerId) => playersById.get(playerId) || playerId).join(" / ");
};

const findPlayer = (
  playerId: string | null,
  players: LeaderboardEntry[],
): LeaderboardEntry | null => players.find((player) => player.userId === playerId) || null;

const renderMatchContext = (
  match: MatchRecord,
  seasons: SeasonRecord[],
  tournaments: TournamentRecord[],
  bracketContext: { roundTitle: string; isFinal: boolean } | null,
): string => {
  const tournament = tournaments.find((entry) => entry.id === match.tournamentId);
  if (tournament) {
    const roundLabel = bracketContext?.roundTitle ? ` • ${bracketContext.roundTitle}` : "";
    const trophyLabel = bracketContext?.isFinal ? "🏆 " : "";
    return `${trophyLabel}Tournament: ${tournament.name}${roundLabel}`;
  }

  const season = seasons.find((entry) => entry.id === match.seasonId);
  if (season) {
    return `Season: ${season.name}`;
  }

  return "Open play";
};

const toFairPlayerProfile = (player: LeaderboardEntry): FairPlayerProfile => {
  const totalMatches = player.wins + player.losses;
  return {
    userId: player.userId,
    displayName: player.displayName,
    elo: player.elo,
    winRate: totalMatches > 0 ? player.wins / totalMatches : 0.5,
  };
};

const average = (values: number[]): number =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const calculateFairnessScore = (teamA: FairPlayerProfile[], teamB: FairPlayerProfile[]): number => {
  const eloGap = Math.abs(average(teamA.map((player) => player.elo)) - average(teamB.map((player) => player.elo)));
  const winRateGap = Math.abs(
    average(teamA.map((player) => player.winRate)) - average(teamB.map((player) => player.winRate)),
  );
  return eloGap + winRateGap * 160;
};

const buildFairMatchSuggestion = (
  players: LeaderboardEntry[],
  sessionUserId: string,
  matchType: "singles" | "doubles",
): SuggestedMatchup | null => {
  const profiles = players.map(toFairPlayerProfile);
  const sessionPlayer = profiles.find((player) => player.userId === sessionUserId);

  if (!sessionPlayer) {
    return null;
  }

  const availablePlayers = profiles.filter((player) => player.userId !== sessionUserId);

  if (matchType === "singles") {
    if (availablePlayers.length === 0) {
      return null;
    }

    let bestOpponent = availablePlayers[0];
    let bestScore = calculateFairnessScore([sessionPlayer], [bestOpponent]);

    availablePlayers.slice(1).forEach((candidate) => {
      const score = calculateFairnessScore([sessionPlayer], [candidate]);
      if (score < bestScore) {
        bestOpponent = candidate;
        bestScore = score;
      }
    });

    return {
      teamAPlayerIds: [sessionPlayer.userId],
      teamBPlayerIds: [bestOpponent.userId],
      fairnessScore: bestScore,
    };
  }

  if (availablePlayers.length < 3) {
    return null;
  }

  let bestSuggestion: SuggestedMatchup | null = null;

  for (let indexA = 0; indexA < availablePlayers.length; indexA += 1) {
    const teammate = availablePlayers[indexA];
    const remainingOpponents = availablePlayers.filter((player) => player.userId !== teammate.userId);

    for (let indexB = 0; indexB < remainingOpponents.length - 1; indexB += 1) {
      for (let indexC = indexB + 1; indexC < remainingOpponents.length; indexC += 1) {
        const teamA = [sessionPlayer, teammate];
        const teamB = [remainingOpponents[indexB], remainingOpponents[indexC]];
        const fairnessScore = calculateFairnessScore(teamA, teamB);

        if (!bestSuggestion || fairnessScore < bestSuggestion.fairnessScore) {
          bestSuggestion = {
            teamAPlayerIds: teamA.map((player) => player.userId),
            teamBPlayerIds: teamB.map((player) => player.userId),
            fairnessScore,
          };
        }
      }
    }
  }

  return bestSuggestion;
};

const nextPowerOfTwo = (value: number): number => {
  let size = 1;
  while (size < value) {
    size *= 2;
  }
  return size;
};

const buildSeedOrder = (size: number): number[] => {
  if (size === 1) {
    return [1];
  }

  const previous = buildSeedOrder(size / 2);
  const result: number[] = [];

  previous.forEach((seed) => {
    result.push(seed, size + 1 - seed);
  });

  return result;
};

const getTournamentRoundTitle = (matchCount: number): string => {
  if (matchCount === 1) {
    return "Final";
  }
  if (matchCount === 2) {
    return "Semifinals";
  }
  if (matchCount === 4) {
    return "Quarterfinals";
  }
  return `Round of ${matchCount * 2}`;
};

const getPlayerStrengthScore = (player: LeaderboardEntry): number => {
  const totalMatches = player.wins + player.losses;
  const winRate = totalMatches > 0 ? player.wins / totalMatches : 0.5;
  return player.elo + winRate * 120 + Math.min(totalMatches, 20) * 2;
};

const buildTournamentSuggestion = (
  players: LeaderboardEntry[],
  participantIds: string[],
): { firstRoundMatches: TournamentPlannerMatch[]; rounds: TournamentPlannerRound[] } | null => {
  if (participantIds.length < 2) {
    return null;
  }

  const selectedPlayers = participantIds
    .map((participantId) => players.find((player) => player.userId === participantId) || null)
    .filter((player): player is LeaderboardEntry => player !== null)
    // Stronger global players receive the top seeds and therefore any auto-advance slots.
    .sort((left, right) => getPlayerStrengthScore(right) - getPlayerStrengthScore(left));

  const bracketSize = nextPowerOfTwo(selectedPlayers.length);
  const seedOrder = buildSeedOrder(bracketSize);
  const slots = seedOrder.map((seed) => selectedPlayers[seed - 1]?.userId || null);
  const firstRoundMatches: TournamentPlannerMatch[] = [];

  for (let index = 0; index < slots.length; index += 2) {
    firstRoundMatches.push({
      id: `round_1_match_${index / 2 + 1}`,
      leftPlayerId: slots[index] || null,
      rightPlayerId: slots[index + 1] || null,
    });
  }

  const rounds: TournamentPlannerRound[] = [
    {
      title: getTournamentRoundTitle(firstRoundMatches.length),
      matches: firstRoundMatches,
    },
  ];

  let currentMatchCount = firstRoundMatches.length;
  let roundIndex = 2;
  while (currentMatchCount > 1) {
    const nextMatchCount = currentMatchCount / 2;
    const matches: TournamentPlannerMatch[] = Array.from({ length: nextMatchCount }, (_, index) => ({
      id: `round_${roundIndex}_match_${index + 1}`,
      leftPlayerId: null,
      rightPlayerId: null,
    }));
    rounds.push({
      title: getTournamentRoundTitle(matches.length),
      matches,
    });
    currentMatchCount = nextMatchCount;
    roundIndex += 1;
  }

  return {
    firstRoundMatches,
    rounds,
  };
};

const applyTournamentWinnerLocally = (
  rounds: TournamentPlannerRound[],
  roundIndex: number,
  matchIndex: number,
  winnerPlayerId: string,
): TournamentPlannerRound[] =>
  rounds.map((round, currentRoundIndex) => ({
    title: round.title,
    matches: round.matches.map((match, currentMatchIndex) => {
      if (currentRoundIndex === roundIndex && currentMatchIndex === matchIndex) {
        return {
          ...match,
          winnerPlayerId,
        };
      }

      if (currentRoundIndex === roundIndex + 1 && currentMatchIndex === Math.floor(matchIndex / 2)) {
        return matchIndex % 2 === 0
          ? { ...match, leftPlayerId: winnerPlayerId }
          : { ...match, rightPlayerId: winnerPlayerId };
      }

      return match;
    }),
  }));

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

  const createMatchScreen = document.createElement("section");
  createMatchScreen.className = "dashboard";
  createMatchScreen.hidden = true;

  const createTournamentScreen = document.createElement("section");
  createTournamentScreen.className = "dashboard";
  createTournamentScreen.hidden = true;

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

  const openCreateMatchButton = document.createElement("button");
  openCreateMatchButton.type = "button";
  openCreateMatchButton.className = "secondary-button";
  openCreateMatchButton.textContent = "Create match";

  const openCreateTournamentButton = document.createElement("button");
  openCreateTournamentButton.type = "button";
  openCreateTournamentButton.className = "secondary-button";
  openCreateTournamentButton.textContent = "Tournaments";

  const dashboardStatus = document.createElement("p");
  dashboardStatus.className = "dashboard-status";

  const viewGrid = document.createElement("div");
  viewGrid.className = "view-grid";

  const leaderboardPanel = document.createElement("section");
  leaderboardPanel.className = "content-card";

  const leaderboardTop = document.createElement("div");
  leaderboardTop.className = "card-header leaderboard-topline";

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

  const closeCreateMatchButton = document.createElement("button");
  closeCreateMatchButton.type = "button";
  closeCreateMatchButton.className = "secondary-button";
  closeCreateMatchButton.textContent = "Back";

  const composerHeading = document.createElement("div");

  const composerTitle = document.createElement("h3");
  composerTitle.className = "card-title";
  composerTitle.textContent = "Create match";

  const composerMeta = document.createElement("p");
  composerMeta.className = "card-meta";
  composerMeta.textContent = "";

  const composerStatus = document.createElement("p");
  composerStatus.className = "form-status";

  const suggestMatchButton = document.createElement("button");
  suggestMatchButton.type = "button";
  suggestMatchButton.className = "secondary-button";
  suggestMatchButton.textContent = "Suggest fair teams";

  const matchForm = document.createElement("form");
  matchForm.className = "match-form";

  const matchTypeSelect = document.createElement("select");
  matchTypeSelect.className = "select-input";

  const formatTypeSelect = document.createElement("select");
  formatTypeSelect.className = "select-input";

  const pointsToWinSelect = document.createElement("select");
  pointsToWinSelect.className = "select-input";

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

  const scoreSection = document.createElement("div");
  scoreSection.className = "form-field";

  const scoreLabel = document.createElement("span");
  scoreLabel.className = "field-label";
  scoreLabel.textContent = "Score";

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

  const tournamentPanel = document.createElement("section");
  tournamentPanel.className = "content-card tournament-card";

  const tournamentTop = document.createElement("div");
  tournamentTop.className = "card-header";

  const tournamentHeading = document.createElement("div");

  const tournamentTitle = document.createElement("h3");
  tournamentTitle.className = "card-title";
  tournamentTitle.textContent = "Create tournament";

  const tournamentMeta = document.createElement("p");
  tournamentMeta.className = "card-meta";
  tournamentMeta.textContent = "Select participants, then generate a fair singles bracket.";

  const closeCreateTournamentButton = document.createElement("button");
  closeCreateTournamentButton.type = "button";
  closeCreateTournamentButton.className = "secondary-button";
  closeCreateTournamentButton.textContent = "Back";

  const tournamentNameInput = document.createElement("input");
  tournamentNameInput.className = "text-input";
  tournamentNameInput.placeholder = "Tournament name";

  const loadTournamentSelect = document.createElement("select");
  loadTournamentSelect.className = "select-input";

  const loadTournamentButton = document.createElement("button");
  loadTournamentButton.type = "button";
  loadTournamentButton.className = "secondary-button";
  loadTournamentButton.textContent = "Load tournament";

  const tournamentStatus = document.createElement("p");
  tournamentStatus.className = "form-status";

  const participantSection = document.createElement("div");
  participantSection.className = "form-field";

  const participantLabel = document.createElement("span");
  participantLabel.className = "field-label";
  participantLabel.textContent = "Participants";

  const participantList = document.createElement("div");
  participantList.className = "participant-list";

  const suggestTournamentButton = document.createElement("button");
  suggestTournamentButton.type = "button";
  suggestTournamentButton.className = "primary-button";
  suggestTournamentButton.textContent = "Suggest tournament";

  const saveTournamentButton = document.createElement("button");
  saveTournamentButton.type = "button";
  saveTournamentButton.className = "primary-button";
  saveTournamentButton.textContent = "Save tournament";

  const bracketBoard = document.createElement("div");
  bracketBoard.className = "bracket-board";

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
    screen: "dashboard",
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
  matchBracketContextByMatchId: {},
  matchSubmitting: false,
  matchFormError: "",
  matchFormMessage: "",
  pendingCreateRequestId: "",
  };

  const tournamentPlannerState: TournamentPlannerState = {
    name: "",
    tournamentId: "",
    participantIds: [],
    firstRoundMatches: [],
    rounds: [],
    error: "",
  };

  let activeTournamentBracketMatchId: string | null = null;

  const hasTournamentProgress = (): boolean =>
    tournamentPlannerState.rounds.some((round, roundIndex) =>
      round.matches.some((match) => {
        if (match.createdMatchId || match.winnerPlayerId) {
          return true;
        }
        return roundIndex > 0 && Boolean(match.leftPlayerId || match.rightPlayerId);
      }),
    );

  const syncAuthState = (): void => {
    if (isAuthedState(state.current)) {
      providerStack.replaceChildren(logoutButton);
      dashboard.hidden = dashboardState.screen !== "dashboard";
      createMatchScreen.hidden = dashboardState.screen !== "createMatch";
      createTournamentScreen.hidden = dashboardState.screen !== "createTournament";
      welcomeTitle.textContent = "Dashboard";
      welcomeText.textContent = "";
      return;
    }

    providerStack.replaceChildren(googleSlot);
    dashboard.hidden = true;
    createMatchScreen.hidden = true;
    createTournamentScreen.hidden = true;
  };

  const syncDashboardState = (): void => {
    const activeLabel =
      dashboardState.segmentMode === "global"
        ? "Global leaderboard"
        : dashboardState.segmentMode === "season"
          ? seasonSelect.selectedOptions[0]?.textContent || "Season leaderboard"
          : tournamentSelect.selectedOptions[0]?.textContent || "Tournament leaderboard";

    leaderboardMeta.textContent = activeLabel;

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
    openCreateMatchButton.disabled = dashboardState.loading || dashboardState.matchesLoading;
    openCreateTournamentButton.disabled = dashboardState.loading || dashboardState.matchesLoading;
    closeCreateMatchButton.disabled = dashboardState.matchSubmitting;
    suggestMatchButton.disabled = dashboardState.loading || dashboardState.matchSubmitting;
    loadTournamentButton.disabled = dashboardState.loading;
    saveTournamentButton.disabled = dashboardState.loading || tournamentPlannerState.rounds.length === 0;
    suggestTournamentButton.disabled =
      dashboardState.loading ||
      tournamentPlannerState.participantIds.length < 2 ||
      hasTournamentProgress();
    loadMoreButton.disabled = dashboardState.matchesLoading;
    loadMoreButton.hidden = !dashboardState.matchesCursor;
    submitMatchButton.disabled = dashboardState.matchSubmitting || dashboardState.loading;
    composerStatus.textContent = dashboardState.matchFormError || dashboardState.matchFormMessage;
    composerStatus.dataset.status = dashboardState.matchFormError ? "error" : "ready";
    tournamentStatus.textContent = tournamentPlannerState.error;
    tournamentStatus.dataset.status = tournamentPlannerState.error ? "error" : "ready";

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
        if (entry.rank <= 3) {
          row.dataset.rankTier = String(entry.rank);
        }

        const avatar = document.createElement("img");
        avatar.className = "player-avatar";
        avatar.src = entry.avatarUrl || `${import.meta.env.BASE_URL}assets/logo.png`;
        avatar.alt = `${entry.displayName} avatar`;

        const summary = document.createElement("span");
        summary.className = "leaderboard-summary";

        const identity = document.createElement("span");
        identity.className = "leaderboard-identity";
        identity.textContent = `#${entry.rank} ${entry.displayName}`;

        const stats = document.createElement("span");
        stats.className = "leaderboard-stats";
        stats.textContent = ` ${entry.wins}-${entry.losses} ${renderStreak(entry.streak)} `;

        const elo = document.createElement("span");
        elo.className = "leaderboard-elo";
        elo.textContent = `(${entry.elo} Elo)`;

        summary.append(identity, stats, elo);
        row.append(avatar, summary);
        return row;
      });
      leaderboardList.replaceChildren(...rows);
    }

    matchesMeta.textContent = "";

    if (dashboardState.matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = dashboardState.loading ? "Loading matches..." : "No matches recorded yet.";
      matchesList.replaceChildren(empty);
    } else {
      const matchCards = dashboardState.matches.map((match) => {
        const cardNode = document.createElement("article");
        cardNode.className = "match-row";

        const meta = document.createElement("p");
        meta.className = "match-meta";

        const teamA = document.createElement("span");
        teamA.textContent = renderPlayerNames(match.teamAPlayerIds, dashboardState.players);
        if (match.winnerTeam === "A") {
          teamA.className = "winner-name";
        }

        const vs = document.createElement("span");
        vs.className = "match-separator";
        vs.textContent = " vs ";

        const teamB = document.createElement("span");
        teamB.textContent = renderPlayerNames(match.teamBPlayerIds, dashboardState.players);
        if (match.winnerTeam === "B") {
          teamB.className = "winner-name";
        }

        const score = document.createElement("span");
        score.className = "match-score";
        score.textContent = ` • ${renderMatchScore(match)}`;

        const bracketContext = dashboardState.matchBracketContextByMatchId[match.id] || null;
        const roundTag = document.createElement("span");
        roundTag.className = "match-round";
        if (bracketContext) {
          roundTag.textContent = ` • ${bracketContext.isFinal ? "🏆 " : ""}${bracketContext.roundTitle}`;
        }

        meta.append(teamA, vs, teamB, score, roundTag);

        const subline = document.createElement("p");
        subline.className = "match-subline";
        subline.textContent = `${formatDateTime(match.playedAt)} • ${renderMatchContext(
          match,
          dashboardState.seasons,
          dashboardState.tournaments,
          null,
        )}`;

        cardNode.append(meta, subline);
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

  const replacePlayerOptions = (
    select: HTMLSelectElement,
    options: Array<{ value: string; label: string }>,
    selectedValue: string,
    blockedValues: string[],
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
        node.disabled = option.value !== selectedValue && blockedValues.indexOf(option.value) !== -1;
        return node;
      }),
    );
  };

  const setIdleState = (): void => {
    state.current = hasBackendConfig
      ? { status: "idle", message: "Sign in with Google to open the leaderboard." }
      : { status: "error", message: "Configure the backend URL before testing login." };
    dashboardState.screen = "dashboard";
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

  const populateTournamentPlannerLoadOptions = (): void => {
    replaceOptions(
      loadTournamentSelect,
      [
        { value: "", label: "Saved tournaments" },
        ...dashboardState.tournaments.map((tournament) => ({
          value: tournament.id,
          label: tournament.name,
        })),
      ],
      tournamentPlannerState.tournamentId,
      "Saved tournaments",
    );
  };

  const renderTournamentPlanner = (): void => {
    const selectedParticipants = new Set(tournamentPlannerState.participantIds);
    const playerOptions = dashboardState.players;

    const participantCards = playerOptions.map((player) => {
      const label = document.createElement("label");
      label.className = "participant-chip";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedParticipants.has(player.userId);
      input.addEventListener("change", () => {
        if (input.checked) {
          tournamentPlannerState.participantIds = [...tournamentPlannerState.participantIds, player.userId];
        } else {
          tournamentPlannerState.participantIds = tournamentPlannerState.participantIds.filter(
            (participantId) => participantId !== player.userId,
          );
        }
        tournamentPlannerState.tournamentId = "";
        tournamentPlannerState.error = "";
        tournamentPlannerState.rounds = [];
        tournamentPlannerState.firstRoundMatches = [];
        loadTournamentSelect.value = "";
        renderTournamentPlanner();
        syncDashboardState();
      });

      const text = document.createElement("span");
      text.textContent = `${player.displayName} (${player.elo})`;

      label.append(input, text);
      return label;
    });

    participantList.replaceChildren(...participantCards);

    if (tournamentPlannerState.rounds.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Select at least 2 players, then generate a tournament bracket.";
      bracketBoard.replaceChildren(empty);
      return;
    }

    const roundColumns = tournamentPlannerState.rounds.map((round, roundIndex) => {
      const column = document.createElement("section");
      column.className = "bracket-round";

      const title = document.createElement("h4");
      title.className = "card-title";
      title.textContent = round.title;

      const matchNodes = round.matches.map((match, matchIndex) => {
        const cardNode = document.createElement("article");
        cardNode.className = "bracket-match";

        if (roundIndex === 0) {
          const usedIds = tournamentPlannerState.firstRoundMatches.flatMap((entry) => [
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

            select.addEventListener("change", () => {
              onChange(select.value || null);
              tournamentPlannerState.error = "";
              renderTournamentPlanner();
              syncDashboardState();
            });

            return select;
          };

          const leftSelect = createMatchSelect(match.leftPlayerId, (value) => {
            tournamentPlannerState.firstRoundMatches[matchIndex].leftPlayerId = value;
          });
          const rightSelect = createMatchSelect(match.rightPlayerId, (value) => {
            tournamentPlannerState.firstRoundMatches[matchIndex].rightPlayerId = value;
          });

          cardNode.append(leftSelect, rightSelect);
        } else {
          const left = document.createElement("p");
          left.className = "match-subline";
          const leftText = match.leftPlayerId
            ? renderPlayerNames([match.leftPlayerId], dashboardState.players)
            : `Winner ${tournamentPlannerState.rounds[roundIndex - 1].title} ${matchIndex * 2 + 1}`;
          const leftPlayer = findPlayer(match.leftPlayerId, dashboardState.players);
          const leftAvatar = document.createElement("img");
          leftAvatar.className = "player-avatar player-avatar-small";
          leftAvatar.src = leftPlayer?.avatarUrl || `${import.meta.env.BASE_URL}assets/logo.png`;
          leftAvatar.alt = leftText;
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
            ? renderPlayerNames([match.rightPlayerId], dashboardState.players)
            : `Winner ${tournamentPlannerState.rounds[roundIndex - 1].title} ${matchIndex * 2 + 2}`;
          const rightPlayer = findPlayer(match.rightPlayerId, dashboardState.players);
          const rightAvatar = document.createElement("img");
          rightAvatar.className = "player-avatar player-avatar-small";
          rightAvatar.src = rightPlayer?.avatarUrl || `${import.meta.env.BASE_URL}assets/logo.png`;
          rightAvatar.alt = rightText;
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
          advanceButton.disabled = !!match.winnerPlayerId;
          advanceButton.addEventListener("click", () => {
            void advanceTournamentBye(roundIndex, matchIndex);
          });
          cardNode.append(advanceButton);
        } else if (match.leftPlayerId && match.rightPlayerId) {
          const createMatchButton = document.createElement("button");
          createMatchButton.type = "button";
          createMatchButton.className = "secondary-button bracket-action";
          createMatchButton.textContent = match.createdMatchId ? "Match created" : "Create match";
          createMatchButton.disabled = !!match.createdMatchId || !tournamentPlannerState.tournamentId;
          createMatchButton.addEventListener("click", () => {
            prefillMatchFromTournamentPairing(match);
          });
          cardNode.append(createMatchButton);
        }

        return cardNode;
      });

      column.append(title, ...matchNodes);
      return column;
    });

    bracketBoard.replaceChildren(...roundColumns);
  };

  const populateMatchFormOptions = (): void => {
    const sessionUserId = isAuthedState(state.current) ? state.current.session.user.id : "";
    const teamA1Value = teamA1Select.value || sessionUserId;

    if (matchTypeSelect.value === "singles") {
      teamA2Select.value = "";
      teamB2Select.value = "";
    }

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
    const isDoubles = matchTypeSelect.value === "doubles";
    const nextTeamA1Value = teamA1Value;
    const nextTeamB1Value = teamB1Select.value;

    const getNextAvailablePlayer = (excluded: string[]): string => {
      const taken = new Set(excluded.filter(Boolean));
      const next = playerOptions.find((player) => !taken.has(player.value));
      return next ? next.value : "";
    };

    const resolveAvailablePlayer = (currentValue: string, excluded: string[]): string => {
      if (currentValue && excluded.indexOf(currentValue) === -1) {
        return currentValue;
      }
      return getNextAvailablePlayer(excluded);
    };

    const nextTeamA2Value = isDoubles
      ? resolveAvailablePlayer(teamA2Select.value, [nextTeamA1Value, nextTeamB1Value, teamB2Select.value])
      : "";
    const nextTeamB2Value = isDoubles
      ? resolveAvailablePlayer(teamB2Select.value, [nextTeamA1Value, nextTeamB1Value, nextTeamA2Value])
      : "";

    const selectedValues = [nextTeamA1Value, nextTeamA2Value, nextTeamB1Value, nextTeamB2Value].filter(Boolean);
    [
      { select: teamA1Select, selectedValue: nextTeamA1Value, emptyLabel: "Player 1 unavailable" },
      { select: teamA2Select, selectedValue: nextTeamA2Value, emptyLabel: "Player 2 unavailable" },
      { select: teamB1Select, selectedValue: nextTeamB1Value, emptyLabel: "Player 3 unavailable" },
      { select: teamB2Select, selectedValue: nextTeamB2Value, emptyLabel: "Player 4 unavailable" },
    ].forEach(({ select, selectedValue, emptyLabel }) => {
      replacePlayerOptions(
        select,
        playerOptions,
        selectedValue || select.value,
        selectedValues.filter((value) => value !== (selectedValue || select.value)),
        emptyLabel,
      );
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
      formSeasonSelect.value,
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

    teamA2Field.hidden = !isDoubles;
    teamB2Field.hidden = !isDoubles;

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

    const allPlayerIds = [...playerIdsA, ...playerIdsB].filter(Boolean);
    if (new Set(allPlayerIds).size !== allPlayerIds.length) {
      throw new Error("Each selected player must be unique across both teams.");
    }

    const visibleGames = formatTypeSelect.value === "best_of_3" ? 3 : 1;
    const score = scoreInputs
      .slice(0, visibleGames)
      .filter((game) => game.teamA.value !== "" && game.teamB.value !== "")
      .map((game) => ({
        teamA: Number(game.teamA.value),
        teamB: Number(game.teamB.value),
      }));

    return {
      matchType: matchTypeSelect.value as CreateMatchPayload["matchType"],
      formatType: formatTypeSelect.value as CreateMatchPayload["formatType"],
      pointsToWin: Number(pointsToWinSelect.value) as 11 | 21,
      teamAPlayerIds: playerIdsA,
      teamBPlayerIds: playerIdsB,
      score,
      winnerTeam: winnerTeamSelect.value as CreateMatchPayload["winnerTeam"],
      playedAt: new Date().toISOString(),
      seasonId: formSeasonSelect.value || null,
      tournamentId: formTournamentSelect.value || null,
      tournamentBracketMatchId: activeTournamentBracketMatchId,
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

  const loadMatchBracketContext = async (
    matches: MatchRecord[],
  ): Promise<Record<string, { roundTitle: string; isFinal: boolean }>> => {
    const tournamentIds = Array.from(
      new Set(matches.map((match) => match.tournamentId).filter((tournamentId): tournamentId is string => Boolean(tournamentId))),
    );

    if (tournamentIds.length === 0) {
      return {};
    }

    const contexts = await Promise.allSettled(
      tournamentIds.map(async (tournamentId) => {
        const data: GetTournamentBracketData = await runAuthedAction("getTournamentBracket", {
          tournamentId,
        });

        return data.rounds.reduce<Record<string, { roundTitle: string; isFinal: boolean }>>((accumulator, round) => {
          round.matches.forEach((roundMatch) => {
            if (roundMatch.createdMatchId) {
              accumulator[roundMatch.createdMatchId] = {
                roundTitle: round.title,
                isFinal: round.title === "Final",
              };
            }
          });
          return accumulator;
        }, {});
      }),
    );

    return contexts.reduce<Record<string, { roundTitle: string; isFinal: boolean }>>((accumulator, context) => {
      if (context.status === "fulfilled") {
        return { ...accumulator, ...context.value };
      }
      return accumulator;
    }, {});
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
        runAuthedAction("getMatches", { limit: 4 }),
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
      dashboardState.matchBracketContextByMatchId = await loadMatchBracketContext(matchesData.matches);

      populateSeasonOptions();
      populateTournamentOptions();
      populateTournamentPlannerLoadOptions();
      populateMatchFormOptions();
      renderTournamentPlanner();

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
        limit: 4,
      });
      dashboardState.matches = [...dashboardState.matches, ...data.matches];
      dashboardState.matchesCursor = data.nextCursor;
      dashboardState.matchBracketContextByMatchId = {
        ...dashboardState.matchBracketContextByMatchId,
        ...(await loadMatchBracketContext(data.matches)),
      };
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
      const returnToTournamentId = payload.tournamentId || null;
      const returnToTournament = Boolean(activeTournamentBracketMatchId && returnToTournamentId);
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
      activeTournamentBracketMatchId = null;
      dashboardState.screen = returnToTournament ? "createTournament" : "dashboard";
      syncAuthState();
      await loadDashboard();
      if (returnToTournamentId) {
        tournamentPlannerState.tournamentId = returnToTournamentId;
        loadTournamentSelect.value = returnToTournamentId;
      }
      if (returnToTournament) {
        await loadTournamentBracket();
      }
    } catch (error) {
      dashboardState.matchFormError =
        error instanceof Error ? error.message : "Failed to create match.";
    } finally {
      dashboardState.matchSubmitting = false;
      syncDashboardState();
    }
  };

  const applyFairMatchSuggestion = (): void => {
    if (!isAuthedState(state.current)) {
      return;
    }

    const suggestion = buildFairMatchSuggestion(
      dashboardState.players,
      state.current.session.user.id,
      matchTypeSelect.value as "singles" | "doubles",
    );

    if (!suggestion) {
      dashboardState.matchFormError = "Not enough available players to suggest a fair matchup.";
      dashboardState.matchFormMessage = "";
      syncDashboardState();
      return;
    }

    teamA1Select.value = suggestion.teamAPlayerIds[0] || "";
    teamA2Select.value = suggestion.teamAPlayerIds[1] || "";
    teamB1Select.value = suggestion.teamBPlayerIds[0] || "";
    teamB2Select.value = suggestion.teamBPlayerIds[1] || "";
    dashboardState.matchFormError = "";
    dashboardState.matchFormMessage = `Suggested matchup ready.`;
    populateMatchFormOptions();
    syncDashboardState();
  };

  const suggestTournamentBracket = (): void => {
    if (tournamentPlannerState.participantIds.length < 2) {
      tournamentPlannerState.error = "Select at least 2 participants.";
      tournamentPlannerState.rounds = [];
      tournamentPlannerState.firstRoundMatches = [];
      renderTournamentPlanner();
      syncDashboardState();
      return;
    }

    const suggestion = buildTournamentSuggestion(dashboardState.players, tournamentPlannerState.participantIds);
    if (!suggestion) {
      tournamentPlannerState.error = "Unable to build a bracket from the selected players.";
      renderTournamentPlanner();
      syncDashboardState();
      return;
    }

    tournamentPlannerState.firstRoundMatches = suggestion.firstRoundMatches.map((match) => ({ ...match }));
    tournamentPlannerState.rounds = suggestion.rounds.map((round, roundIndex) => ({
      title: round.title,
      matches:
        roundIndex === 0
          ? tournamentPlannerState.firstRoundMatches
          : round.matches.map((match) => ({ ...match })),
    }));
    tournamentPlannerState.error = "";
    renderTournamentPlanner();
    syncDashboardState();
  };

  const loadTournamentBracket = async (): Promise<void> => {
    if (!tournamentPlannerState.tournamentId) {
      tournamentPlannerState.error = "Select a saved tournament first.";
      renderTournamentPlanner();
      syncDashboardState();
      return;
    }

    try {
      const data: GetTournamentBracketData = await runAuthedAction("getTournamentBracket", {
        tournamentId: tournamentPlannerState.tournamentId,
      });

      tournamentPlannerState.name = data.tournament.name;
      tournamentNameInput.value = data.tournament.name;
      tournamentPlannerState.participantIds = data.participantIds;
      tournamentPlannerState.rounds = data.rounds.map((round) => ({
        title: round.title,
        matches: round.matches.map((match) => ({
          id: match.id,
          leftPlayerId: match.leftPlayerId,
          rightPlayerId: match.rightPlayerId,
          createdMatchId: match.createdMatchId,
          winnerPlayerId: match.winnerPlayerId,
        })),
      }));
      tournamentPlannerState.firstRoundMatches = tournamentPlannerState.rounds[0]
        ? tournamentPlannerState.rounds[0].matches
        : [];
      tournamentPlannerState.error = "";
      renderTournamentPlanner();
      syncDashboardState();
    } catch (error) {
      tournamentPlannerState.error =
        error instanceof Error ? error.message : "Failed to load tournament.";
      renderTournamentPlanner();
      syncDashboardState();
    }
  };

  const saveTournament = async (): Promise<void> => {
    try {
      const payload: CreateTournamentPayload = {
        tournamentId: tournamentPlannerState.tournamentId || null,
        name: tournamentNameInput.value.trim() || "New tournament",
        seasonId: null,
        participantIds: tournamentPlannerState.participantIds,
        rounds: tournamentPlannerState.rounds as TournamentBracketRound[],
      };
      const data = await runAuthedAction("createTournament", payload);
      tournamentPlannerState.tournamentId = data.tournament.id;
      tournamentPlannerState.name = data.tournament.name;
      dashboardState.matchFormMessage = "";
      tournamentPlannerState.error = "";
      await loadDashboard();
      populateTournamentPlannerLoadOptions();
      loadTournamentSelect.value = data.tournament.id;
      renderTournamentPlanner();
      syncDashboardState();
    } catch (error) {
      tournamentPlannerState.error =
        error instanceof Error ? error.message : "Failed to save tournament.";
      renderTournamentPlanner();
      syncDashboardState();
    }
  };

  const advanceTournamentBye = async (roundIndex: number, matchIndex: number): Promise<void> => {
    const match = tournamentPlannerState.rounds[roundIndex]?.matches[matchIndex];
    if (!match) {
      return;
    }

    const winnerPlayerId = match.leftPlayerId || match.rightPlayerId;
    if (!winnerPlayerId || match.winnerPlayerId) {
      return;
    }

    tournamentPlannerState.rounds = applyTournamentWinnerLocally(
      tournamentPlannerState.rounds,
      roundIndex,
      matchIndex,
      winnerPlayerId,
    );
    tournamentPlannerState.firstRoundMatches = tournamentPlannerState.rounds[0]
      ? tournamentPlannerState.rounds[0].matches
      : [];
    tournamentPlannerState.error = "";
    renderTournamentPlanner();
    syncDashboardState();

    if (tournamentPlannerState.tournamentId) {
      await saveTournament();
    }
  };

  const prefillMatchFromTournamentPairing = (match: TournamentPlannerMatch): void => {
    const tournament = dashboardState.tournaments.find(
      (entry) => entry.id === tournamentPlannerState.tournamentId,
    );

    matchTypeSelect.value = "singles";
    formatTypeSelect.value = "single_game";
    pointsToWinSelect.value = "11";
    teamA1Select.value = match.leftPlayerId || "";
    teamA2Select.value = "";
    teamB1Select.value = match.rightPlayerId || "";
    teamB2Select.value = "";
    formSeasonSelect.value = tournament?.seasonId || "";
    formTournamentSelect.value = tournamentPlannerState.tournamentId || "";
    winnerTeamSelect.value = "A";
    scoreInputs.forEach((game) => {
      game.teamA.value = "";
      game.teamB.value = "";
    });
    activeTournamentBracketMatchId = match.id;
    dashboardState.screen = "createMatch";
    populateMatchFormOptions();
    syncAuthState();
    syncDashboardState();
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

  openCreateMatchButton.addEventListener("click", () => {
    dashboardState.screen = "createMatch";
    syncAuthState();
    syncDashboardState();
  });

  openCreateTournamentButton.addEventListener("click", () => {
    dashboardState.screen = "createTournament";
    tournamentPlannerState.error = "";
    populateTournamentPlannerLoadOptions();
    renderTournamentPlanner();
    syncAuthState();
    syncDashboardState();
  });

  closeCreateMatchButton.addEventListener("click", () => {
    dashboardState.screen = "dashboard";
    syncAuthState();
    syncDashboardState();
  });

  closeCreateTournamentButton.addEventListener("click", () => {
    dashboardState.screen = "dashboard";
    syncAuthState();
    syncDashboardState();
  });

  suggestMatchButton.addEventListener("click", () => {
    applyFairMatchSuggestion();
  });

  suggestTournamentButton.addEventListener("click", () => {
    suggestTournamentBracket();
  });

  loadTournamentButton.addEventListener("click", () => {
    void loadTournamentBracket();
  });

  loadTournamentSelect.addEventListener("change", () => {
    tournamentPlannerState.tournamentId = loadTournamentSelect.value;
  });

  tournamentNameInput.addEventListener("input", () => {
    tournamentPlannerState.name = tournamentNameInput.value;
  });

  saveTournamentButton.addEventListener("click", () => {
    void saveTournament();
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

  [
    matchTypeSelect,
    formatTypeSelect,
    formSeasonSelect,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
  ].forEach((input) => {
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
  composerTop.append(composerHeading, closeCreateMatchButton);

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
  const teamA1Field = buildField("Team A player 1", teamA1Select);
  const teamA2Field = buildField("Team A player 2", teamA2Select);
  const teamB1Field = buildField("Team B player 1", teamB1Select);
  const teamB2Field = buildField("Team B player 2", teamB2Select);
  teamGrid.append(
    teamA1Field,
    teamA2Field,
    teamB1Field,
    teamB2Field,
  );

  scoreInputs.forEach((game, index) => {
    const row = document.createElement("div");
    row.className = "score-row";

    const gameLabel = document.createElement("span");
    gameLabel.className = "score-game-label";
    gameLabel.textContent = `Game ${index + 1}`;

    const separator = document.createElement("span");
    separator.className = "score-separator";
    separator.textContent = "/";

    game.teamA.placeholder = "Team A";
    game.teamB.placeholder = "Team B";

    row.append(gameLabel, game.teamA, separator, game.teamB);
    scoreGrid.append(row);
  });

  scoreSection.append(scoreLabel, scoreGrid);

  matchForm.append(
    buildField("Match type", matchTypeSelect),
    buildField("Format", formatTypeSelect),
    buildField("Points to win", pointsToWinSelect),
    buildField("Season", formSeasonSelect),
    buildField("Tournament", formTournamentSelect),
    teamGrid,
    suggestMatchButton,
    buildField("Winner", winnerTeamSelect),
    scoreSection,
    submitMatchButton,
  );

  composerPanel.append(composerTop, composerStatus, matchForm);

  welcomeBlock.append(welcomeTitle, welcomeText);
  actionsBar.append(refreshButton, openCreateMatchButton, openCreateTournamentButton);
  dashboardHeader.append(welcomeBlock, actionsBar);
  viewGrid.append(leaderboardPanel, matchesPanel);
  dashboard.append(dashboardHeader, dashboardStatus, viewGrid);
  createMatchScreen.append(composerPanel);

  tournamentHeading.append(tournamentTitle, tournamentMeta);
  tournamentTop.append(tournamentHeading, closeCreateTournamentButton);
  participantSection.append(participantLabel, participantList);
  tournamentPanel.append(
    tournamentTop,
    buildField("Load saved tournament", loadTournamentSelect),
    loadTournamentButton,
    buildField("Tournament name", tournamentNameInput),
    participantSection,
    tournamentStatus,
    suggestTournamentButton,
    saveTournamentButton,
    bracketBoard,
  );
  createTournamentScreen.append(tournamentPanel);

  header.append(brandMark, providerStack);
  card.append(header, dashboard, createMatchScreen, createTournamentScreen);
  container.append(card);

  googleSlot.classList.toggle("provider-disabled", !isProviderConfigured());
  populateMatchFormOptions();
  renderTournamentPlanner();

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
