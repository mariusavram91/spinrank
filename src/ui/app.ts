import type {
  ApiAction,
  ApiActionMap,
  AppSession,
  BootstrapUserData,
  CreateMatchPayload,
  CreateSeasonPayload,
  CreateTournamentPayload,
  DeactivateEntityData,
  GetDashboardData,
  GetMatchesData,
  GetTournamentBracketData,
  GetUserProgressData,
  LeaderboardEntry,
  MatchBracketContext,
  MatchFeedFilter,
  MatchRecord,
  SeasonRecord,
  TournamentBracketRound,
  TournamentRecord,
  SegmentLeaderboardStats,
  SegmentType,
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
  screen: "dashboard" | "createMatch" | "createTournament" | "createSeason" | "faq" | "privacy";
  loading: boolean;
  error: string;
  leaderboard: LeaderboardEntry[];
  players: LeaderboardEntry[];
  leaderboardUpdatedAt: string;
  leaderboardStats: SegmentLeaderboardStats | null;
  userProgress: GetUserProgressData | null;
  segmentMode: SegmentMode;
  selectedSeasonId: string;
  selectedTournamentId: string;
  seasons: SeasonRecord[];
  tournaments: TournamentRecord[];
  matchesFilter: MatchFeedFilter;
  matches: MatchRecord[];
  matchesCursor: string | null;
  matchesLoading: boolean;
  matchBracketContextByMatchId: Record<string, { roundTitle: string; isFinal: boolean }>;
  matchSubmitting: boolean;
  matchFormError: string;
  matchFormMessage: string;
  seasonSubmitting: boolean;
  seasonFormError: string;
  seasonFormMessage: string;
  tournamentSubmitting: boolean;
  tournamentFormMessage: string;
  editingSeasonId: string;
  editingSeasonParticipantIds: string[];
  pendingCreateRequestId: string;
  shareCache: Record<string, SegmentShareInfo>;
  shareErrors: Record<string, string>;
  shareLoadingSegmentKey: string;
  shareNotice: string;
  pendingShareToken: string;
  sharePanelSeasonTargetId: string;
  sharePanelTournamentTargetId: string;
  shareAlertMessage: string;
}

interface SegmentShareInfo {
  segmentType: SegmentType;
  segmentId: string;
  shareToken: string;
  url: string;
  expiresAt: string;
}

interface SharePanelElements {
  section: HTMLElement;
  createButton: HTMLButtonElement;
  copyButton: HTMLButtonElement;
  status: HTMLParagraphElement;
  qrCanvas: HTMLCanvasElement;
  qrWrapper: HTMLElement;
  copyFeedback: HTMLSpanElement;
  animationTimer: number | null;
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
  locked?: boolean;
  isFinal?: boolean;
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

const formatCount = (value: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.max(0, value));

const getTodayDateValue = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getBackendOrigin = (): string => {
  if (!env.backendUrl) {
    return "";
  }

  try {
    return new URL(env.backendUrl).origin;
  } catch {
    return "";
  }
};

const getAvatarSrc = (userId: string | null | undefined, avatarUrl: string | null | undefined): string | null => {
  if (!avatarUrl) {
    return null;
  }

  const backendOrigin = getBackendOrigin();
  if (!backendOrigin || !userId) {
    return avatarUrl;
  }

  return `${backendOrigin}/avatar/${encodeURIComponent(userId)}`;
};

const setAvatarImage = (
  image: HTMLImageElement,
  userId: string | null | undefined,
  avatarUrl: string | null | undefined,
  fallbackSrc: string,
  alt: string,
): void => {
  image.alt = alt;
  image.onerror = () => {
    image.onerror = null;
    image.src = fallbackSrc;
  };
  image.src = getAvatarSrc(userId, avatarUrl) || fallbackSrc;
};

const languageOptions = {
  en: { label: "English", flag: "🇬🇧" },
  de: { label: "Deutsch", flag: "🇩🇪" },
} as const;

type FaqDetail = {
  en: string;
  de: string;
};

interface FaqEntry {
  titleEn: string;
  titleDe: string;
  details: FaqDetail[];
}

const faqEntries: FaqEntry[] = [
  {
    titleEn: "How Elo works",
    titleDe: "Wie Elo funktioniert",
    details: [
      {
        en: "Every ranked match updates both players: winners gain Elo, losers drop Elo, and the size of the change depends on how big the pre-match rating gap was and whether you played a single game or best-of-3.",
        de: "Jedes gerankte Match verändert beide Spieler: Gewinner bekommen Punkte, Verlierer verlieren Punkte, und die Höhe der Änderung richtet sich nach dem Rating-Unterschied vor dem Spiel und dem Spielmodus.",
      },
      {
        en: "SpinRank follows the classic Elo formula, applies a combined K-factor (40 until you reach 30 matches, then 24), so newer or less-active players jump faster while steady players settle, and splits the rounded change evenly across teammates.",
        de: "SpinRank nutzt die klassische Elo-Formel und einen kombinierten K-Faktor (40 bis 30 Matches, danach 24), so dass neue oder selten aktive Spieler größere Sprünge machen, während Regelmäßige ruhiger werden, und die gerundete Änderung gleichmäßig auf beide Partner verteilt wird.",
      },
      {
        en: "In doubles matches we average both teams’ ratings before running the math, and every player shares the same signed change so partnerships move together.",
        de: "Bei Doppelmatches mitteln wir die Ratings beider Teams, berechnen die Änderung und teilen denselben Wert an jedes Teammitglied aus, damit Partner gleich stark nach oben oder unten gehen.",
      },
    ],
  },
  {
    titleEn: "Soft deletes & recalculations",
    titleDe: "Soft Deletes & Nachberechnungen",
    details: [
      {
        en: "Deleted matches, tournaments, or seasons stay visible in your history but stop counting toward rankings, and the backend reruns the remaining results so leaderboards and streaks adjust to the removal.",
        de: "Gelöschte Matches, Turniere oder Saisons bleiben im Verlauf sichtbar, zählen aber nicht mehr für Ranglisten; das System blickt die übrigen Ergebnisse nochmal durch, damit Listen und Serien sich entsprechend anpassen.",
      },
      {
        en: "Because the same Elo math runs again without the deleted result, everyone in that season or tournament can drift a few points up or down depending on how that match influenced expectations.",
        de: "Weil nach dem Entfernen eines Ergebnisses die gleiche Elo-Rechnung nochmal durchläuft, können sich alle Beteiligten in der jeweiligen Saison oder dem Turnier je nach Einfluss der entfernten Partie um ein paar Punkte nach oben oder unten bewegen.",
      },
    ],
  },
  {
    titleEn: "Global, Season & Tournament Rankings",
    titleDe: "Globale, Saison- & Turnier-Rankings",
    details: [
      {
        en: "The global leaderboard aggregates every ranked match you can access; season and tournament leaderboards only include matches assigned to that context.",
        de: "Die globale Bestenliste fasst alle gerankten Matches zusammen; Saison- und Turnierlisten zeigen nur die Partien, die genau diesem Kontext zugewiesen wurden.",
      },
      {
        en: "Tournaments can be tied to a season; when linked, their matches impact both the tournament leaderboard and the parent season.",
        de: "Turniere lassen sich einer Saison zuordnen; sind sie verknüpft, beeinflussen ihre Matches sowohl das Turnier-Ranking als auch die übergeordnete Saison.",
      },
      {
        en: "Within any leaderboard we sort by Elo first, then by more wins, fewer losses, and finally alphabetically so ties stay consistent.",
        de: "In jeder Liste sortieren wir nach Elo, bei Gleichstand nach mehr Siegen, dann weniger Niederlagen und zuletzt alphabetisch, damit es immer eine klare Reihenfolge gibt.",
      },
    ],
  },
  {
    titleEn: "Match contexts & types",
    titleDe: "Match-Kontexte & Typen",
    details: [
      {
        en: "Matches can be singles or doubles, played as single games or best-of-3, and you can choose the number of points needed for victory.",
        de: "Matches können Einzel- oder Doppelpartien sein, als Einzelspiel oder Best-of-3 ausgetragen werden, und du legst fest, wie viele Punkte den Sieg entscheiden.",
      },
      {
        en: "You can leave the season or tournament fields empty to log open-play matches; they still count toward the global Elo.",
        de: "Lässt du Saison- oder Turnierfelder frei, bleibt das Match ein freies Spiel und wirkt sich dennoch auf die globale Elo aus.",
      },
    ],
  },
  {
    titleEn: "Seasons, tournaments & matches",
    titleDe: "Saisons, Turniere & Matches",
    details: [
      {
        en: "Seasons group matches and tournaments over a span of time; save them once and reuse them whenever you want to drop results under that season.",
        de: "Saisons bündeln Matches und Turniere in einem Zeitraum; speichere sie einmal und verwende sie immer wieder, wenn du Ergebnisse dieser Saison zuordnen willst.",
      },
      {
        en: "You can record matches that don't belong to any season or tournament—great for pickup games or practice—while tournaments can live inside a season without forcing every match to carry the season tag.",
        de: "Du kannst auch Matches protokollieren, die keiner Saison oder keinem Turnier angehören, etwa für spontane Spiele oder Training, und Turniere dürfen einer Saison angehören, ohne dass jede Partie automatisch den Saison-Tag braucht.",
      },
    ],
  },
  {
    titleEn: "Season Elo modes",
    titleDe: "Saison-Elo-Modi",
    details: [
      {
        en: "Choosing ‘Carry over Elo’ keeps everyone’s current rating, streaks, and win/loss record in the new season, while ‘Reset Elo to 1200’ gives everyone a fresh 1200 rating so the leaderboard starts from scratch.",
        de: "Mit „Carry over Elo“ übernimmt die neue Saison alle bisherigen Ratings, Serien und Siege/Niederlagen; „Reset Elo to 1200“ startet mit 1200 Punkten und behandelt die Saison wie einen sauberen Neustart.",
      },
      {
        en: "Either way, every match still shows up in the global history; resetting is useful if you want a new league or throwback event without past streaks or hot runs dominating the standings.",
        de: "Beide Modi behalten die Matches in der globalen Historie; ein Reset eignet sich, wenn du eine neue Liga oder Retro-Veranstaltung willst, ohne dass alte Serien die Tabelle dominieren.",
      },
    ],
  },
  {
    titleEn: "Suggest helpers",
    titleDe: "Vorschlagshelfer",
    details: [
      {
        en: "“Suggest fair teams” looks at Elo plus win rate to balance you with the closest-matched opponents, then fills the match form for you so you can just confirm the score.",
        de: "„Faire Teams vorschlagen“ verwendet Elo und Siegquote, um dich mit einem ähnlich starken Gegner zu kombinieren, und trägt die Auswahl direkt ins Match-Formular ein.",
      },
      {
        en: "“Suggest tournament” seeds a bracket by ranking players with a strength score (Elo + win rate + recent activity) and separating top seeds, so the planner panels update with those placements and you can immediately generate matches.",
        de: "„Turnier vorschlagen“ ordnet die Teilnehmenden nach einem Strength-Score (Elo + Siegquote + Aktivität), verteilt die Top-Seeds und aktualisiert das Bracket-Panel, damit du direkt Matches erzeugen kannst.",
      },
    ],
  },
];

type LanguageCode = keyof typeof languageOptions;

const translations = {
  en: {
    autoAdvance: "Auto-advance",
    back: "Back",
    baseElo: "Base Elo",
    bracketPreviewEmpty: "Select at least 2 participants to preview the bracket.",
    bracketPreviewSection: "Bracket preview",
    carryOverElo: "Carry over Elo",
    close: "Close",
    createMatch: "Create match",
    createSeason: "Create season",
    createTournament: "Create tournament",
    dashboardTitle: "Dashboard",
    deleteMatch: "Delete match",
    deleteSeason: "Delete season",
    deleteTournament: "Delete tournament",
    deleteModalTitleMatch: "Delete match?",
    deleteModalTitleSeason: "Delete season?",
    deleteModalTitleTournament: "Delete tournament?",
    deleteModalBodyMatch:
      "This match will be soft-deleted and Elo scores will be recalculated.",
    deleteModalBodySeason:
      "All linked tournaments and matches will be soft-deleted and Elo scores will be recalculated.",
    deleteModalBodyTournament:
      "All tournament matches will be soft-deleted and Elo scores will be recalculated.",
    deleteModalSeasonHint: "Type the season name to confirm.",
    deleteWarningConfirm: "Delete",
    deleteWarningCancel: "Cancel",
    formatBestOf3: "Best of 3",
    formatSingleGame: "Single game",
    formatLabel: "Format",
    leaderboard: "Leaderboard",
    leaderboardEmptyGlobal: "No ranked players yet.",
    leaderboardEmptySeason: "No ranked results in this season yet.",
    leaderboardEmptyTournament: "No ranked results in this tournament yet.",
    languageMenuLabel: "Change language",
    loadMore: "Load more",
    loadSavedSeason: "Load saved season",
    loadSavedTournament: "Load saved tournament",
    loadSeason: "Load season",
    loadTournament: "Load tournament",
    loginText:
      "Your internal ping pong leaderboard. Sign in with your Google account to view rankings, record matches, and join tournaments.",
    loginTitle: "Welcome to SpinRank",
    logout: "Log out",
    tournaments: "Tournaments",
    scopeGlobal: "Global",
    scopeSeason: "Season",
    scopeTournament: "Tournament",
    matchFieldFormat: "Format",
    matchFieldMatchType: "Match type",
    matchFieldPoints: "Points to win",
    matchFieldSeason: "Season",
    matchFieldTournament: "Tournament",
    matchFieldWinner: "Winner",
    matchLockBracketLocked:
      "This bracket pairing is locked because players already advanced.",
    matchLockSeasonComplete:
      "This season is completed and no further matches can be added.",
    matchLockTournamentComplete:
      "This tournament is completed and no further matches can be added.",
    matchContextCountsToward: "Counts toward",
    matchContextStandalone: "Standalone ranked match",
    renderMatchContextTournament: "Tournament:",
    renderMatchContextSeason: "Season:",
    renderMatchContextOpenPlay: "Open play",
    seasonLockCompleted: "This season is completed and can no longer be edited.",
    seasonLockDeleted: "This item was deleted and is no longer editable.",
    tournamentLockCompleted: "This tournament is completed and can no longer be edited.",
    tournamentLockDeleted: "This item was deleted and is no longer editable.",
    matchTypeDoubles: "Doubles",
    matchTypeSingles: "Singles",
    matchesTitle: "Match feed",
    noSeasonsAvailable: "No seasons available",
    noTournamentsAvailable: "No tournaments available",
    matchSummarySingles: "Singles match",
    matchSummaryDoubles: "Doubles match",
    matchSummaryBestOf3: "Best of 3",
    matchSummaryWinnerPrefix: "Winner:",
    matchSummaryWinnerTBD: "Winner: TBD",
    matchFiltersRecent: "Recent",
    matchFiltersMine: "Mine",
    matchFiltersAll: "All",
    streakEven: "Even",
    matchFilterEmptyRecent: "No recent matches yet.",
    matchFilterEmptyMine: "No matches involving you yet.",
    matchFilterEmptyAll: "No matches recorded yet.",
    leaderboardWins: "Wins",
    leaderboardLosses: "Losses",
    leaderboardStreak: "Streak",
    leaderboardMatchesLabel: "Matches played",
    leaderboardMostGamesLabel: "Most games this season",
    leaderboardLongestStreakLabel: "Longest win streak",
    openCreateMatch: "Create match",
    openCreateSeason: "Create season",
    openCreateTournament: "Tournaments",
    openScoreCard: "Score card",
    participants: "Participants",
    selectAllParticipants: "Select all participants",
    points11: "11 points",
    points21: "21 points",
    pointsSuffix: "points",
    progressBestElo: "Best Elo",
    progressBestStreak: "Best streak",
    progressElo: "Elo",
    progressRanked: "Ranked at",
    progressUnranked: "Unranked",
    progressChartYAxis: "ELO",
    progressStatsTitle: "Statistics",
    progressMatchesLabel: "Matches",
    progressEmpty: "No progress yet.",
    resetElo: "Reset Elo to 1200",
    resetScoreCard: "Reset",
    scoreCardButton: "Score card",
    scoreCardClose: "Close",
    scoreCardInstructions: "Tap to add, drag to subtract.",
    scoreCardTitle: "Live score",
    scoreLabel: "Score",
    scoreTilePlayerA: "Player A",
    scoreTilePlayerB: "Player B",
    seasonActiveLabel: "Make active season",
    seasonMeta: "Add a new season and make it available across matches and leaderboards.",
    seasonName: "Season name",
    seasonStartDate: "Start date",
    seasonEndDate: "End date",
    seasonDetails: "Season details",
    seasonPublicLabel: "Public season",
    seasonTitle: "Create season",
    rankingRules: "Ranking rules",
    tournamentDate: "Date",
    tournamentDetails: "Tournament details",
    tournamentMeta: "Select participants, then generate a fair singles bracket.",
    tournamentName: "Tournament name",
    tournamentSeasonLabel: "Season",
    youLabel: "You",
    loadingMatches: "Loading matches...",
    loadingOverlay: "Loading...",
    noProgress: "No progress yet.",
    noSeason: "No season",
    noTournament: "No tournament",
    savedSeasons: "Saved seasons",
    savedTournaments: "Saved tournaments",
    suggestFairTeams: "Suggest fair teams",
    suggestTournament: "Suggest tournament",
    saveTournament: "Save tournament",
    teamALabel: "Team A",
    teamAPlayer1: "Team A player 1",
    teamAPlayer2: "Team A player 2",
    teamBLabel: "Team B",
    teamBPlayer1: "Team B player 1",
    teamBPlayer2: "Team B player 2",
    tournamentDetailsSection: "Tournament details",
    tournamentParticipantsSection: "Participants",
    shareSeasonTitle: "Share this season",
    shareTournamentTitle: "Share this tournament",
    shareInviteTitle: "Invite people to the {segment}",
    shareSegmentTypeSeason: "season",
    shareSegmentTypeTournament: "tournament",
    sharePanelDescription: "Generate a link or QR code so others can join this segment automatically.",
    shareLinkLabel: "Share link",
    sharePanelLinkPlaceholder: "Share link will appear here",
    saveButtonLabel: "Save",
    shareCreateLink: "Create share link",
    shareCopyLink: "Copy share link",
    shareQrLabel: "QR code",
    shareSignInPrompt: "Sign in to accept the invite.",
    shareAlreadyJoinedSeason: "You are already part of this season.",
    shareAlreadyJoinedTournament: "You are already part of this tournament.",
    shareButtonLabel: "Share",
    shareNoSegment: "Load or save a segment before sharing.",
    shareCopied: "Link copied",
    shareCopyFailure: "Unable to copy the link.",
    shareExpiresInDays: "Expires in {days} days",
    shareExpiresInHours: "Expires in {hours} hours",
    shareExpiresInMinutes: "Expires in {minutes} minutes",
    shareExpired: "Expired",
    shareCreateFailure: "Could not generate a share link.",
    shareJoinedSeason: "Joined season",
    shareJoinedTournament: "Joined tournament",
    shareJoinFailure: "This share link could not be used.",
    faqTitle: "FAQ & Help",
    faqIntro: "Answers to key questions about rankings, matches, seasons, and tournaments.",
    faqMenuLabel: "FAQ",
    footerPrivacyLink: "Privacy policy",
    footerFaqLink: "FAQ",
    privacyTitle: "Privacy policy",
    privacyIntro: "SpinRank only keeps what it needs to run the app and show your matches.",
    privacyPara1:
      "We store your Google profile (name, email, avatar) for login, keep session tokens so you stay signed in, and keep every match, season, or tournament you add.",
    privacyPara2:
      "All data lives inside Cloudflare Workers and D1; deleted matches stay marked but no longer affect rankings, and we never sell or share your info for marketing.",
    privacyPara3Prefix:
      "Under GDPR you can view, correct, delete, or export your data by opening an issue on ",
    privacyPara3Link: "GitHub",
  },
  de: {
    autoAdvance: "Automatische Freigabe",
    back: "Zurück",
    baseElo: "Basis-Elo",
    bracketPreviewEmpty: "Wähle mindestens 2 Teilnehmende, um das Bracket anzusehen.",
    bracketPreviewSection: "Bracket-Vorschau",
    carryOverElo: "Elo übernehmen",
    close: "Schließen",
    createMatch: "Match erstellen",
    createSeason: "Saison erstellen",
    createTournament: "Turnier erstellen",
    dashboardTitle: "Übersicht",
    deleteMatch: "Match löschen",
    deleteSeason: "Saison löschen",
    deleteTournament: "Turnier löschen",
    deleteModalTitleMatch: "Match löschen?",
    deleteModalTitleSeason: "Saison löschen?",
    deleteModalTitleTournament: "Turnier löschen?",
    deleteModalBodyMatch:
      "Dieses Match wird soft gelöscht und die Elo-Werte werden neu berechnet.",
    deleteModalBodySeason:
      "Alle verknüpften Turniere und Matches werden soft gelöscht und die Elo-Werte neu berechnet.",
    deleteModalBodyTournament:
      "Alle Turniermatches werden soft gelöscht und die Elo-Werte neu berechnet.",
    deleteModalSeasonHint: "Gib den Namen der Saison ein, um zu bestätigen.",
    deleteWarningConfirm: "Löschen",
    deleteWarningCancel: "Abbrechen",
    formatBestOf3: "Best of 3",
    formatSingleGame: "Einzelspiel",
    formatLabel: "Format",
    leaderboard: "Bestenliste",
    leaderboardEmptyGlobal: "Noch keine bewerteten Spieler.",
    leaderboardEmptySeason: "Noch keine Platzierungen in dieser Saison.",
    leaderboardEmptyTournament: "Noch keine Platzierungen in diesem Turnier.",
    languageMenuLabel: "Sprache ändern",
    loadMore: "Mehr laden",
    loadSavedSeason: "Gespeicherte Saison laden",
    loadSavedTournament: "Gespeichertes Turnier laden",
    loadSeason: "Saison laden",
    loadTournament: "Turnier laden",
    loginText:
      "Dein internes Pingpong-Ranking. Melde dich mit deinem Google-Konto an, um Platzierungen zu sehen, Matches zu protokollieren und an Turnieren teilzunehmen.",
    loginTitle: "Willkommen bei SpinRank",
    logout: "Abmelden",
    tournaments: "Turniere",
    scopeGlobal: "Global",
    scopeSeason: "Saison",
    scopeTournament: "Turnier",
    matchFieldFormat: "Format",
    matchFieldMatchType: "Matchtyp",
    matchFieldPoints: "Punkte zum Sieg",
    matchFieldSeason: "Saison",
    matchFieldTournament: "Turnier",
    matchFieldWinner: "Sieger",
    matchLockBracketLocked:
      "Diese Bracket-Paarung ist gesperrt, weil Spieler bereits weitergezogen sind.",
    matchLockSeasonComplete:
      "Diese Saison ist abgeschlossen und es können keine weiteren Matches hinzugefügt werden.",
    matchLockTournamentComplete:
      "Dieses Turnier ist abgeschlossen und es können keine weiteren Matches hinzugefügt werden.",
    matchContextCountsToward: "Zählt für",
    matchContextStandalone: "Eigenständiges Ranglistenmatch",
    renderMatchContextTournament: "Turnier:",
    renderMatchContextSeason: "Saison:",
    renderMatchContextOpenPlay: "Freies Spiel",
    seasonLockCompleted: "Diese Saison ist abgeschlossen und kann nicht mehr bearbeitet werden.",
    seasonLockDeleted: "Dieses Element wurde gelöscht und kann nicht mehr bearbeitet werden.",
    tournamentLockCompleted: "Dieses Turnier ist abgeschlossen und kann nicht mehr bearbeitet werden.",
    tournamentLockDeleted: "Dieses Element wurde gelöscht und kann nicht mehr bearbeitet werden.",
    matchTypeDoubles: "Doppel",
    matchTypeSingles: "Einzel",
    matchesTitle: "Match-Verlauf",
    noSeasonsAvailable: "Keine Saisons verfügbar",
    noTournamentsAvailable: "Keine Turniere verfügbar",
    matchSummarySingles: "Einzelmatch",
    matchSummaryDoubles: "Doppelmatch",
    matchSummaryBestOf3: "Best of 3",
    matchSummaryWinnerPrefix: "Sieger:",
    matchSummaryWinnerTBD: "Sieger: Ausstehend",
    matchFiltersRecent: "Neueste",
    matchFiltersMine: "Meine",
    matchFiltersAll: "Alle",
    streakEven: "Ausgeglichen",
    matchFilterEmptyRecent: "Noch keine aktuellen Matches.",
    matchFilterEmptyMine: "Noch keine Matches mit deiner Beteiligung.",
    matchFilterEmptyAll: "Noch keine Matches protokolliert.",
    leaderboardWins: "Siege",
    leaderboardLosses: "Niederlagen",
    leaderboardStreak: "Serie",
    leaderboardMatchesLabel: "Ausgetragene Matches",
    leaderboardMostGamesLabel: "Die meisten Matches",
    leaderboardLongestStreakLabel: "Längste Siegesserie",
    openCreateMatch: "Match erstellen",
    openCreateSeason: "Saison erstellen",
    openCreateTournament: "Turniere",
    openScoreCard: "Spielstand",
    participants: "Teilnehmende",
    selectAllParticipants: "Alle Teilnehmende auswählen",
    points11: "11 Punkte",
    points21: "21 Punkte",
    pointsSuffix: "Punkte",
    progressBestElo: "Beste Elo",
    progressBestStreak: "Beste Serie",
    progressElo: "Elo",
    progressRanked: "Platz",
    progressUnranked: "Nicht platziert",
    progressChartYAxis: "ELO",
    progressStatsTitle: "Statistiken",
    progressMatchesLabel: "Spiele",
    progressEmpty: "Noch kein Fortschritt.",
    resetElo: "Elo auf 1200 zurücksetzen",
    resetScoreCard: "Zurücksetzen",
    scoreCardButton: "Spielstand",
    scoreCardClose: "Schließen",
    scoreCardInstructions: "Tippe zum Hinzufügen, ziehe zum Abziehen.",
    scoreCardTitle: "Live-Ergebnis",
    scoreLabel: "Punkte",
    scoreTilePlayerA: "Spieler A",
    scoreTilePlayerB: "Spieler B",
    seasonActiveLabel: "Saison aktivieren",
    seasonMeta: "Füge eine neue Saison hinzu und mache sie in Matches sowie Bestenlisten verfügbar.",
    seasonName: "Saisonname",
    seasonStartDate: "Startdatum",
    seasonEndDate: "Enddatum",
    seasonDetails: "Saisondetails",
    seasonPublicLabel: "Öffentliche Saison",
    seasonTitle: "Saison erstellen",
    rankingRules: "Ranking-Regeln",
    tournamentDate: "Datum",
    tournamentDetails: "Turnierdetails",
    tournamentMeta: "Wähle Teilnehmende aus und generiere ein faires Einzel-Bracket.",
    tournamentName: "Turniername",
    tournamentSeasonLabel: "Saison",
    youLabel: "Du",
    loadingMatches: "Matches werden geladen...",
    loadingOverlay: "Wird geladen...",
    noProgress: "Noch kein Fortschritt.",
    noSeason: "Keine Saison",
    noTournament: "Kein Turnier",
    savedSeasons: "Gespeicherte Saisons",
    savedTournaments: "Gespeicherte Turniere",
    suggestFairTeams: "Faire Teams vorschlagen",
    suggestTournament: "Turnier vorschlagen",
    saveTournament: "Turnier speichern",
    teamALabel: "Team A",
    teamAPlayer1: "Spieler 1 (Team A)",
    teamAPlayer2: "Spieler 2 (Team A)",
    teamBLabel: "Team B",
    teamBPlayer1: "Spieler 1 (Team B)",
    teamBPlayer2: "Spieler 2 (Team B)",
    tournamentDetailsSection: "Turnierdetails",
    tournamentParticipantsSection: "Teilnehmende",
    shareSeasonTitle: "Saison teilen",
    shareTournamentTitle: "Turnier teilen",
    shareInviteTitle: "Lade Personen zur {segment} ein",
    shareSegmentTypeSeason: "Saison",
    shareSegmentTypeTournament: "Turnier",
    sharePanelDescription: "Erstelle einen Link oder QR-Code, damit Teilnehmende automatisch beitreten.",
    shareLinkLabel: "Freigabelink",
    sharePanelLinkPlaceholder: "Freigabelink erscheint hier",
    saveButtonLabel: "Speichern",
    shareCreateLink: "Freigabelink erstellen",
    shareCopyLink: "Freigabelink kopieren",
    shareQrLabel: "QR-Code",
    shareSignInPrompt: "Melde dich an, um die Einladung anzunehmen.",
    shareAlreadyJoinedSeason: "Du bist bereits Teil dieser Saison.",
    shareAlreadyJoinedTournament: "Du bist bereits Teil dieses Turniers.",
    shareButtonLabel: "Teilen",
    shareNoSegment: "Lade oder speichere zuerst ein Segment.",
    shareCopied: "Link kopiert",
    shareCopyFailure: "Link konnte nicht kopiert werden.",
    shareExpiresInDays: "Läuft in {days} Tagen ab",
    shareExpiresInHours: "Läuft in {hours} Stunden ab",
    shareExpiresInMinutes: "Läuft in {minutes} Minuten ab",
    shareExpired: "Abgelaufen",
    shareCreateFailure: "Freigabelink konnte nicht erstellt werden.",
    shareJoinedSeason: "Saison beigetreten",
    shareJoinedTournament: "Turnier beigetreten",
    shareJoinFailure: "Dieser Freigabelink konnte nicht verwendet werden.",
    faqTitle: "FAQ & Hilfe",
    faqIntro: "Antworten auf zentrale Fragen zu Ranglisten, Matches und Events.",
    faqMenuLabel: "FAQ",
    footerPrivacyLink: "Datenschutz",
    footerFaqLink: "FAQ",
    privacyTitle: "Datenschutz",
    privacyIntro: "SpinRank speichert nur das, was für den Betrieb und deine Matches nötig ist.",
    privacyPara1:
      "Wir speichern dein Google-Profil (Name, E-Mail, Avatar) für den Login, Session-Tokens, damit du angemeldet bleibst, sowie alle Matches, Saisons und Turniere, die du hinzufügst.",
    privacyPara2:
      "Alle Daten befinden sich in Cloudflare Workers und D1; gelöschte Matches bleiben markiert, zählen aber nicht mehr, und wir verkaufen oder teilen deine Daten nicht für Werbung.",
    privacyPara3Prefix:
      "Nach DSGVO kannst du deine Daten einsehen, korrigieren, löschen oder exportieren, indem du ein Issue im SpinRank-GitHub-Repo öffnest ",
    privacyPara3Link: "hier",
  },
} as const;

type TextKey = keyof typeof translations["en"];

type DeleteWarningContext = "match" | "season" | "tournament";

interface DeleteWarningRequest {
  context: DeleteWarningContext;
  detail?: () => string | null;
  confirmationValue?: string;
}

const deleteWarningCopy: Record<
  DeleteWarningContext,
  { titleKey: TextKey; bodyKey: TextKey }
> = {
  match: {
    titleKey: "deleteModalTitleMatch",
    bodyKey: "deleteModalBodyMatch",
  },
  season: {
    titleKey: "deleteModalTitleSeason",
    bodyKey: "deleteModalBodySeason",
  },
  tournament: {
    titleKey: "deleteModalTitleTournament",
    bodyKey: "deleteModalBodyTournament",
  },
};

const translationObservers: Array<() => void> = [];
const languageChangeHandlers: Array<() => void> = [];
const LANGUAGE_STORAGE_KEY = "spinrank.language";
const defaultLanguage: LanguageCode = "en";

const loadStoredLanguage = (): LanguageCode => {
  if (typeof window === "undefined") {
    return defaultLanguage;
  }
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && stored in languageOptions) {
      return stored as LanguageCode;
    }
  } catch {
    // ignore
  }
  return defaultLanguage;
};

let currentLanguage: LanguageCode = loadStoredLanguage();

const t = (key: TextKey): string =>
  translations[currentLanguage][key] ?? translations[defaultLanguage][key];

const registerTranslation = (updater: () => void): void => {
  translationObservers.push(updater);
  updater();
};

const applyTranslations = (): void => {
  translationObservers.forEach((updater) => updater());
};

const onLanguageChange = (handler: () => void): void => {
  languageChangeHandlers.push(handler);
};

const setLanguage = (language: LanguageCode): void => {
  if (language === currentLanguage) {
    return;
  }
  currentLanguage = language;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  } catch {
    // ignore
  }
  applyTranslations();
  languageChangeHandlers.forEach((handler) => handler());
};

const bindLocalizedText = (element: HTMLElement, key: TextKey): void => {
  registerTranslation(() => {
    element.textContent = t(key);
  });
};

const bindLocalizedAttribute = (element: HTMLElement, attribute: string, key: TextKey): void => {
  registerTranslation(() => {
    element.setAttribute(attribute, t(key));
  });
};

interface ProgressGeometry {
  path: string;
  coordinates: Array<{ x: number; y: number }>;
  min: number;
  max: number;
}

const MAX_PROGRESS_DISPLAY_POINTS = 10;

const createInitialProgressPoint = (
  reference?: GetUserProgressData["points"][number],
): GetUserProgressData["points"][number] => {
  const baseTime = reference ? new Date(reference.playedAt).getTime() - 1 : Date.now();
  return {
    playedAt: new Date(baseTime).toISOString(),
    elo: 1200,
    delta: 0,
    label: "Initial Elo",
    rank: null,
  };
};

const sampleProgressPoints = <T>(points: T[], maxPoints: number): T[] => {
  if (points.length <= maxPoints || maxPoints <= 0) {
    return [...points];
  }
  const clampedPoints = Math.min(points.length, Math.max(2, maxPoints));
  const stride = (points.length - 1) / (clampedPoints - 1);
  const sampled: T[] = [];
  for (let i = 0; i < clampedPoints - 1; i += 1) {
    const index = Math.floor(i * stride);
    sampled.push(points[index]);
  }
  sampled.push(points[points.length - 1]);
  return sampled;
};

const buildProgressGeometry = (
  points: Array<{ elo: number }>,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
  minOverride?: number,
  maxOverride?: number,
): ProgressGeometry => {
  if (points.length === 0) {
    const centerX = width / 2 + offsetX;
    const centerY = height / 2 + offsetY;
    return {
      path: "",
      coordinates: [{ x: centerX, y: centerY }],
      min: 0,
      max: 0,
    };
  }

  const rawMin = Math.min(...points.map((point) => point.elo));
  const rawMax = Math.max(...points.map((point) => point.elo));
  const minElo = minOverride ?? rawMin;
  const maxElo = maxOverride ?? rawMax;
  const range = Math.max(maxElo - minElo, 1);

  const coordinates = points.map((point, index) => {
    const x = (points.length === 1 ? width / 2 : (index / (points.length - 1)) * width) + offsetX;
    const y = height - ((point.elo - minElo) / range) * height + offsetY;
    return { x, y };
  });

  const path = coordinates
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
    .join(" ");

  return {
    path,
    coordinates,
    min: minElo,
    max: maxElo,
  };
};

const formatProgressPointTooltip = (point: GetUserProgressData["points"][number]): string => {
  const rankLabel = point.rank ? ` • Ranked #${point.rank}` : "";
  const deltaLabel = point.delta === 0 ? "" : ` • ${point.delta > 0 ? "+" : ""}${point.delta} Elo`;
  return `${formatDate(point.playedAt)} • Elo ${point.elo}${deltaLabel}${rankLabel}`;
};

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

  return t("streakEven");
};

const renderMatchScore = (match: MatchRecord): string =>
  match.score.map((game) => `${game.teamA} - ${game.teamB}`).join(" • ");

const getBestVisibleStreak = (players: LeaderboardEntry[]): number =>
  players.reduce((max, player) => Math.max(max, player.streak), 0);

const canSoftDelete = (resource: { createdByUserId?: string | null }, sessionUserId: string): boolean =>
  resource.createdByUserId === sessionUserId;

const getLeaderboardEmptyState = (scope: SegmentMode): string => {
  if (scope === "season") {
    return t("leaderboardEmptySeason");
  }
  if (scope === "tournament") {
    return t("leaderboardEmptyTournament");
  }
  return t("leaderboardEmptyGlobal");
};

const getMatchFeedContextLabel = (
  season: SeasonRecord | undefined,
  tournament: TournamentRecord | undefined,
): string => {
  if (tournament) {
    return `${t("matchContextCountsToward")} ${tournament.name}`;
  }
  if (season) {
    return `${t("matchContextCountsToward")} ${season.name}`;
  }
  return t("matchContextStandalone");
};

const getCurrentUserId = (state: ViewState): string =>
  isAuthedState(state) ? state.session.user.id : "";

const isLockedSeason = (season: SeasonRecord | undefined): boolean =>
  Boolean(season && season.status !== "active");

const isLockedTournament = (tournament: TournamentRecord | undefined): boolean =>
  Boolean(tournament && tournament.status !== "active");

const getWinnerLabel = (winnerTeam: "A" | "B", teamA: string, teamB: string): string =>
  winnerTeam === "A" ? teamA : teamB;

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

const buildUniquePlayerList = (values: string[]): string[] => {
  const seen: string[] = [];
  values.forEach((value) => {
    if (!value) {
      return;
    }
    if (seen.includes(value)) {
      return;
    }
    seen.push(value);
  });
  return seen;
};

const matchFilterLabels: Record<MatchFeedFilter, TextKey> = {
  recent: "matchFiltersRecent",
  mine: "matchFiltersMine",
  all: "matchFiltersAll",
};

const getMatchLimitForFilter = (filter: MatchFeedFilter): number => (filter === "recent" ? 4 : 20);

const getMatchFilterEmptyState = (filter: MatchFeedFilter): string => {
  if (filter === "mine") {
    return t("matchFilterEmptyMine");
  }
  if (filter === "all") {
    return t("matchFilterEmptyAll");
  }
  return t("matchFilterEmptyRecent");
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

const createTournamentMatchId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `tournament_match_${crypto.randomUUID()}`;
  }
  return `tournament_match_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
      id: createTournamentMatchId(),
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
    const matches: TournamentPlannerMatch[] = Array.from({ length: nextMatchCount }, () => ({
      id: createTournamentMatchId(),
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

  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "app-loading-overlay";
  loadingOverlay.hidden = true;
  loadingOverlay.setAttribute("aria-live", "polite");
  loadingOverlay.setAttribute("aria-busy", "true");

  const loadingOverlayDialog = document.createElement("div");
  loadingOverlayDialog.className = "app-loading-overlay__dialog";
  loadingOverlayDialog.setAttribute("role", "status");

  const loadingOverlaySpinner = document.createElement("div");
  loadingOverlaySpinner.className = "app-loading-overlay__spinner";
  loadingOverlaySpinner.setAttribute("aria-hidden", "true");

  const loadingOverlayLabel = document.createElement("div");
  loadingOverlayLabel.className = "app-loading-overlay__label";
  bindLocalizedText(loadingOverlayLabel, "loadingOverlay");

  loadingOverlayDialog.append(loadingOverlaySpinner, loadingOverlayLabel);
  loadingOverlay.append(loadingOverlayDialog);

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

  const languageSwitch = document.createElement("div");
  languageSwitch.className = "language-switch";

  const languageTrigger = document.createElement("button");
  languageTrigger.type = "button";
  languageTrigger.className = "language-switch__trigger";
  languageTrigger.setAttribute("aria-haspopup", "true");
  languageTrigger.setAttribute("aria-expanded", "false");

  const languageMenu = document.createElement("div");
  languageMenu.className = "language-switch__menu";
  languageMenu.hidden = true;

  const languageButtons = new Map<LanguageCode, HTMLButtonElement>();
  let languageMenuOpen = false;

  const updateLanguageMenuState = (): void => {
    languageMenu.hidden = !languageMenuOpen;
    languageTrigger.setAttribute("aria-expanded", String(languageMenuOpen));
  };

  const refreshLanguageTriggerFlag = (): void => {
    languageTrigger.textContent = languageOptions[currentLanguage].flag;
  };

  const refreshLanguageButtonStates = (): void => {
    languageButtons.forEach((button, code) => {
      button.setAttribute("aria-pressed", String(code === currentLanguage));
    });
  };

  const selectLanguage = (language: LanguageCode): void => {
    languageMenuOpen = false;
    updateLanguageMenuState();
    setLanguage(language);
    refreshLanguageTriggerFlag();
    refreshLanguageButtonStates();
  };

  onLanguageChange(() => {
    refreshLanguageTriggerFlag();
    refreshLanguageButtonStates();
    languageMenuOpen = false;
    updateLanguageMenuState();
  });

  (Object.keys(languageOptions) as LanguageCode[]).forEach((code) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "language-switch__option";
    option.textContent = `${languageOptions[code].flag} ${languageOptions[code].label}`;
    option.setAttribute("aria-pressed", String(code === currentLanguage));
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      selectLanguage(code);
    });
    languageButtons.set(code, option);
    languageMenu.append(option);
  });
  refreshLanguageButtonStates();

  languageTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    languageMenuOpen = !languageMenuOpen;
    updateLanguageMenuState();
  });

  languageSwitch.append(languageTrigger, languageMenu);
  providerStack.append(languageSwitch);

  bindLocalizedAttribute(languageTrigger, "aria-label", "languageMenuLabel");
  refreshLanguageTriggerFlag();

  const authActions = document.createElement("div");
  authActions.className = "auth-actions";

  const authMenu = document.createElement("div");
  authMenu.className = "auth-menu";

  const createMenu = document.createElement("div");
  createMenu.className = "create-menu";

  const authAvatar = document.createElement("img");
  authAvatar.className = "auth-avatar";
  authAvatar.alt = "Signed-in user avatar";

  const authMenuButton = document.createElement("button");
  authMenuButton.type = "button";
  authMenuButton.className = "secondary-button auth-menu-button";
  authMenuButton.textContent = "☰";
  authMenuButton.setAttribute("aria-label", "Open account menu");

  const createMenuButton = document.createElement("button");
  createMenuButton.type = "button";
  createMenuButton.className = "create-menu-button";
  createMenuButton.textContent = "+";
  createMenuButton.setAttribute("aria-label", "Open create menu");

  const dashboard = document.createElement("section");
  dashboard.className = "dashboard";

  const createMatchScreen = document.createElement("section");
  createMatchScreen.className = "dashboard";
  createMatchScreen.hidden = true;

  const createTournamentScreen = document.createElement("section");
  createTournamentScreen.className = "dashboard";
  createTournamentScreen.hidden = true;

  const createSeasonScreen = document.createElement("section");
  createSeasonScreen.className = "dashboard";
  createSeasonScreen.hidden = true;

  const faqScreen = document.createElement("section");
  faqScreen.className = "dashboard faq-screen";
  faqScreen.hidden = true;

  const faqHeader = document.createElement("div");
  faqHeader.className = "faq-screen__header";

  const faqHeading = document.createElement("h2");
  faqHeading.className = "section-title";
  bindLocalizedText(faqHeading, "faqTitle");

  const faqBackButton = document.createElement("button");
  faqBackButton.type = "button";
  faqBackButton.className = "secondary-button faq-screen__back-button";
  bindLocalizedText(faqBackButton, "back");

  faqHeader.append(faqHeading, faqBackButton);

  const faqIntro = document.createElement("p");
  faqIntro.className = "section-copy";
  bindLocalizedText(faqIntro, "faqIntro");

  const faqGrid = document.createElement("div");
  faqGrid.className = "faq-grid";

  const getLocalizedText = (detail: { en: string; de: string }): string =>
    currentLanguage === "de" ? detail.de : detail.en;

  const renderFaqCards = (): void => {
    const cards = faqEntries.map((entry) => {
      const card = document.createElement("article");
      card.className = "faq-card";

      const cardTitle = document.createElement("h3");
      cardTitle.className = "card-title faq-card__title";
      cardTitle.textContent = currentLanguage === "de" ? entry.titleDe : entry.titleEn;

      const cardBody = document.createElement("div");
      cardBody.className = "faq-card__body";

      entry.details.forEach((detail) => {
        const detailBlock = document.createElement("div");
        detailBlock.className = "faq-card__detail";

        const paragraph = document.createElement("p");
        paragraph.className = "faq-card__text";
        paragraph.textContent = getLocalizedText(detail);

        detailBlock.append(paragraph);
        cardBody.append(detailBlock);
      });

      card.append(cardTitle, cardBody);
      return card;
    });
    faqGrid.replaceChildren(...cards);
  };

  onLanguageChange(renderFaqCards);
  renderFaqCards();

  faqScreen.append(faqHeader, faqIntro, faqGrid);

  const privacyScreen = document.createElement("section");
  privacyScreen.className = "dashboard faq-screen";
  privacyScreen.hidden = true;

  const privacyHeader = document.createElement("div");
  privacyHeader.className = "faq-screen__header";

  const privacyHeading = document.createElement("h2");
  privacyHeading.className = "section-title";
  bindLocalizedText(privacyHeading, "privacyTitle");

  const privacyBackButton = document.createElement("button");
  privacyBackButton.type = "button";
  privacyBackButton.className = "secondary-button faq-screen__back-button";
  bindLocalizedText(privacyBackButton, "back");

  privacyHeader.append(privacyHeading, privacyBackButton);

  const privacyIntro = document.createElement("p");
  privacyIntro.className = "section-copy";
  bindLocalizedText(privacyIntro, "privacyIntro");

  const privacyParagraphKeys = ["privacyPara1", "privacyPara2"] as const;
  const privacyParagraphs = privacyParagraphKeys.map((key) => {
    const paragraph = document.createElement("p");
    paragraph.className = "section-copy";
    bindLocalizedText(paragraph, key);
    return paragraph;
  });

  const privacyPara3 = document.createElement("p");
  privacyPara3.className = "section-copy";
  const privacyPara3Text = document.createElement("span");
  const privacyPara3Link = document.createElement("a");
  privacyPara3Link.href = "https://github.com/mariusavram91/spinrank/issues";
  privacyPara3Link.target = "_blank";
  privacyPara3Link.rel = "noreferrer noopener";
  privacyPara3.append(privacyPara3Text, privacyPara3Link);

  const updatePrivacyPara3 = (): void => {
    privacyPara3Text.textContent = t("privacyPara3Prefix");
    privacyPara3Link.textContent = t("privacyPara3Link");
  };
  onLanguageChange(updatePrivacyPara3);
  updatePrivacyPara3();

  privacyScreen.append(privacyHeader, privacyIntro, ...privacyParagraphs, privacyPara3);

  const footer = document.createElement("footer");
  footer.className = "app-footer";

  const footerLinks = document.createElement("div");
  footerLinks.className = "footer-links";

  const footerFaqButton = document.createElement("button");
  footerFaqButton.type = "button";
  footerFaqButton.className = "footer-link-button";

  const footerPrivacyButton = document.createElement("button");
  footerPrivacyButton.type = "button";
  footerPrivacyButton.className = "footer-link-button";

  footerLinks.append(footerFaqButton, footerPrivacyButton);
  footer.append(footerLinks);

  const setFooterTexts = (): void => {
    footerFaqButton.textContent = t("footerFaqLink");
    footerPrivacyButton.textContent = t("footerPrivacyLink");
  };

  onLanguageChange(setFooterTexts);
  setFooterTexts();

  const loginView = document.createElement("section");
  loginView.className = "login-view";
  loginView.hidden = true;

  const loginWelcome = document.createElement("div");
  loginWelcome.className = "login-welcome";
  const loginTitle = document.createElement("h1");
  loginTitle.className = "login-title";
  bindLocalizedText(loginTitle, "loginTitle");
  const loginText = document.createElement("p");
  loginText.className = "login-text";
  bindLocalizedText(loginText, "loginText");
  loginWelcome.append(loginTitle, loginText);

  const googleContainer = document.createElement("div");
  googleContainer.className = "google-container";
  const googleSlot = document.createElement("div");
  googleSlot.className = "google-slot";
  googleContainer.append(googleSlot);

  loginView.append(loginWelcome, googleContainer);

  const dashboardHeader = document.createElement("div");
  dashboardHeader.className = "dashboard-header";

  const welcomeBlock = document.createElement("div");
  welcomeBlock.className = "welcome-block";

  const welcomeTitleRow = document.createElement("div");
  welcomeTitleRow.className = "title-row";

  const welcomeTitle = document.createElement("h2");
  welcomeTitle.className = "section-title";
  bindLocalizedText(welcomeTitle, "dashboardTitle");

  const welcomeText = document.createElement("p");
  welcomeText.className = "section-copy";

  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.className = "secondary-button";
  bindLocalizedText(logoutButton, "logout");

  const faqMenuButton = document.createElement("button");
  faqMenuButton.type = "button";
  faqMenuButton.className = "secondary-button";
  bindLocalizedText(faqMenuButton, "faqMenuLabel");

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "icon-button";
  refreshButton.textContent = "↻";
  refreshButton.setAttribute("aria-label", "Refresh dashboard");

  const openCreateMatchButton = document.createElement("button");
  openCreateMatchButton.type = "button";
  openCreateMatchButton.className = "secondary-button";
  bindLocalizedText(openCreateMatchButton, "createMatch");

  const openCreateTournamentButton = document.createElement("button");
  openCreateTournamentButton.type = "button";
  openCreateTournamentButton.className = "secondary-button";
  bindLocalizedText(openCreateTournamentButton, "tournaments");

  const openCreateSeasonButton = document.createElement("button");
  openCreateSeasonButton.type = "button";
  openCreateSeasonButton.className = "secondary-button";
  bindLocalizedText(openCreateSeasonButton, "createSeason");

  const openScoreCardButton = document.createElement("button");
  openScoreCardButton.type = "button";
  openScoreCardButton.className = "secondary-button";
  bindLocalizedText(openScoreCardButton, "scoreCardButton");

  const scoreCardOverlay = document.createElement("div");
  scoreCardOverlay.className = "score-card-overlay";
  scoreCardOverlay.hidden = true;

  const scoreCard = document.createElement("section");
  scoreCard.className = "score-card";

  const scoreCardHeader = document.createElement("div");
  scoreCardHeader.className = "score-card__header";

  const scoreCardTitle = document.createElement("h3");
  scoreCardTitle.className = "card-title";
  bindLocalizedText(scoreCardTitle, "scoreCardTitle");

  const closeScoreCardButton = document.createElement("button");
  closeScoreCardButton.type = "button";
  closeScoreCardButton.className = "secondary-button score-card__close-button";
  bindLocalizedText(closeScoreCardButton, "scoreCardClose");

  const scoreCardInstructions = document.createElement("p");
  scoreCardInstructions.className = "score-card__instructions";
  bindLocalizedText(scoreCardInstructions, "scoreCardInstructions");

  const scoreCardTiles = document.createElement("div");
  scoreCardTiles.className = "score-card__tiles";

  type ScoreKey = "left" | "right";
  const scoreState: Record<ScoreKey, number> = { left: 0, right: 0 };
  const scoreValueElements: Partial<Record<ScoreKey, HTMLSpanElement>> = {};
  const pointerMeta = new Map<HTMLButtonElement, { startX: number; startY: number; dragged: boolean }>();
  let scoreCardVisible = false;

  const updateScoreCardDisplay = (): void => {
    (Object.keys(scoreState) as ScoreKey[]).forEach((key) => {
      const valueElement = scoreValueElements[key];
      if (valueElement) {
        valueElement.textContent = String(scoreState[key]);
      }
    });
  };

  const resetScoreCard = (): void => {
    scoreState.left = 0;
    scoreState.right = 0;
    updateScoreCardDisplay();
  };

  const showScoreCard = (): void => {
    scoreCardOverlay.hidden = false;
    scoreCardVisible = true;
    document.body.classList.add("score-card-open");
  };

  const hideScoreCard = (): void => {
    scoreCardOverlay.hidden = true;
    scoreCardVisible = false;
    document.body.classList.remove("score-card-open");
  };

  const createScoreTile = (key: ScoreKey, labelKey: TextKey): HTMLButtonElement => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "score-card__tile";

    const tileLabel = document.createElement("span");
    tileLabel.className = "score-card__tile-label";
    registerTranslation(() => {
      tileLabel.textContent = t(labelKey);
    });

    const tileValue = document.createElement("span");
    tileValue.className = "score-card__tile-value";
    tileValue.textContent = "0";
    scoreValueElements[key] = tileValue;

    tile.append(tileLabel, tileValue);

    const handlePointerEnd = (event: PointerEvent): void => {
      const meta = pointerMeta.get(tile);
      if (!meta) {
        return;
      }
      if (meta.dragged) {
        scoreState[key] = Math.max(0, scoreState[key] - 1);
      } else {
        scoreState[key] += 1;
      }
      updateScoreCardDisplay();
      pointerMeta.delete(tile);
      tile.classList.remove("score-card__tile--dragging");
      if (tile.hasPointerCapture(event.pointerId)) {
        tile.releasePointerCapture(event.pointerId);
      }
    };

    tile.addEventListener("pointerdown", (event) => {
      tile.setPointerCapture(event.pointerId);
      pointerMeta.set(tile, { startX: event.clientX, startY: event.clientY, dragged: false });
    });

    tile.addEventListener("pointermove", (event) => {
      const meta = pointerMeta.get(tile);
      if (!meta) {
        return;
      }
      const dx = event.clientX - meta.startX;
      const dy = event.clientY - meta.startY;
      if (!meta.dragged && Math.hypot(dx, dy) >= 10) {
        meta.dragged = true;
        tile.classList.add("score-card__tile--dragging");
      }
    });

    tile.addEventListener("pointerup", handlePointerEnd);
    tile.addEventListener("pointercancel", handlePointerEnd);

    return tile;
  };

  const scoreTileLabels: [ScoreKey, TextKey][] = [
    ["left", "scoreTilePlayerA"],
    ["right", "scoreTilePlayerB"],
  ];

  const scoreCardTilesNodes = scoreTileLabels.map(([key, label]) => {
    const tile = createScoreTile(key, label);
    return tile;
  });

  scoreCardTiles.append(...scoreCardTilesNodes);

  const scoreCardActions = document.createElement("div");
  scoreCardActions.className = "score-card__actions";

  const resetScoreCardButton = document.createElement("button");
  resetScoreCardButton.type = "button";
  resetScoreCardButton.className = "secondary-button";
  bindLocalizedText(resetScoreCardButton, "resetScoreCard");

  scoreCardActions.append(resetScoreCardButton);

  scoreCardHeader.append(scoreCardTitle, closeScoreCardButton);
  scoreCard.append(scoreCardHeader, scoreCardInstructions, scoreCardTiles, scoreCardActions);
  scoreCardOverlay.append(scoreCard);

  const deleteWarningOverlay = document.createElement("div");
  deleteWarningOverlay.className = "delete-warning-overlay";
  deleteWarningOverlay.hidden = true;
  deleteWarningOverlay.tabIndex = -1;

  const deleteWarningModal = document.createElement("div");
  deleteWarningModal.className = "delete-warning-modal";
  deleteWarningModal.setAttribute("role", "alertdialog");
  deleteWarningModal.setAttribute("aria-modal", "true");
  deleteWarningModal.setAttribute("aria-labelledby", "delete-warning-title");
  deleteWarningModal.setAttribute("aria-describedby", "delete-warning-description");

  const deleteWarningTitle = document.createElement("h3");
  deleteWarningTitle.className = "delete-warning__title";
  deleteWarningTitle.id = "delete-warning-title";

  const deleteWarningDescription = document.createElement("p");
  deleteWarningDescription.className = "delete-warning__description";
  deleteWarningDescription.id = "delete-warning-description";

  const deleteWarningDetail = document.createElement("p");
  deleteWarningDetail.className = "delete-warning__detail";
  deleteWarningDetail.hidden = true;

  const deleteWarningHint = document.createElement("p");
  deleteWarningHint.className = "delete-warning__hint";
  deleteWarningHint.hidden = true;
  deleteWarningHint.id = "delete-warning-hint";

  const deleteWarningHintLabel = document.createElement("span");
  deleteWarningHintLabel.className = "delete-warning__hint-text";
  bindLocalizedText(deleteWarningHintLabel, "deleteModalSeasonHint");

  const deleteWarningHintValue = document.createElement("strong");
  deleteWarningHintValue.className = "delete-warning__hint-value";

  deleteWarningHint.append(deleteWarningHintLabel, document.createTextNode(" "), deleteWarningHintValue);

  const deleteWarningInput = document.createElement("input");
  deleteWarningInput.className = "delete-warning__input";
  deleteWarningInput.type = "text";
  deleteWarningInput.hidden = true;
  deleteWarningInput.autocomplete = "off";
  deleteWarningInput.setAttribute("aria-describedby", "delete-warning-hint");
  bindLocalizedAttribute(deleteWarningInput, "placeholder", "seasonName");
  bindLocalizedAttribute(deleteWarningInput, "aria-label", "seasonName");

  const deleteWarningActions = document.createElement("div");
  deleteWarningActions.className = "delete-warning__actions";

  const deleteWarningCancelButton = document.createElement("button");
  deleteWarningCancelButton.type = "button";
  deleteWarningCancelButton.className = "secondary-button";
  bindLocalizedText(deleteWarningCancelButton, "deleteWarningCancel");

  const deleteWarningConfirmButton = document.createElement("button");
  deleteWarningConfirmButton.type = "button";
  deleteWarningConfirmButton.className = "secondary-button destructive-button";
  bindLocalizedText(deleteWarningConfirmButton, "deleteWarningConfirm");

  deleteWarningActions.append(deleteWarningCancelButton, deleteWarningConfirmButton);
  deleteWarningModal.append(
    deleteWarningTitle,
    deleteWarningDescription,
    deleteWarningDetail,
    deleteWarningHint,
    deleteWarningInput,
    deleteWarningActions,
  );
  deleteWarningOverlay.append(deleteWarningModal);

  let currentDeleteRequest: DeleteWarningRequest | null = null;
  let deleteWarningResolver: ((confirmed: boolean) => void) | null = null;

  const applyDeleteWarningCopy = (): void => {
    if (!currentDeleteRequest) {
      return;
    }
    const copy = deleteWarningCopy[currentDeleteRequest.context];
    deleteWarningTitle.textContent = t(copy.titleKey);
    deleteWarningDescription.textContent = t(copy.bodyKey);
    const detailText = currentDeleteRequest.detail?.() ?? "";
    deleteWarningDetail.textContent = detailText;
    deleteWarningDetail.hidden = !detailText;
    const showHint =
      currentDeleteRequest.context === "season" && Boolean(currentDeleteRequest.confirmationValue);
    deleteWarningHintValue.textContent = currentDeleteRequest.confirmationValue ?? "";
    deleteWarningHint.hidden = !showHint;
    deleteWarningInput.hidden = currentDeleteRequest.context !== "season";
  };

  const updateDeleteWarningConfirmState = (): void => {
    if (!currentDeleteRequest) {
      deleteWarningConfirmButton.disabled = false;
      return;
    }
    if (currentDeleteRequest.context === "season") {
      const confirmationTarget = currentDeleteRequest.confirmationValue ?? "";
      deleteWarningConfirmButton.disabled =
        confirmationTarget === "" || deleteWarningInput.value.trim() !== confirmationTarget;
      return;
    }
    deleteWarningConfirmButton.disabled = false;
  };

  const closeDeleteWarning = (confirmed: boolean): void => {
    if (!deleteWarningResolver) {
      return;
    }
    const resolve = deleteWarningResolver;
    deleteWarningResolver = null;
    currentDeleteRequest = null;
    deleteWarningOverlay.hidden = true;
    deleteWarningInput.value = "";
    deleteWarningHint.hidden = true;
    deleteWarningDetail.hidden = true;
    deleteWarningConfirmButton.disabled = false;
    deleteWarningHintValue.textContent = "";
    deleteWarningInput.hidden = true;
    resolve(confirmed);
  };

  const promptDeleteWarning = (request: DeleteWarningRequest): Promise<boolean> => {
    if (deleteWarningResolver) {
      closeDeleteWarning(false);
    }
    currentDeleteRequest = request;
    applyDeleteWarningCopy();
    updateDeleteWarningConfirmState();
    deleteWarningOverlay.hidden = false;
    const focusTarget = request.context === "season" ? deleteWarningInput : deleteWarningConfirmButton;
    focusTarget.focus();
    return new Promise((resolve) => {
      deleteWarningResolver = resolve;
    });
  };

  deleteWarningCancelButton.addEventListener("click", () => closeDeleteWarning(false));
  deleteWarningConfirmButton.addEventListener("click", () => closeDeleteWarning(true));
  deleteWarningInput.addEventListener("input", updateDeleteWarningConfirmState);
  deleteWarningOverlay.addEventListener("click", (event) => {
    if (event.target === deleteWarningOverlay) {
      closeDeleteWarning(false);
    }
  });
  deleteWarningOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeDeleteWarning(false);
    }
  });
  onLanguageChange(() => {
    applyDeleteWarningCopy();
    updateDeleteWarningConfirmState();
  });

  const dashboardStatus = document.createElement("p");
  dashboardStatus.className = "dashboard-status";
  const shareAlert = document.createElement("div");
  shareAlert.className = "share-alert";
  shareAlert.setAttribute("aria-live", "polite");
  shareAlert.hidden = true;

  const viewGrid = document.createElement("div");
  viewGrid.className = "view-grid";

  const progressPanel = document.createElement("section");
  progressPanel.className = "content-card progress-card";

  const progressHeader = document.createElement("div");
  progressHeader.className = "card-header progress-card__header";

  const progressTitleContainer = document.createElement("div");

  const progressTitle = document.createElement("h3");
  progressTitle.className = "card-title";
  bindLocalizedText(progressTitle, "progressStatsTitle");

  const progressSubtitle = document.createElement("p");
  progressSubtitle.className = "progress-subtitle card-meta";

  const progressSubtitleRank = document.createElement("span");
  progressSubtitleRank.className = "progress-subtitle__rank";

  const progressSubtitleRankLabel = document.createElement("span");
  progressSubtitleRankLabel.className = "progress-subtitle__rank-label";

  const progressSubtitleRankValue = document.createElement("span");
  progressSubtitleRankValue.className = "progress-subtitle__rank-value progress-badge progress-subtitle-elo progress-subtitle__rank-value--hidden";

  progressSubtitleRank.append(progressSubtitleRankLabel, progressSubtitleRankValue);

  const progressSubtitleElo = document.createElement("span");
  progressSubtitleElo.className = "progress-subtitle-elo progress-badge";

  progressSubtitle.append(progressSubtitleRank, progressSubtitleElo);

  progressTitleContainer.append(progressTitle, progressSubtitle);
  progressHeader.append(progressTitleContainer);

  const progressSummary = document.createElement("div");
  progressSummary.className = "progress-summary";
  progressSummary.hidden = true;

  const progressBody = document.createElement("div");
  progressBody.className = "progress-body";

  const leaderboardPanel = document.createElement("section");
  leaderboardPanel.className = "content-card";

  const leaderboardTop = document.createElement("div");
  leaderboardTop.className = "card-header leaderboard-topline";

  const leaderboardHeading = document.createElement("div");

  const leaderboardTitle = document.createElement("h3");
  leaderboardTitle.className = "card-title";
  bindLocalizedText(leaderboardTitle, "leaderboard");

  const segmentToggle = document.createElement("div");
  segmentToggle.className = "segment-toggle";

  const globalButton = document.createElement("button");
  globalButton.type = "button";
  bindLocalizedText(globalButton, "scopeGlobal");

  const seasonButton = document.createElement("button");
  seasonButton.type = "button";
  bindLocalizedText(seasonButton, "scopeSeason");

  const tournamentButton = document.createElement("button");
  tournamentButton.type = "button";
  bindLocalizedText(tournamentButton, "scopeTournament");

  const seasonSelect = document.createElement("select");
  seasonSelect.className = "select-input";

  const seasonStats = document.createElement("div");
  seasonStats.className = "leaderboard-season-stats";
  seasonStats.hidden = true;

  const seasonStatsMatches = document.createElement("p");
  seasonStatsMatches.className = "leaderboard-season-stats__matches";

  const seasonStatsActive = document.createElement("p");
  seasonStatsActive.className = "leaderboard-season-stats__active";

  seasonStats.append(seasonStatsMatches, seasonStatsActive);

  const tournamentSelect = document.createElement("select");
  tournamentSelect.className = "select-input";

  const leaderboardStatsGroup = document.createElement("div");
  leaderboardStatsGroup.className = "leaderboard-stats-group";
  leaderboardStatsGroup.hidden = true;

  const leaderboardMatchesSummary = document.createElement("p");
  leaderboardMatchesSummary.className = "leaderboard-matches";
  leaderboardMatchesSummary.hidden = true;

  const leaderboardMatchesSummaryLabel = document.createElement("span");
  leaderboardMatchesSummaryLabel.className = "leaderboard-matches__label";
  bindLocalizedText(leaderboardMatchesSummaryLabel, "leaderboardMatchesLabel");

  const leaderboardMatchesSummaryValue = document.createElement("span");
  leaderboardMatchesSummaryValue.className = "leaderboard-matches__value";

  leaderboardMatchesSummary.append(leaderboardMatchesSummaryLabel, leaderboardMatchesSummaryValue);

  const leaderboardStatMostActive = document.createElement("div");
  leaderboardStatMostActive.className = "leaderboard-stat";
  leaderboardStatMostActive.hidden = true;

  const leaderboardStatMostActiveDetails = document.createElement("div");
  leaderboardStatMostActiveDetails.className = "leaderboard-stat__details";

  const leaderboardStatMostActiveLabel = document.createElement("span");
  leaderboardStatMostActiveLabel.className = "leaderboard-stat__label";
  bindLocalizedText(leaderboardStatMostActiveLabel, "leaderboardMostGamesLabel");

  const leaderboardStatMostActiveName = document.createElement("p");
  leaderboardStatMostActiveName.className = "leaderboard-stat__name";

  const leaderboardStatMostActivePlayer = document.createElement("span");
  leaderboardStatMostActivePlayer.className = "leaderboard-stat__player";

  const leaderboardStatMostActiveMeta = document.createElement("span");
  leaderboardStatMostActiveMeta.className = "leaderboard-stat__meta";

  leaderboardStatMostActiveName.append(leaderboardStatMostActivePlayer, leaderboardStatMostActiveMeta);

  leaderboardStatMostActiveDetails.append(
    leaderboardStatMostActiveLabel,
    leaderboardStatMostActiveName,
  );
  leaderboardStatMostActive.append(leaderboardStatMostActiveDetails);

  const leaderboardStatLongestStreak = document.createElement("div");
  leaderboardStatLongestStreak.className = "leaderboard-stat";
  leaderboardStatLongestStreak.hidden = true;

  const leaderboardStatLongestStreakDetails = document.createElement("div");
  leaderboardStatLongestStreakDetails.className = "leaderboard-stat__details";

  const leaderboardStatLongestStreakLabel = document.createElement("span");
  leaderboardStatLongestStreakLabel.className = "leaderboard-stat__label";
  bindLocalizedText(leaderboardStatLongestStreakLabel, "leaderboardLongestStreakLabel");

  const leaderboardStatLongestStreakName = document.createElement("p");
  leaderboardStatLongestStreakName.className = "leaderboard-stat__name";

  const leaderboardStatLongestStreakPlayer = document.createElement("span");
  leaderboardStatLongestStreakPlayer.className = "leaderboard-stat__player";

  const leaderboardStatLongestStreakMeta = document.createElement("span");
  leaderboardStatLongestStreakMeta.className = "leaderboard-stat__meta";

  leaderboardStatLongestStreakName.append(leaderboardStatLongestStreakPlayer, leaderboardStatLongestStreakMeta);

  leaderboardStatLongestStreakDetails.append(
    leaderboardStatLongestStreakLabel,
    leaderboardStatLongestStreakName,
  );
  leaderboardStatLongestStreak.append(leaderboardStatLongestStreakDetails);

  leaderboardStatsGroup.append(
    leaderboardMatchesSummary,
    leaderboardStatMostActive,
    leaderboardStatLongestStreak,
  );

  const leaderboardAvatarFallback = `${import.meta.env.BASE_URL}assets/logo.png`;

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
  bindLocalizedText(closeCreateMatchButton, "back");

  const composerHeading = document.createElement("div");

  const composerTitle = document.createElement("h3");
  composerTitle.className = "card-title";
  bindLocalizedText(composerTitle, "createMatch");

  const composerMeta = document.createElement("p");
  composerMeta.className = "card-meta";
  composerMeta.textContent = "";

  const composerStatus = document.createElement("p");
  composerStatus.className = "form-status";

  const matchSummary = document.createElement("p");
  matchSummary.className = "summary-chip";

  const matchLockNotice = document.createElement("p");
  matchLockNotice.className = "form-status";
  matchLockNotice.hidden = true;

  const matchQuickBar = document.createElement("div");
  matchQuickBar.className = "quick-bar quick-bar--match";
  matchQuickBar.append(matchSummary, matchLockNotice);

  const suggestMatchButton = document.createElement("button");
  suggestMatchButton.type = "button";
  suggestMatchButton.className = "primary-button";
  bindLocalizedText(suggestMatchButton, "suggestFairTeams");

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

  const tournamentDateInput = document.createElement("input");
  tournamentDateInput.className = "text-input";
  tournamentDateInput.type = "date";
  tournamentDateInput.value = getTodayDateValue();

  const tournamentSeasonSelect = document.createElement("select");
  tournamentSeasonSelect.className = "select-input";

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
  bindLocalizedText(scoreLabel, "scoreLabel");

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
    teamALabel: document.createElement("span"),
    teamBLabel: document.createElement("span"),
  }));

  const updateScoreLabelsAndPlaceholders = (teamALabel: string, teamBLabel: string): void => {
    const aLabel = teamALabel || t("teamALabel");
    const bLabel = teamBLabel || t("teamBLabel");
    scoreInputs.forEach((game) => {
      game.teamALabel.textContent = aLabel;
      game.teamBLabel.textContent = bLabel;
      game.teamA.placeholder = "0";
      game.teamB.placeholder = "0";
    });
  };

  const resetScoreInputs = (): void => {
    scoreInputs.forEach((game) => {
      game.teamA.value = "";
      game.teamB.value = "";
    });
  };

  updateScoreLabelsAndPlaceholders(t("teamALabel"), t("teamBLabel"));

  const submitMatchButton = document.createElement("button");
  submitMatchButton.type = "submit";
  submitMatchButton.className = "primary-button";
  bindLocalizedText(submitMatchButton, "createMatch");

  const matchesTop = document.createElement("div");
  matchesTop.className = "card-header match-topline";

  const matchesHeading = document.createElement("div");

  const matchesTitle = document.createElement("h3");
  matchesTitle.className = "card-title";
  bindLocalizedText(matchesTitle, "matchesTitle");

  const matchesMeta = document.createElement("p");
  matchesMeta.className = "card-meta";
  matchesMeta.textContent = "";

  const matchFilterToggle = document.createElement("div");
  matchFilterToggle.className = "segment-toggle match-filter-toggle";

  const matchFiltersRow = document.createElement("div");
  matchFiltersRow.className = "match-filter-row";
  matchFiltersRow.append(matchFilterToggle);

  const createMatchFilterButton = (filter: MatchFeedFilter): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = t(matchFilterLabels[filter]);
    button.addEventListener("click", () => {
      void applyMatchFilter(filter);
    });
    return button;
  };

  const visibleMatchFilters: MatchFeedFilter[] = ["recent", "mine"];
  const matchFilterButtons = new Map<MatchFeedFilter, HTMLButtonElement>();
  visibleMatchFilters.forEach((filter) => {
    const button = createMatchFilterButton(filter);
    matchFilterButtons.set(filter, button);
    matchFilterToggle.append(button);
  });

  const matchesList = document.createElement("div");
  matchesList.className = "matches-list";

  const loadMoreButton = document.createElement("button");
  loadMoreButton.type = "button";
  loadMoreButton.className = "secondary-button";
  bindLocalizedText(loadMoreButton, "loadMore");

  const tournamentPanel = document.createElement("section");
  tournamentPanel.className = "content-card tournament-card";

  const seasonPanel = document.createElement("section");
  seasonPanel.className = "content-card composer-card";

  const tournamentTop = document.createElement("div");
  tournamentTop.className = "card-header";

  const tournamentHeading = document.createElement("div");

  const tournamentTitle = document.createElement("h3");
  tournamentTitle.className = "card-title";
  bindLocalizedText(tournamentTitle, "createTournament");

  const tournamentMeta = document.createElement("p");
  tournamentMeta.className = "card-meta";
  bindLocalizedText(tournamentMeta, "tournamentMeta");

  const closeCreateTournamentButton = document.createElement("button");
  closeCreateTournamentButton.type = "button";
  closeCreateTournamentButton.className = "secondary-button compact-header-button";
  bindLocalizedText(closeCreateTournamentButton, "back");

  const seasonTop = document.createElement("div");
  seasonTop.className = "card-header";

  const seasonHeading = document.createElement("div");

  const seasonTitle = document.createElement("h3");
  seasonTitle.className = "card-title";
  bindLocalizedText(seasonTitle, "createSeason");

  const seasonMeta = document.createElement("p");
  seasonMeta.className = "card-meta";
  bindLocalizedText(seasonMeta, "seasonMeta");

  const closeCreateSeasonButton = document.createElement("button");
  closeCreateSeasonButton.type = "button";
  closeCreateSeasonButton.className = "secondary-button compact-header-button";
  bindLocalizedText(closeCreateSeasonButton, "back");

  const seasonStatus = document.createElement("p");
  seasonStatus.className = "form-status";

  const seasonSummary = document.createElement("p");
  seasonSummary.className = "summary-chip";

  const seasonLockNotice = document.createElement("p");
  seasonLockNotice.className = "form-status";
  seasonLockNotice.hidden = true;

  const seasonQuickBar = document.createElement("div");
  seasonQuickBar.className = "quick-bar quick-bar--season";
  seasonQuickBar.append(seasonSummary, seasonLockNotice);

  const seasonForm = document.createElement("form");
  seasonForm.className = "match-form";

  const seasonNameInput = document.createElement("input");
  seasonNameInput.className = "text-input";
  seasonNameInput.placeholder = "Season name";

  const loadSeasonSelect = document.createElement("select");
  loadSeasonSelect.className = "select-input";

  const loadSeasonButton = document.createElement("button");
  loadSeasonButton.type = "button";
  loadSeasonButton.className = "secondary-button";
  bindLocalizedText(loadSeasonButton, "loadSeason");
  const seasonLoadActions = document.createElement("div");
  seasonLoadActions.className = "share-panel__list-actions";
  seasonLoadActions.append(loadSeasonButton);

  const seasonStartDateInput = document.createElement("input");
  seasonStartDateInput.className = "text-input";
  seasonStartDateInput.type = "date";
  seasonStartDateInput.value = getTodayDateValue();

  const seasonEndDateInput = document.createElement("input");
  seasonEndDateInput.className = "text-input";
  seasonEndDateInput.type = "date";

  const seasonBaseEloSelect = document.createElement("select");
  seasonBaseEloSelect.className = "select-input";

  const seasonParticipantSection = document.createElement("div");
  seasonParticipantSection.className = "form-field";

  const seasonParticipantLabel = document.createElement("span");
  seasonParticipantLabel.className = "field-label";
  bindLocalizedText(seasonParticipantLabel, "participants");

  const seasonParticipantList = document.createElement("div");
  seasonParticipantList.className = "participant-list";

  const seasonSelectAllParticipantsField = document.createElement("label");
  seasonSelectAllParticipantsField.className = "checkbox-field";
  const seasonSelectAllParticipantsInput = document.createElement("input");
  seasonSelectAllParticipantsInput.type = "checkbox";
  seasonSelectAllParticipantsInput.className = "checkbox-input";
  const seasonSelectAllParticipantsCopy = document.createElement("span");
  seasonSelectAllParticipantsCopy.className = "field-label";
  bindLocalizedText(seasonSelectAllParticipantsCopy, "selectAllParticipants");
  seasonSelectAllParticipantsField.append(seasonSelectAllParticipantsInput, seasonSelectAllParticipantsCopy);

  const seasonIsActiveInput = document.createElement("input");
  seasonIsActiveInput.type = "checkbox";
  seasonIsActiveInput.checked = true;
  seasonIsActiveInput.className = "checkbox-input";

  const seasonIsPublicInput = document.createElement("input");
  seasonIsPublicInput.type = "checkbox";
  seasonIsPublicInput.className = "checkbox-input";

  const submitSeasonButton = document.createElement("button");
  submitSeasonButton.type = "submit";
  submitSeasonButton.className = "primary-button";
  bindLocalizedText(submitSeasonButton, "createSeason");

  const deleteSeasonButton = document.createElement("button");
  deleteSeasonButton.type = "button";
  deleteSeasonButton.className = "secondary-button destructive-button";
  bindLocalizedText(deleteSeasonButton, "deleteSeason");
  deleteSeasonButton.hidden = true;

  const tournamentNameInput = document.createElement("input");
  tournamentNameInput.className = "text-input";
  tournamentNameInput.placeholder = "Tournament name";

  const loadTournamentSelect = document.createElement("select");
  loadTournamentSelect.className = "select-input";

  const loadTournamentButton = document.createElement("button");
  loadTournamentButton.type = "button";
  loadTournamentButton.className = "secondary-button";
  bindLocalizedText(loadTournamentButton, "loadTournament");
  const tournamentLoadActions = document.createElement("div");
  tournamentLoadActions.className = "share-panel__list-actions";
  tournamentLoadActions.append(loadTournamentButton);

  const tournamentStatus = document.createElement("p");
  tournamentStatus.className = "form-status";

  const tournamentSummary = document.createElement("p");
  tournamentSummary.className = "summary-chip";

  const tournamentLockNotice = document.createElement("p");
  tournamentLockNotice.className = "form-status";
  tournamentLockNotice.hidden = true;

  const tournamentQuickBar = document.createElement("div");
  tournamentQuickBar.className = "quick-bar quick-bar--tournament";
  tournamentQuickBar.append(tournamentSummary, tournamentLockNotice);

  const participantSection = document.createElement("div");
  participantSection.className = "form-field";

  const participantLabel = document.createElement("span");
  participantLabel.className = "field-label";
  bindLocalizedText(participantLabel, "participants");

  const participantList = document.createElement("div");
  participantList.className = "participant-list";

  const tournamentSelectAllParticipantsField = document.createElement("label");
  tournamentSelectAllParticipantsField.className = "checkbox-field";
  const tournamentSelectAllParticipantsInput = document.createElement("input");
  tournamentSelectAllParticipantsInput.type = "checkbox";
  tournamentSelectAllParticipantsInput.className = "checkbox-input";
  const tournamentSelectAllParticipantsCopy = document.createElement("span");
  tournamentSelectAllParticipantsCopy.className = "field-label";
  bindLocalizedText(tournamentSelectAllParticipantsCopy, "selectAllParticipants");
  tournamentSelectAllParticipantsField.append(
    tournamentSelectAllParticipantsInput,
    tournamentSelectAllParticipantsCopy,
  );

  const suggestTournamentButton = document.createElement("button");
  suggestTournamentButton.type = "button";
  suggestTournamentButton.className = "primary-button";
  bindLocalizedText(suggestTournamentButton, "suggestTournament");

  const saveTournamentButton = document.createElement("button");
  saveTournamentButton.type = "button";
  saveTournamentButton.className = "primary-button";
  bindLocalizedText(saveTournamentButton, "saveTournament");

  const deleteTournamentButton = document.createElement("button");
  deleteTournamentButton.type = "button";
  deleteTournamentButton.className = "secondary-button destructive-button";
  bindLocalizedText(deleteTournamentButton, "deleteTournament");
  deleteTournamentButton.hidden = true;

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
  leaderboardStats: null,
  userProgress: null,
  segmentMode: "global",
  selectedSeasonId: "",
  selectedTournamentId: "",
  seasons: [],
  tournaments: [],
  matchesFilter: "mine",
  matches: [],
  matchesCursor: null,
    matchesLoading: false,
    matchBracketContextByMatchId: {},
    matchSubmitting: false,
    matchFormError: "",
    matchFormMessage: "",
    seasonSubmitting: false,
  seasonFormError: "",
  seasonFormMessage: "",
  tournamentSubmitting: false,
  tournamentFormMessage: "",
  editingSeasonId: "",
  editingSeasonParticipantIds: [],
  pendingCreateRequestId: "",
  shareCache: {},
  shareErrors: {},
  shareLoadingSegmentKey: "",
  shareNotice: "",
  pendingShareToken: "",
  sharePanelSeasonTargetId: "",
  sharePanelTournamentTargetId: "",
  shareAlertMessage: "",
};

  const captureShareTokenFromUrl = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    const shareToken = url.searchParams.get("shareToken");
    if (!shareToken) {
      return;
    }
    dashboardState.pendingShareToken = shareToken;
    url.searchParams.delete("shareToken");
    const newSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${newSearch ? `?${newSearch}` : ""}${url.hash}`;
    window.history.replaceState(null, "", nextUrl);
  };
  captureShareTokenFromUrl();

  let screenBeforeFaq: DashboardState["screen"] = "dashboard";
  let screenBeforePrivacy: DashboardState["screen"] = "dashboard";

  const tournamentPlannerState: TournamentPlannerState = {
    name: "",
    tournamentId: "",
    participantIds: [],
    firstRoundMatches: [],
    rounds: [],
    error: "",
  };

  let activeTournamentBracketMatchId: string | null = null;
  let authMenuOpen = false;
  let createMenuOpen = false;
  let leaderboardNeedsUpdate = true;
  let seasonSharePanelElements: SharePanelElements | null = null;
  let tournamentSharePanelElements: SharePanelElements | null = null;
  let seasonSharePanelRenderedUrl = "";
  let tournamentSharePanelRenderedUrl = "";
  let seasonSharePanelMounted = false;
  let tournamentSharePanelMounted = false;
  let seasonCopyFeedbackTimer: number | null = null;
  let tournamentCopyFeedbackTimer: number | null = null;

  const markLeaderboardDirty = (): void => {
    leaderboardNeedsUpdate = true;
  };

  const setGlobalLoading = (active: boolean, label = t("loadingOverlay")): void => {
    loadingOverlay.hidden = !active;
    loadingOverlayLabel.textContent = label;
    document.body.classList.toggle("app-busy", active);
  };

  const getSelectedSeason = (): SeasonRecord | undefined =>
    dashboardState.seasons.find((season) => season.id === dashboardState.selectedSeasonId);

  const getSelectedTournament = (): TournamentRecord | undefined =>
    dashboardState.tournaments.find((tournament) => tournament.id === dashboardState.selectedTournamentId);

  const getEditingSeason = (): SeasonRecord | undefined =>
    dashboardState.seasons.find((season) => season.id === dashboardState.editingSeasonId);

  const getEditingTournament = (): TournamentRecord | undefined =>
    dashboardState.tournaments.find((tournament) => tournament.id === tournamentPlannerState.tournamentId);

  const renderSeasonDraftSummary = (): void => {
    seasonSummary.textContent = [
      `${dashboardState.editingSeasonParticipantIds.length} participants`,
      seasonStartDateInput.value ? `Starts ${formatDate(seasonStartDateInput.value)}` : "No start date",
      `Base Elo: ${seasonBaseEloSelect.value.replace("_", " ")}`,
      seasonIsPublicInput.checked ? "Visibility: public" : "Visibility: private",
    ].join(" • ");
  };

  const renderTournamentDraftSummary = (): void => {
    const season = dashboardState.seasons.find((entry) => entry.id === tournamentSeasonSelect.value);
    tournamentSummary.textContent = [
      tournamentNameInput.value.trim() || "Untitled tournament",
      season ? season.name : "No season",
      `${tournamentPlannerState.participantIds.length} players`,
      tournamentDateInput.value ? formatDate(tournamentDateInput.value) : "No date",
    ].join(" • ");
  };

  const deriveMatchWinnerFromInputs = (): "A" | "B" | null => {
    const visibleGames = formatTypeSelect.value === "best_of_3" ? 3 : 1;
    const scoreEntries = scoreInputs
      .slice(0, visibleGames)
      .map((game) => ({
        teamA: Number(game.teamA.value),
        teamB: Number(game.teamB.value),
      }))
      .filter((game) => !Number.isNaN(game.teamA) && !Number.isNaN(game.teamB));

    if (scoreEntries.length === 0) {
      return null;
    }

    if (scoreEntries.some((game) => game.teamA === game.teamB)) {
      return null;
    }

    const teamAWins = scoreEntries.filter((game) => game.teamA > game.teamB).length;
    const teamBWins = scoreEntries.filter((game) => game.teamB > game.teamA).length;
    const requiredWins = formatTypeSelect.value === "single_game" ? 1 : 2;

    if (Math.max(teamAWins, teamBWins) < requiredWins || teamAWins === teamBWins) {
      return null;
    }

    return teamAWins > teamBWins ? "A" : "B";
  };

  const getPointsLabel = (value: string): string => {
    if (value === "11") {
      return t("points11");
    }
    if (value === "21") {
      return t("points21");
    }
    return `${value} ${t("pointsSuffix")}`;
  };

  const renderMatchDraftSummary = (): void => {
    const teamAPlayerIds = buildUniquePlayerList(
      matchTypeSelect.value === "singles"
        ? [teamA1Select.value]
        : [teamA1Select.value, teamA2Select.value],
    );
    const teamBPlayerIds = buildUniquePlayerList(
      matchTypeSelect.value === "singles"
        ? [teamB1Select.value]
        : [teamB1Select.value, teamB2Select.value],
    );
    const teamALabel =
      renderPlayerNames(teamAPlayerIds, dashboardState.players) || t("teamALabel");
    const teamBLabel =
      renderPlayerNames(teamBPlayerIds, dashboardState.players) || t("teamBLabel");
    updateScoreLabelsAndPlaceholders(teamALabel, teamBLabel);
    const season = dashboardState.seasons.find((entry) => entry.id === formSeasonSelect.value);
    const tournament = dashboardState.tournaments.find((entry) => entry.id === formTournamentSelect.value);
    const derivedWinner = deriveMatchWinnerFromInputs();
    if (derivedWinner) {
      winnerTeamSelect.value = derivedWinner;
    }
    const winnerLabel = derivedWinner
      ? `${t("matchSummaryWinnerPrefix")} ${getWinnerLabel(derivedWinner, teamALabel, teamBLabel)}`
      : t("matchSummaryWinnerTBD");
    const matchTypeLabel =
      matchTypeSelect.value === "singles" ? t("matchSummarySingles") : t("matchSummaryDoubles");
    const detailLabel =
      formatTypeSelect.value === "best_of_3"
        ? t("matchSummaryBestOf3")
        : getPointsLabel(pointsToWinSelect.value);
    matchSummary.textContent = [
      matchTypeLabel,
      `${teamALabel} vs ${teamBLabel}`,
      detailLabel,
      winnerLabel,
      getMatchFeedContextLabel(season, tournament),
    ].join(" • ");
  };

  const syncLoadControlsVisibility = (): void => {
    loadSeasonButton.hidden = !loadSeasonSelect.value;
    loadTournamentButton.hidden = !loadTournamentSelect.value;
  };

  const syncMatchFormLockState = (): void => {
    const season = dashboardState.seasons.find((entry) => entry.id === formSeasonSelect.value);
    const tournament = dashboardState.tournaments.find((entry) => entry.id === formTournamentSelect.value);
    const locked =
      isLockedSeason(season) ||
      isLockedTournament(tournament) ||
      Boolean(
        activeTournamentBracketMatchId &&
          tournamentPlannerState.rounds.some((round) =>
            round.matches.some(
              (match) =>
                match.id === activeTournamentBracketMatchId &&
                (match.locked || Boolean(match.createdMatchId)),
            ),
          ),
      );

    submitMatchButton.disabled = dashboardState.matchSubmitting || dashboardState.loading || locked;
    matchLockNotice.hidden = !locked;

    if (tournament && tournament.status === "completed") {
      matchLockNotice.textContent = t("matchLockTournamentComplete");
    } else if (season && season.status === "completed") {
      matchLockNotice.textContent = t("matchLockSeasonComplete");
    } else if (locked) {
      matchLockNotice.textContent = t("matchLockBracketLocked");
    }
  };

  const hasTournamentProgress = (): boolean =>
    tournamentPlannerState.rounds.some((round, roundIndex) =>
      round.matches.some((match) => {
        if (match.createdMatchId || match.winnerPlayerId) {
          return true;
        }
        return roundIndex > 0 && Boolean(match.leftPlayerId || match.rightPlayerId);
      }),
    );

  const rebuildLeaderboardList = (): void => {
    if (dashboardState.leaderboard.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = getLeaderboardEmptyState(dashboardState.segmentMode);
      leaderboardList.replaceChildren(empty);
      return;
    }

    const bestVisibleStreak = getBestVisibleStreak(dashboardState.leaderboard);
    const currentUserId = getCurrentUserId(state.current);
    const rows = dashboardState.leaderboard.slice(0, 20).map((entry) => {
      const row = document.createElement("article");
      row.className = [
        "leaderboard-row",
        entry.streak > 0 && entry.streak === bestVisibleStreak ? "leaderboard-row--hot-streak" : "",
        entry.userId === currentUserId ? "leaderboard-row--self" : "",
      ]
        .filter(Boolean)
        .join(" ");
      if (entry.rank <= 3) {
        row.dataset.rankTier = String(entry.rank);
      }

      const avatar = document.createElement("img");
      avatar.className = "player-avatar player-avatar-small leaderboard-row__avatar";
      setAvatarImage(
        avatar,
        entry.userId,
        entry.avatarUrl,
        `${import.meta.env.BASE_URL}assets/logo.png`,
        `${entry.displayName} avatar`,
      );

      const summary = document.createElement("div");
      summary.className = "leaderboard-summary";

      const identityLine = document.createElement("div");
      identityLine.className = "leaderboard-row__identity-line";

      const identity = document.createElement("span");
      identity.className = "leaderboard-identity";
      identity.textContent = `#${entry.rank} ${entry.displayName}`;

      identityLine.append(avatar, identity);

      if (entry.userId === currentUserId) {
        const youChip = document.createElement("span");
        youChip.className = "leaderboard-you-chip";
        youChip.textContent = "You";
        identityLine.append(youChip);
      }

      const record = document.createElement("span");
      record.className = "leaderboard-row__record";
      record.textContent = `${t("leaderboardWins")} ${entry.wins} • ${t("leaderboardLosses")} ${entry.losses}`;

      const streak = document.createElement("span");
      streak.className = "leaderboard-row__streak";
      streak.textContent = `${t("leaderboardStreak")} ${renderStreak(entry.streak)}`;

      if (entry.streak > 0 && entry.streak === bestVisibleStreak) {
        const fire = document.createElement("span");
        fire.className = "leaderboard-fire";
        fire.textContent = "🔥";
        fire.setAttribute("aria-label", `Best streak: ${entry.streak}`);
        fire.title = `Best streak: ${entry.streak}`;
        streak.append(" ", fire);
      }

      const elo = document.createElement("span");
      elo.className = "leaderboard-elo";
      elo.textContent = `(${entry.elo} Elo)`;

      const metaRow = document.createElement("div");
      metaRow.className = "leaderboard-row__meta-row";
      metaRow.append(record, streak, elo);

      summary.append(identityLine, metaRow);

      row.append(summary);
      return row;
    });
    leaderboardList.replaceChildren(...rows);
  };

  const renderLeaderboardList = (): void => {
    if (!leaderboardNeedsUpdate) {
      return;
    }
    rebuildLeaderboardList();
    leaderboardNeedsUpdate = false;
  };

  const syncAuthState = (): void => {
    if (isAuthedState(state.current)) {
      setAvatarImage(
        authAvatar,
        state.current.session.user.id,
        state.current.session.user.avatarUrl,
        `${import.meta.env.BASE_URL}assets/logo.png`,
        "Signed-in user avatar",
      );
      if (authMenu.children.length === 0) {
        authMenu.replaceChildren(faqMenuButton, logoutButton);
      }
      if (createMenu.children.length === 0) {
        createMenu.replaceChildren(
          openCreateMatchButton,
          openCreateTournamentButton,
          openCreateSeasonButton,
          openScoreCardButton,
        );
      }
      
      authMenu.hidden = !authMenuOpen;
      createMenu.hidden = !createMenuOpen;
      authMenuButton.setAttribute("aria-expanded", authMenuOpen ? "true" : "false");
      createMenuButton.setAttribute("aria-expanded", createMenuOpen ? "true" : "false");
      
      // Avatar and Hamburger menu stay in the header
      authActions.replaceChildren(authAvatar, authMenuButton, authMenu);
      providerStack.replaceChildren(languageSwitch, authActions);
      
      // Floating button and its menu are added to the root level to stay fixed
      if (createMenuButton.parentElement !== container) {
        container.append(createMenuButton, createMenu);
      }

      dashboard.hidden = dashboardState.screen !== "dashboard";
      createMatchScreen.hidden = dashboardState.screen !== "createMatch";
    createTournamentScreen.hidden = dashboardState.screen !== "createTournament";
    createSeasonScreen.hidden = dashboardState.screen !== "createSeason";
    faqScreen.hidden = dashboardState.screen !== "faq";
    privacyScreen.hidden = dashboardState.screen !== "privacy";
    loginView.hidden = true;
      welcomeText.textContent = "";
      scoreCardOverlay.hidden = !scoreCardVisible;
      return;
    }

    providerStack.replaceChildren(languageSwitch);
    if (createMenuButton.parentElement) createMenuButton.remove();
    if (createMenu.parentElement) createMenu.remove();
    authMenuOpen = false;
    createMenuOpen = false;
    dashboard.hidden = true;
    createMatchScreen.hidden = true;
    createTournamentScreen.hidden = true;
    createSeasonScreen.hidden = true;
    faqScreen.hidden = dashboardState.screen !== "faq";
    privacyScreen.hidden = dashboardState.screen !== "privacy";
    loginView.hidden = dashboardState.screen === "faq" || dashboardState.screen === "privacy";
    hideScoreCard();
  };

  const openFaqScreen = (): void => {
    if (dashboardState.screen !== "faq") {
      screenBeforeFaq = dashboardState.screen;
    }
    dashboardState.screen = "faq";
    authMenuOpen = false;
    createMenuOpen = false;
    syncAuthState();
    syncDashboardState();
  };

  const closeFaqScreen = (): void => {
    dashboardState.screen = screenBeforeFaq;
    screenBeforeFaq = "dashboard";
    syncAuthState();
    syncDashboardState();
  };

  const openPrivacyScreen = (): void => {
    if (dashboardState.screen !== "privacy") {
      screenBeforePrivacy = dashboardState.screen;
    }
    dashboardState.screen = "privacy";
    authMenuOpen = false;
    createMenuOpen = false;
    syncAuthState();
    syncDashboardState();
  };

  const closePrivacyScreen = (): void => {
    dashboardState.screen = screenBeforePrivacy;
    screenBeforePrivacy = "dashboard";
    syncAuthState();
    syncDashboardState();
  };

  const statusHideTimers: Record<"match" | "season" | "tournament", number | null> = {
    match: null,
    season: null,
    tournament: null,
  };

  const clearFormStatus = (target: "match" | "season" | "tournament"): void => {
    if (target === "match") {
      dashboardState.matchFormError = "";
      dashboardState.matchFormMessage = "";
      return;
    }
    if (target === "season") {
      dashboardState.seasonFormError = "";
      dashboardState.seasonFormMessage = "";
      return;
    }
    dashboardState.tournamentFormMessage = "";
    tournamentPlannerState.error = "";
  };

  const scheduleFormStatusHide = (target: "match" | "season" | "tournament", visible: boolean): void => {
    if (statusHideTimers[target]) {
      window.clearTimeout(statusHideTimers[target]!);
      statusHideTimers[target] = null;
    }

    if (!visible) {
      return;
    }

    statusHideTimers[target] = window.setTimeout(() => {
      clearFormStatus(target);
      statusHideTimers[target] = null;
      syncDashboardState();
    }, 5000);
  };

  let shareNoticeTimer: number | null = null;
  let shareAlertTimer: number | null = null;

  const buildSegmentShareKey = (segmentType: SegmentType, segmentId: string): string =>
    `${segmentType}:${segmentId}`;

  const getSeasonShareTargetId = (): string =>
    dashboardState.sharePanelSeasonTargetId || "";

  const getTournamentShareTargetId = (): string =>
    dashboardState.sharePanelTournamentTargetId || "";

  const setSeasonSharePanelTargetId = (segmentId: string): void => {
    dashboardState.sharePanelSeasonTargetId = segmentId;
    seasonSharePanelRenderedUrl = "";
    syncDashboardState();
  };

  const setTournamentSharePanelTargetId = (segmentId: string): void => {
    dashboardState.sharePanelTournamentTargetId = segmentId;
    tournamentSharePanelRenderedUrl = "";
    syncDashboardState();
  };

  const formatShareExpiration = (expiresAt: string): string => {
    if (!expiresAt) {
      return "";
    }
    const expires = Date.parse(expiresAt);
    if (Number.isNaN(expires)) {
      return "";
    }
    const diffMs = expires - Date.now();
    if (diffMs <= 0) {
      return t("shareExpired");
    }
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days >= 1) {
      return t("shareExpiresInDays").replace("{days}", String(days));
    }
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours >= 1) {
      return t("shareExpiresInHours").replace("{hours}", String(hours));
    }
    const minutes = Math.ceil(diffMs / (1000 * 60));
    return t("shareExpiresInMinutes").replace("{minutes}", String(minutes));
  };

  let shareQrModule:
    | {
      toCanvas: (
        canvas: HTMLCanvasElement,
        value: string,
        options: { width: number; margin: number },
      ) => Promise<void>;
    }
    | null = null;

  const renderShareQr = async (canvas: HTMLCanvasElement, value: string): Promise<void> => {
    const size = 96;
    canvas.width = size;
    canvas.height = size;
    if (!value) {
      canvas.hidden = true;
      return;
    }
    canvas.hidden = false;
    try {
      if (!shareQrModule) {
        shareQrModule = (await import(
          /* @vite-ignore */ "https://esm.sh/qrcode@1.5.3",
        )) as {
          toCanvas: (
            canvas: HTMLCanvasElement,
            value: string,
            options: { width: number; margin: number },
          ) => Promise<void>;
        };
      }
      await shareQrModule.toCanvas(canvas, value, { width: size, margin: 0 });
    } catch {
      canvas.hidden = true;
    }
  };

  const animateSharePanel = (panel: SharePanelElements): void => {
    panel.section.classList.add("share-panel--pulse");
    if (panel.animationTimer) {
      window.clearTimeout(panel.animationTimer);
    }
    panel.animationTimer = window.setTimeout(() => {
      panel.section.classList.remove("share-panel--pulse");
      panel.animationTimer = null;
    }, 700);
  };

  const updateSharePanelElements = (
    elements: SharePanelElements,
    segmentType: SegmentType,
    targetId: string,
    renderedUrl: string,
    setRenderedUrl: (value: string) => void,
  ): void => {
    const key = buildSegmentShareKey(segmentType, targetId);
    const shareInfo = targetId ? dashboardState.shareCache[key] : null;
    const error = dashboardState.shareErrors[key];
    const isLoading = dashboardState.shareLoadingSegmentKey === key;
    elements.createButton.disabled = !targetId || isLoading;
    elements.copyButton.disabled = !Boolean(shareInfo?.url);
    const statusMessage = error || (targetId ? "" : t("shareNoSegment"));
    elements.status.textContent = statusMessage;
    elements.status.dataset.status = error ? "error" : "ready";
    if (shareInfo && shareInfo.url && shareInfo.url !== renderedUrl) {
      setRenderedUrl(shareInfo.url);
      void renderShareQr(elements.qrCanvas, shareInfo.url);
    } else if (!shareInfo) {
      elements.qrCanvas.hidden = true;
    }
    elements.qrWrapper.hidden = !shareInfo;
  };

  const copyTextToClipboard = async (text: string): Promise<void> => {
    if (!text) {
      throw new Error("Nothing to copy.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  const showCopyFeedback = (
    panel: "season" | "tournament",
    element: HTMLSpanElement,
    message: string,
  ): void => {
    if (panel === "season") {
      if (seasonCopyFeedbackTimer) {
        window.clearTimeout(seasonCopyFeedbackTimer);
      }
    } else if (panel === "tournament") {
      if (tournamentCopyFeedbackTimer) {
        window.clearTimeout(tournamentCopyFeedbackTimer);
      }
    }
    element.textContent = message;
    const timer = window.setTimeout(() => {
      element.textContent = "";
      if (panel === "season") {
        seasonCopyFeedbackTimer = null;
      } else {
        tournamentCopyFeedbackTimer = null;
      }
    }, 2000);
    if (panel === "season") {
      seasonCopyFeedbackTimer = timer;
    } else {
      tournamentCopyFeedbackTimer = timer;
    }
  };


  const syncDashboardState = (): void => {
    const statusMessage = dashboardState.error
      ? dashboardState.error
      : dashboardState.loading
        ? "Refreshing..."
        : dashboardState.shareNotice || "";
    dashboardStatus.textContent = statusMessage;
    dashboardStatus.dataset.status = dashboardState.error ? "error" : "ready";
    shareAlert.textContent = dashboardState.shareAlertMessage;
    shareAlert.hidden = !Boolean(dashboardState.shareAlertMessage);

    globalButton.setAttribute("aria-pressed", String(dashboardState.segmentMode === "global"));
    seasonButton.setAttribute("aria-pressed", String(dashboardState.segmentMode === "season"));
    tournamentButton.setAttribute("aria-pressed", String(dashboardState.segmentMode === "tournament"));

    seasonSelect.hidden = dashboardState.segmentMode !== "season";
    tournamentSelect.hidden = dashboardState.segmentMode !== "tournament";
    seasonSelect.disabled = dashboardState.loading || dashboardState.seasons.length === 0;
    tournamentSelect.disabled = dashboardState.loading || dashboardState.tournaments.length === 0;
    refreshButton.disabled = dashboardState.loading || dashboardState.matchesLoading;
    createMenuButton.disabled = dashboardState.loading || dashboardState.matchesLoading;
    openCreateMatchButton.disabled = dashboardState.loading || dashboardState.matchesLoading;
    openCreateTournamentButton.disabled = dashboardState.loading || dashboardState.matchesLoading;
    openCreateSeasonButton.disabled = dashboardState.loading || dashboardState.matchesLoading;
    closeCreateMatchButton.disabled = dashboardState.matchSubmitting;
    closeCreateSeasonButton.disabled = dashboardState.seasonSubmitting;
    loadSeasonButton.disabled = dashboardState.loading || dashboardState.seasonSubmitting;
    suggestMatchButton.disabled = dashboardState.loading || dashboardState.matchSubmitting;
    loadTournamentButton.disabled = dashboardState.loading;
    saveTournamentButton.disabled =
      dashboardState.loading ||
      dashboardState.tournamentSubmitting ||
      tournamentPlannerState.rounds.length === 0 ||
      isLockedTournament(getEditingTournament());
    suggestTournamentButton.disabled =
      dashboardState.loading ||
      tournamentPlannerState.participantIds.length < 2 ||
      hasTournamentProgress() ||
      isLockedTournament(getEditingTournament());
    loadMoreButton.disabled = dashboardState.matchesLoading;
    loadMoreButton.hidden = !dashboardState.matchesCursor;
    matchFilterButtons.forEach((button, filter) => {
      button.setAttribute("aria-pressed", String(dashboardState.matchesFilter === filter));
    });
    composerStatus.textContent = dashboardState.matchFormError || dashboardState.matchFormMessage;
    composerStatus.dataset.status = dashboardState.matchFormError ? "error" : "ready";
    seasonStatus.textContent = dashboardState.seasonFormError || dashboardState.seasonFormMessage;
    seasonStatus.dataset.status = dashboardState.seasonFormError ? "error" : "ready";
    submitSeasonButton.textContent = dashboardState.seasonSubmitting
      ? "Saving season..."
      : dashboardState.editingSeasonId
        ? t("saveButtonLabel")
        : t("createSeason");
    submitMatchButton.textContent = dashboardState.matchSubmitting ? "Saving match..." : "Create match";
    saveTournamentButton.textContent = dashboardState.tournamentSubmitting
      ? "Saving tournament..."
      : tournamentPlannerState.tournamentId
        ? t("saveButtonLabel")
        : t("saveTournament");
    tournamentStatus.textContent = tournamentPlannerState.error || dashboardState.tournamentFormMessage;
    tournamentStatus.dataset.status = tournamentPlannerState.error ? "error" : "ready";
    deleteSeasonButton.hidden = !canSoftDelete(getEditingSeason() ?? {}, getCurrentUserId(state.current));
    deleteTournamentButton.hidden = !canSoftDelete(getEditingTournament() ?? {}, getCurrentUserId(state.current));

    scheduleFormStatusHide("match", Boolean(dashboardState.matchFormError || dashboardState.matchFormMessage));
    scheduleFormStatusHide("season", Boolean(dashboardState.seasonFormError || dashboardState.seasonFormMessage));
    scheduleFormStatusHide(
      "tournament",
      Boolean(tournamentPlannerState.error || dashboardState.tournamentFormMessage),
    );

    const editingSeason = getEditingSeason();
    seasonLockNotice.hidden = !isLockedSeason(editingSeason);
    seasonLockNotice.textContent = editingSeason?.status === "completed"
      ? t("seasonLockCompleted")
      : t("seasonLockDeleted");

    const editingTournament = getEditingTournament();
    tournamentLockNotice.hidden = !isLockedTournament(editingTournament);
    tournamentLockNotice.textContent = editingTournament?.status === "completed"
      ? t("tournamentLockCompleted")
      : t("tournamentLockDeleted");

    renderLeaderboardList();

    const leaderboardStats = dashboardState.leaderboardStats;
    const busiestPlayer = leaderboardStats?.mostMatchesPlayer ?? null;
    const longestStreakPlayer = dashboardState.leaderboard.reduce<LeaderboardEntry | null>((best, entry) => {
      if (entry.streak > 0 && (!best || entry.streak > best.streak)) {
        return entry;
      }
      return best;
    }, null);

    const showStats =
      Boolean(leaderboardStats?.totalMatches) || Boolean(busiestPlayer) || Boolean(longestStreakPlayer);
    leaderboardStatsGroup.hidden = !showStats;

    if (leaderboardStats?.totalMatches !== undefined) {
      leaderboardMatchesSummaryValue.textContent = formatCount(leaderboardStats.totalMatches);
      leaderboardMatchesSummary.hidden = false;
    } else {
      leaderboardMatchesSummary.hidden = true;
    }

    if (busiestPlayer && busiestPlayer.matchesPlayed > 0) {
      leaderboardStatMostActivePlayer.textContent = busiestPlayer.displayName;
      leaderboardStatMostActiveMeta.textContent = ` • 🔥 ${formatCount(busiestPlayer.matchesPlayed)} ${t(
        "progressMatchesLabel",
      )}`;
      leaderboardStatMostActive.hidden = false;
    } else {
      leaderboardStatMostActive.hidden = true;
    }

    if (longestStreakPlayer) {
      leaderboardStatLongestStreakPlayer.textContent = longestStreakPlayer.displayName;
      leaderboardStatLongestStreakMeta.textContent = ` • 🏆 ${longestStreakPlayer.streak} ${t("leaderboardWins")} streak`;
      leaderboardStatLongestStreak.hidden = false;
    } else {
      leaderboardStatLongestStreak.hidden = true;
    }

    matchesMeta.textContent = dashboardState.matchesLoading ? t("loadingMatches") : "";

    if (dashboardState.matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = dashboardState.matchesLoading
        ? t("loadingMatches")
        : getMatchFilterEmptyState(dashboardState.matchesFilter);
      matchesList.replaceChildren(empty);
    } else {
      const matchCards = dashboardState.matches.map((match) => {
        const cardNode = document.createElement("article");
        cardNode.className = "match-row";

        const meta = document.createElement("div");
        meta.className = "match-meta";

        const header = document.createElement("div");
        header.className = "match-row__header";

        const detailLine = document.createElement("div");
        detailLine.className = "match-row__detail-line";

        const createTeamBlock = (labelText: string, winner: boolean): HTMLDivElement => {
          const block = document.createElement("div");
          block.className = [
            "match-row__team",
            winner ? "match-row__team--winner" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const teamName = document.createElement("span");
          teamName.className = "match-row__team-name";
          teamName.textContent = labelText;

          block.append(teamName);
          return block;
        };

        const teamALabel =
          renderPlayerNames(match.teamAPlayerIds, dashboardState.players) || t("teamALabel");
        const teamBLabel =
          renderPlayerNames(match.teamBPlayerIds, dashboardState.players) || t("teamBLabel");

        const scoreBadge = document.createElement("div");
        scoreBadge.className = "match-row__score-badge";
        scoreBadge.textContent = renderMatchScore(match);

        const teamARow = document.createElement("div");
        teamARow.className = "match-row__team-row match-row__team-row--left";
        teamARow.append(createTeamBlock(teamALabel, match.winnerTeam === "A"));

        const scoreRow = document.createElement("div");
        scoreRow.className = "match-row__score-row";
        scoreRow.append(scoreBadge);

        const teamBRow = document.createElement("div");
        teamBRow.className = "match-row__team-row match-row__team-row--right";
        teamBRow.append(createTeamBlock(teamBLabel, match.winnerTeam === "B"));

        header.append(teamARow, scoreRow, teamBRow);

        const matchTypeLabel = document.createElement("span");
        matchTypeLabel.className = "match-type";
        matchTypeLabel.textContent =
          match.matchType === "singles" ? t("matchSummarySingles") : t("matchSummaryDoubles");

        const contextLabel = document.createElement("span");
        contextLabel.className = "match-context";
        contextLabel.textContent = renderMatchContext(
          match,
          dashboardState.seasons,
          dashboardState.tournaments,
          match.bracketContext || null,
          { includeRound: false },
        );

        detailLine.append(matchTypeLabel, contextLabel);

        const bracketContext = dashboardState.matchBracketContextByMatchId[match.id] || null;
        if (bracketContext?.roundTitle) {
          const roundTag = document.createElement("span");
          roundTag.className = "match-round";
          roundTag.textContent = `${bracketContext.isFinal ? "🏆 " : ""}${bracketContext.roundTitle}`;
          detailLine.append(roundTag);
        }

        meta.append(header, detailLine);

        const footer = document.createElement("div");
        footer.className = "match-meta__footer";
        const footerText = document.createElement("span");
        footerText.textContent = formatDateTime(match.playedAt);
        footer.append(footerText);

        if (canSoftDelete(match, getCurrentUserId(state.current))) {
          const deleteMatchButton = document.createElement("button");
          deleteMatchButton.type = "button";
          deleteMatchButton.className = "icon-button match-delete-button";
          deleteMatchButton.textContent = "🗑";
          deleteMatchButton.setAttribute("aria-label", "Delete match");
          deleteMatchButton.title = "Delete match";
          deleteMatchButton.addEventListener("click", () => {
            void deleteMatch(match);
          });
          cardNode.append(deleteMatchButton);
        }

        cardNode.append(meta, footer);
        return cardNode;
      });
      matchesList.replaceChildren(...matchCards);
    }

    if (!dashboardState.userProgress) {
      progressSummary.hidden = true;
      progressSummary.replaceChildren();
      progressSubtitleRankLabel.textContent = "";
      progressSubtitleRankValue.textContent = "";
      progressSubtitleRankValue.classList.add("progress-subtitle__rank-value--hidden");
      progressSubtitleElo.textContent = "";
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = t("progressEmpty");
      progressBody.replaceChildren(empty);
    } else {
      const progress = dashboardState.userProgress;

      const totalMatches = progress.wins + progress.losses;

      const rankLabelText =
        progress.currentRank === null ? t("progressUnranked") : t("progressRanked");
      progressSummary.hidden = false;
      progressSummary.replaceChildren(
        createProgressSummaryItem(`${t("progressBestElo")}: ${progress.bestElo}`),
        createProgressSummaryItem(`${t("progressBestStreak")}: ${progress.bestStreak}`),
      );
      progressSubtitleRankLabel.textContent = rankLabelText;
      if (progress.currentRank !== null) {
        progressSubtitleRankValue.textContent = `#${progress.currentRank}`;
        progressSubtitleRankValue.classList.remove("progress-subtitle__rank-value--hidden");
      } else {
        progressSubtitleRankValue.textContent = "";
        progressSubtitleRankValue.classList.add("progress-subtitle__rank-value--hidden");
      }
      progressSubtitleElo.textContent = `${t("progressElo")} ${progress.currentElo}`;

      const svgNamespace = "http://www.w3.org/2000/svg";
      const initialPoint = createInitialProgressPoint(progress.points[0]);
      const basePoints = [initialPoint, ...progress.points];
      const displayPoints = sampleProgressPoints(basePoints, MAX_PROGRESS_DISPLAY_POINTS);

      const eloValues =
        progress.points.length > 0 ? progress.points.map((point) => point.elo) : [progress.currentElo];
      const actualMin = Math.min(...eloValues);
      const actualMax = Math.max(...eloValues);
      const axisHalfRange = Math.max(
        Math.max(Math.abs(actualMax - 1200), Math.abs(actualMin - 1200)),
        40,
      );
      const axisMin = 1200 - axisHalfRange;
      const axisMax = 1200 + axisHalfRange;
      const geometry = buildProgressGeometry(
        displayPoints,
        272,
        100,
        36,
        12,
        axisMin,
        axisMax,
      );
      const chart = document.createElementNS(svgNamespace, "svg");
      chart.setAttribute("viewBox", "0 0 320 140");
      chart.setAttribute("class", "progress-chart");

      const axis = document.createElementNS(svgNamespace, "path");
      axis.setAttribute("d", "M36 12 L36 112 L308 112");
      axis.setAttribute("class", "progress-axis");

      const baselineY = 12 + 100 / 2;

      const yAxisLabel = document.createElementNS(svgNamespace, "text");
      yAxisLabel.setAttribute("x", "16");
      yAxisLabel.setAttribute("y", "70");
      yAxisLabel.setAttribute("text-anchor", "middle");
      yAxisLabel.setAttribute("transform", "rotate(-90 16 70)");
      yAxisLabel.setAttribute("class", "progress-axis-label progress-axis-label--y");
      yAxisLabel.textContent = t("progressChartYAxis");

      const baselineLine = document.createElementNS(svgNamespace, "line");
      baselineLine.setAttribute("x1", "36");
      baselineLine.setAttribute("x2", "308");
      baselineLine.setAttribute("y1", baselineY.toFixed(1));
      baselineLine.setAttribute("y2", baselineY.toFixed(1));
      baselineLine.setAttribute("class", "progress-baseline");

      const baselineLabel = document.createElementNS(svgNamespace, "text");
      baselineLabel.setAttribute("x", "308");
      baselineLabel.setAttribute("y", (baselineY - 4).toFixed(1));
      baselineLabel.setAttribute("text-anchor", "end");
      baselineLabel.setAttribute("class", "progress-baseline-label");
      baselineLabel.textContent = "1200";

      const path = document.createElementNS(svgNamespace, "path");
      path.setAttribute("d", geometry.path);
      path.setAttribute("class", "progress-line");

      const yTop = document.createElementNS(svgNamespace, "text");
      yTop.setAttribute("x", "0");
      yTop.setAttribute("y", "18");
      yTop.setAttribute("class", "progress-axis-label");
      yTop.textContent = `${Math.round(axisMax)}`;

      const yBottom = document.createElementNS(svgNamespace, "text");
      yBottom.setAttribute("x", "0");
      yBottom.setAttribute("y", "116");
      yBottom.setAttribute("class", "progress-axis-label");
      yBottom.textContent = `${Math.round(axisMin)}`;

      const pointsLayer = document.createElementNS(svgNamespace, "g");
      pointsLayer.setAttribute("class", "progress-points");
      geometry.coordinates.forEach((coord, index) => {
        const circle = document.createElementNS(svgNamespace, "circle");
        circle.setAttribute("cx", coord.x.toFixed(1));
        circle.setAttribute("cy", coord.y.toFixed(1));
        circle.setAttribute("r", "5");
        circle.setAttribute("class", "progress-point");
        const sourcePoint = displayPoints[index];
        circle.setAttribute("title", formatProgressPointTooltip(sourcePoint));
        pointsLayer.append(circle);
      });

      const firstPoint = displayPoints[0];
      const lastPoint = displayPoints[displayPoints.length - 1];

      const xLeft = document.createElementNS(svgNamespace, "text");
      xLeft.setAttribute("x", "36");
      xLeft.setAttribute("y", "134");
      xLeft.setAttribute("class", "progress-axis-label");
      xLeft.textContent = formatDate(firstPoint.playedAt);

      const xRight = document.createElementNS(svgNamespace, "text");
      xRight.setAttribute("x", "308");
      xRight.setAttribute("y", "134");
      xRight.setAttribute("text-anchor", "end");
      xRight.setAttribute("class", "progress-axis-label");
      xRight.textContent = formatDate(lastPoint.playedAt);

      chart.append(axis, yAxisLabel, baselineLine, baselineLabel, path, pointsLayer, yTop, yBottom, xLeft, xRight);

      const progressLayout = document.createElement("div");
      progressLayout.className = "progress-layout";

      const chartPanel = document.createElement("div");
      chartPanel.className = "progress-chart-panel";

      const chartWrapper = document.createElement("div");
      chartWrapper.className = "progress-chart-wrapper";
      chartWrapper.append(chart);

      chartPanel.append(chartWrapper);

      const donutPanel = document.createElement("div");
      donutPanel.className = "progress-donut-panel";

      const donutSize = 96;
      const donutRadius = 36;
      const donutCircumference = 2 * Math.PI * donutRadius;
      const winsRatio = totalMatches === 0 ? 0 : progress.wins / totalMatches;
      const successColor = winsRatio < 0.45 ? "#d63c2c" : "var(--brand-rank)";

      const donutSvg = document.createElementNS(svgNamespace, "svg");
      donutSvg.setAttribute("viewBox", `0 0 ${donutSize} ${donutSize}`);
      donutSvg.setAttribute("class", "progress-donut-ring");

      const donutBg = document.createElementNS(svgNamespace, "circle");
      donutBg.setAttribute("cx", String(donutSize / 2));
      donutBg.setAttribute("cy", String(donutSize / 2));
      donutBg.setAttribute("r", String(donutRadius));
      donutBg.setAttribute("class", "progress-donut-ring-bg");

      const winsArc = document.createElementNS(svgNamespace, "circle");
      winsArc.setAttribute("cx", String(donutSize / 2));
      winsArc.setAttribute("cy", String(donutSize / 2));
      winsArc.setAttribute("r", String(donutRadius));
      winsArc.setAttribute("class", "progress-donut-ring-wins");
      winsArc.style.stroke = successColor;
      winsArc.setAttribute("stroke-dasharray", `${donutCircumference} ${donutCircumference}`);
      winsArc.setAttribute("stroke-dashoffset", (donutCircumference * (1 - winsRatio)).toFixed(2));
      winsArc.setAttribute("transform", `rotate(-90 ${donutSize / 2} ${donutSize / 2})`);

      donutSvg.append(donutBg, winsArc);

      const successPercent = Math.round(winsRatio * 100);
      const donutSvgWrapper = document.createElement("div");
      donutSvgWrapper.className = "progress-donut-svg";
      const successLabel = document.createElement("span");
      successLabel.className = "progress-donut-success";
      successLabel.textContent = `${successPercent}%`;
      successLabel.style.color = successColor;
      donutSvgWrapper.append(donutSvg, successLabel);

      const createStatRow = (
        label: string,
        value: string,
        indicatorModifier?: string,
      ): HTMLDivElement => {
        const row = document.createElement("div");
        row.className = "progress-donut-stat-row";

        const labelWrapper = document.createElement("div");
        labelWrapper.className = "progress-donut-stat-row-label";

        const indicator = document.createElement("span");
        indicator.className = "progress-donut-legend-indicator";
        if (indicatorModifier) {
          indicator.classList.add(indicatorModifier);
        } else {
          indicator.classList.add("progress-donut-legend-indicator--empty");
        }
        labelWrapper.append(indicator);

        const labelNode = document.createElement("span");
        labelNode.textContent = label;
        labelWrapper.append(labelNode);

        const valueNode = document.createElement("span");
        valueNode.className = "progress-donut-stat-row-value";
        valueNode.textContent = value;

        row.append(labelWrapper, valueNode);
        return row;
      };

      const statsColumn = document.createElement("div");
      statsColumn.className = "progress-donut-stats";
      statsColumn.append(
        createStatRow(t("progressMatchesLabel"), String(totalMatches)),
        createStatRow(
          t("leaderboardWins"),
          String(progress.wins),
          "progress-donut-legend-indicator--wins",
        ),
        createStatRow(
          t("leaderboardLosses"),
          String(progress.losses),
          "progress-donut-legend-indicator--losses",
        ),
      );

      const donutRow = document.createElement("div");
      donutRow.className = "progress-donut-row";
      donutRow.append(donutSvgWrapper, statsColumn);

      donutPanel.append(donutRow);
      progressLayout.append(chartPanel, donutPanel);
      progressBody.replaceChildren(progressLayout);
    }

    updateSeasonSharePanelVisibility();
    if (seasonSharePanelElements) {
      updateSharePanelElements(
        seasonSharePanelElements,
        "season",
        getSeasonShareTargetId(),
        seasonSharePanelRenderedUrl,
        (value) => {
          seasonSharePanelRenderedUrl = value;
        },
      );
    }
    updateTournamentSharePanelVisibility();
    if (tournamentSharePanelElements) {
      updateSharePanelElements(
        tournamentSharePanelElements,
        "tournament",
        getTournamentShareTargetId(),
        tournamentSharePanelRenderedUrl,
        (value) => {
          tournamentSharePanelRenderedUrl = value;
        },
      );
    }
    renderSeasonDraftSummary();
    renderTournamentDraftSummary();
    renderMatchDraftSummary();
    syncMatchFormLockState();
  };

  const showShareNotice = (message: string): void => {
    dashboardState.shareNotice = message;
    if (shareNoticeTimer) {
      window.clearTimeout(shareNoticeTimer);
      shareNoticeTimer = null;
    }
    if (message) {
      shareNoticeTimer = window.setTimeout(() => {
        dashboardState.shareNotice = "";
        shareNoticeTimer = null;
        syncDashboardState();
      }, 5000);
    }
    syncDashboardState();
  };

  const setShareAlertVisible = (visible: boolean): void => {
    if (!shareAlert) {
      return;
    }
    shareAlert.classList.toggle("share-alert--visible", visible);
  };

  const showShareAlert = (message: string): void => {
    dashboardState.shareAlertMessage = message;
    setShareAlertVisible(Boolean(message));
    if (shareAlertTimer) {
      window.clearTimeout(shareAlertTimer);
      shareAlertTimer = null;
    }
    if (message) {
      shareAlertTimer = window.setTimeout(() => {
        dashboardState.shareAlertMessage = "";
        shareAlertTimer = null;
        setShareAlertVisible(false);
        syncDashboardState();
      }, 6000);
    }
    showShareNotice(message);
    syncDashboardState();
  };

  if (dashboardState.pendingShareToken && !isAuthedState(state.current)) {
    showShareAlert(t("shareSignInPrompt"));
  }

  const refreshSegmentShareLink = async (
    segmentType: SegmentType,
    segmentId: string,
    panel: SharePanelElements | null = null,
  ): Promise<void> => {
    if (!segmentId || dashboardState.shareLoadingSegmentKey === buildSegmentShareKey(segmentType, segmentId)) {
      return;
    }
    const key = buildSegmentShareKey(segmentType, segmentId);
    dashboardState.shareLoadingSegmentKey = key;
    delete dashboardState.shareErrors[key];
    syncDashboardState();

    try {
      const data = await runAuthedAction("createSegmentShareLink", { segmentType, segmentId });
      dashboardState.shareCache[key] = {
        segmentType,
        segmentId,
        shareToken: data.shareToken,
        url: data.url,
        expiresAt: data.expiresAt,
      };
      delete dashboardState.shareErrors[key];
      if (panel) {
        animateSharePanel(panel);
      }
    } catch (error) {
      dashboardState.shareErrors[key] =
        error instanceof Error ? error.message : t("shareCreateFailure");
    } finally {
      dashboardState.shareLoadingSegmentKey = "";
      syncDashboardState();
    }
  };

  const tryRedeemPendingShareToken = async (): Promise<void> => {
    if (!dashboardState.pendingShareToken || !isAuthedState(state.current)) {
      return;
    }
    const token = dashboardState.pendingShareToken;
    dashboardState.pendingShareToken = "";
    try {
      const data = await runAuthedAction("redeemSegmentShareLink", { shareToken: token });
      const noticeKey = data.segmentType === "season"
        ? data.joined ? "shareJoinedSeason" : "shareAlreadyJoinedSeason"
        : data.joined ? "shareJoinedTournament" : "shareAlreadyJoinedTournament";
      showShareAlert(t(noticeKey));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("shareJoinFailure");
      showShareAlert(message);
    }
  };

  onLanguageChange(() => {
    populateSeasonOptions();
    populateTournamentOptions();
    populateTournamentPlannerLoadOptions();
    populateSeasonManagerLoadOptions();
    populateMatchFormOptions();
    renderMatchDraftSummary();
    renderLeaderboardList();
    syncDashboardState();
  });

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
      option.textContent = `${season.name} (${formatDate(season.startDate)})${season.status === "completed" ? " • Completed" : ""}`;
      option.selected = season.id === dashboardState.selectedSeasonId;
      return option;
    });

    if (options.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = t("noSeasonsAvailable");
      options.push(option);
    }

    seasonSelect.replaceChildren(...options);
  };

  const populateTournamentOptions = (): void => {
    const options = dashboardState.tournaments.map((tournament) => {
      const option = document.createElement("option");
      option.value = tournament.id;
      option.textContent = `${tournament.name} • ${tournament.seasonName || "Open"} • ${formatDate(tournament.date)}`;
      option.selected = tournament.id === dashboardState.selectedTournamentId;
      return option;
    });

    if (options.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = t("noTournamentsAvailable");
      options.push(option);
    }

    tournamentSelect.replaceChildren(...options);
  };

  const populateTournamentPlannerLoadOptions = (): void => {
    replaceOptions(
      loadTournamentSelect,
      [
        { value: "", label: t("savedTournaments") },
        ...dashboardState.tournaments.map((tournament) => ({
          value: tournament.id,
          label: `${tournament.name} • ${tournament.participantCount} players`,
        })),
      ],
      tournamentPlannerState.tournamentId,
      t("savedTournaments"),
    );
    syncLoadControlsVisibility();
  };

  const populateSeasonManagerLoadOptions = (): void => {
    replaceOptions(
      loadSeasonSelect,
      [
        { value: "", label: t("savedSeasons") },
        ...dashboardState.seasons.map((season) => ({
          value: season.id,
          label: `${season.name}${season.status === "completed" ? " • Completed" : ""}`,
        })),
      ],
      dashboardState.editingSeasonId,
      t("savedSeasons"),
    );
    syncLoadControlsVisibility();
  };

  const getSelectableSeasonParticipantIds = (): string[] => {
    const locked = isLockedSeason(getEditingSeason());
    if (locked) {
      return [];
    }
    const sessionUserId = getCurrentUserId(state.current);
    return dashboardState.players
      .filter((player) => player.userId !== sessionUserId)
      .map((player) => player.userId);
  };

  const updateSeasonSelectAllState = (): void => {
    const selectableIds = getSelectableSeasonParticipantIds();
    const locked = isLockedSeason(getEditingSeason());
    seasonSelectAllParticipantsInput.disabled = locked || selectableIds.length === 0;

    if (selectableIds.length === 0) {
      seasonSelectAllParticipantsInput.checked = false;
      seasonSelectAllParticipantsInput.indeterminate = false;
      return;
    }

    const selectedSet = new Set(dashboardState.editingSeasonParticipantIds);
    const selectedCount = selectableIds.filter((id) => selectedSet.has(id)).length;
    seasonSelectAllParticipantsInput.checked = selectedCount === selectableIds.length;
    seasonSelectAllParticipantsInput.indeterminate =
      selectedCount > 0 && selectedCount < selectableIds.length;
  };

  const getSelectableTournamentParticipantIds = (): string[] => {
    const locked = isLockedTournament(getEditingTournament());
    if (locked) {
      return [];
    }
    return dashboardState.players.map((player) => player.userId);
  };

  const updateTournamentSelectAllState = (): void => {
    const selectableIds = getSelectableTournamentParticipantIds();
    const locked = isLockedTournament(getEditingTournament());
    tournamentSelectAllParticipantsInput.disabled = locked || selectableIds.length === 0;

    if (selectableIds.length === 0) {
      tournamentSelectAllParticipantsInput.checked = false;
      tournamentSelectAllParticipantsInput.indeterminate = false;
      return;
    }

    const selectedSet = new Set(tournamentPlannerState.participantIds);
    const selectedCount = selectableIds.filter((id) => selectedSet.has(id)).length;
    tournamentSelectAllParticipantsInput.checked = selectedCount === selectableIds.length;
    tournamentSelectAllParticipantsInput.indeterminate =
      selectedCount > 0 && selectedCount < selectableIds.length;
  };

  const renderSeasonEditor = (): void => {
    const selectedParticipants = new Set(dashboardState.editingSeasonParticipantIds);
    const sessionUserId = isAuthedState(state.current) ? state.current.session.user.id : "";
    const locked = isLockedSeason(getEditingSeason());

    const participantCards = dashboardState.players.map((player) => {
      const label = document.createElement("label");
      label.className = "participant-chip";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedParticipants.has(player.userId);
      input.disabled = player.userId === sessionUserId || locked;
      input.addEventListener("change", () => {
        if (input.checked) {
          dashboardState.editingSeasonParticipantIds = [
            ...dashboardState.editingSeasonParticipantIds,
            player.userId,
          ];
        } else {
          dashboardState.editingSeasonParticipantIds = dashboardState.editingSeasonParticipantIds.filter(
            (participantId) => participantId !== player.userId,
          );
        }
        dashboardState.seasonFormError = "";
        dashboardState.seasonFormMessage = "";
        renderSeasonEditor();
        syncDashboardState();
      });

      const text = document.createElement("span");
      text.textContent = `${player.displayName} (${player.elo})`;

      label.append(input, text);
      return label;
    });

    seasonParticipantList.replaceChildren(...participantCards);
    updateSeasonSelectAllState();
  };

  const renderTournamentPlanner = (): void => {
    const selectedParticipants = new Set(tournamentPlannerState.participantIds);
    const playerOptions = dashboardState.players;
    const editingTournament = getEditingTournament();
    const tournamentLocked = isLockedTournament(editingTournament);

    const participantCards = playerOptions.map((player) => {
      const label = document.createElement("label");
      label.className = "participant-chip";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedParticipants.has(player.userId);
      input.disabled = tournamentLocked;
      input.addEventListener("change", () => {
        if (input.checked) {
          tournamentPlannerState.participantIds = [...tournamentPlannerState.participantIds, player.userId];
        } else {
        tournamentPlannerState.participantIds = tournamentPlannerState.participantIds.filter(
          (participantId) => participantId !== player.userId,
        );
      }
      tournamentPlannerState.tournamentId = "";
      setTournamentSharePanelTargetId("");
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
      empty.textContent = t("bracketPreviewEmpty");
      bracketBoard.replaceChildren(empty);
      updateTournamentSelectAllState();
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

            select.disabled =
              tournamentLocked ||
              Boolean(match.createdMatchId) ||
              Boolean(match.locked) ||
              Boolean(match.winnerPlayerId);
            select.title = select.disabled ? "Locked after bracket advancement" : "";

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
          setAvatarImage(
            leftAvatar,
            leftPlayer?.userId,
            leftPlayer?.avatarUrl,
            `${import.meta.env.BASE_URL}assets/logo.png`,
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
            ? renderPlayerNames([match.rightPlayerId], dashboardState.players)
            : `Winner ${tournamentPlannerState.rounds[roundIndex - 1].title} ${matchIndex * 2 + 2}`;
          const rightPlayer = findPlayer(match.rightPlayerId, dashboardState.players);
          const rightAvatar = document.createElement("img");
          rightAvatar.className = "player-avatar player-avatar-small";
          setAvatarImage(
            rightAvatar,
            rightPlayer?.userId,
            rightPlayer?.avatarUrl,
            `${import.meta.env.BASE_URL}assets/logo.png`,
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
            void advanceTournamentBye(roundIndex, matchIndex);
          });
          cardNode.append(advanceButton);
        } else if (match.leftPlayerId && match.rightPlayerId) {
          const createMatchButton = document.createElement("button");
          createMatchButton.type = "button";
          createMatchButton.className = "secondary-button bracket-action";
          createMatchButton.textContent = match.createdMatchId ? "Match created" : "Create match";
          createMatchButton.disabled =
            !!match.createdMatchId || !tournamentPlannerState.tournamentId || tournamentLocked;
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
    updateTournamentSelectAllState();
  };

  seasonSelectAllParticipantsInput.addEventListener("change", () => {
    if (seasonSelectAllParticipantsInput.disabled) {
      return;
    }
    const selectableIds = getSelectableSeasonParticipantIds();
    if (seasonSelectAllParticipantsInput.checked) {
      const nextIds = new Set(dashboardState.editingSeasonParticipantIds);
      selectableIds.forEach((id) => nextIds.add(id));
      dashboardState.editingSeasonParticipantIds = Array.from(nextIds);
    } else {
      dashboardState.editingSeasonParticipantIds = dashboardState.editingSeasonParticipantIds.filter(
        (participantId) => !selectableIds.includes(participantId),
      );
    }
    dashboardState.seasonFormError = "";
    dashboardState.seasonFormMessage = "";
    renderSeasonEditor();
    syncDashboardState();
  });

  tournamentSelectAllParticipantsInput.addEventListener("change", () => {
    if (tournamentSelectAllParticipantsInput.disabled) {
      return;
    }
    const selectableIds = getSelectableTournamentParticipantIds();
    if (tournamentSelectAllParticipantsInput.checked) {
      const nextIds = new Set(tournamentPlannerState.participantIds);
      selectableIds.forEach((id) => nextIds.add(id));
      tournamentPlannerState.participantIds = Array.from(nextIds);
    } else {
      tournamentPlannerState.participantIds = tournamentPlannerState.participantIds.filter(
        (participantId) => !selectableIds.includes(participantId),
      );
    }
    tournamentPlannerState.tournamentId = "";
    setTournamentSharePanelTargetId("");
    tournamentPlannerState.error = "";
    tournamentPlannerState.rounds = [];
    tournamentPlannerState.firstRoundMatches = [];
    loadTournamentSelect.value = "";
    renderTournamentPlanner();
    syncDashboardState();
  });

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
          label: `${season.name}${season.status === "completed" ? " • Completed" : ""}`,
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
          label: `${tournament.name}${tournament.status === "completed" ? " • Completed" : ""}`,
        })),
      ],
      formTournamentSelect.value,
      "No tournament",
    );

    replaceOptions(
      tournamentSeasonSelect,
      [
        { value: "", label: "No season" },
        ...dashboardState.seasons.map((season) => ({
          value: season.id,
          label: season.name,
        })),
      ],
      tournamentSeasonSelect.value,
      "No season",
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

    if (score.length === 0) {
      throw new Error("Enter at least one game score.");
    }
    if (score.some((game) => game.teamA === game.teamB)) {
      throw new Error("A ranked match must have a winner.");
    }

    const teamAWins = score.filter((game) => game.teamA > game.teamB).length;
    const teamBWins = score.filter((game) => game.teamB > game.teamA).length;
    const requiredWins = formatTypeSelect.value === "single_game" ? 1 : 2;

    if (Math.max(teamAWins, teamBWins) < requiredWins) {
      throw new Error("The match must include enough decisive games.");
    }
    if (teamAWins === teamBWins) {
      throw new Error("A ranked match must have a winner.");
    }

    const actualWinner = teamAWins > teamBWins ? "A" : "B";
    const selectedWinner = winnerTeamSelect.value as CreateMatchPayload["winnerTeam"];
    if (selectedWinner !== actualWinner) {
      throw new Error("The selected winner does not match the submitted score.");
    }

    return {
      matchType: matchTypeSelect.value as CreateMatchPayload["matchType"],
      formatType: formatTypeSelect.value as CreateMatchPayload["formatType"],
      pointsToWin: Number(pointsToWinSelect.value) as 11 | 21,
      teamAPlayerIds: playerIdsA,
      teamBPlayerIds: playerIdsB,
      score,
      winnerTeam: selectedWinner,
      playedAt: new Date().toISOString(),
      seasonId: formSeasonSelect.value || null,
      tournamentId: formTournamentSelect.value || null,
      tournamentBracketMatchId: activeTournamentBracketMatchId,
    };
  };

  const collectSeasonPayload = (): CreateSeasonPayload => ({
    seasonId: dashboardState.editingSeasonId || null,
    name: seasonNameInput.value.trim(),
    startDate: seasonStartDateInput.value,
    endDate: seasonEndDateInput.value || null,
    isActive: seasonIsActiveInput.checked,
    baseEloMode: seasonBaseEloSelect.value as CreateSeasonPayload["baseEloMode"],
    participantIds: dashboardState.editingSeasonParticipantIds,
    isPublic: seasonIsPublicInput.checked,
  });

  const loadLeaderboard = async (): Promise<void> => {
    if (dashboardState.segmentMode === "global") {
      const data = await runAuthedAction("getLeaderboard", {});
      dashboardState.leaderboard = data.leaderboard;
      dashboardState.leaderboardUpdatedAt = data.updatedAt;
      dashboardState.leaderboardStats = null;
      markLeaderboardDirty();
      return;
    }

    if (dashboardState.segmentMode === "season") {
      if (!dashboardState.selectedSeasonId) {
      dashboardState.leaderboard = [];
      dashboardState.leaderboardUpdatedAt = "";
      dashboardState.leaderboardStats = null;
      markLeaderboardDirty();
      return;
      }

      const data = await runAuthedAction("getSegmentLeaderboard", {
        segmentType: "season",
        segmentId: dashboardState.selectedSeasonId,
      });
      dashboardState.leaderboard = data.leaderboard;
      dashboardState.leaderboardUpdatedAt = data.updatedAt;
      dashboardState.leaderboardStats = data.stats;
      markLeaderboardDirty();
      return;
    }

    if (!dashboardState.selectedTournamentId) {
      dashboardState.leaderboard = [];
      dashboardState.leaderboardUpdatedAt = "";
      dashboardState.leaderboardStats = null;
      markLeaderboardDirty();
      return;
    }

    const data = await runAuthedAction("getSegmentLeaderboard", {
      segmentType: "tournament",
      segmentId: dashboardState.selectedTournamentId,
    });
    dashboardState.leaderboard = data.leaderboard;
    dashboardState.leaderboardUpdatedAt = data.updatedAt;
    dashboardState.leaderboardStats = data.stats;
    markLeaderboardDirty();
  };

  const loadDashboard = async (): Promise<void> => {
    dashboardState.loading = true;
    dashboardState.error = "";
    setGlobalLoading(true, "Loading dashboard...");
    syncDashboardState();

    try {
      const data: GetDashboardData = await runAuthedAction("getDashboard", {
        matchesLimit: getMatchLimitForFilter(dashboardState.matchesFilter),
        matchesFilter: dashboardState.matchesFilter,
      });

      dashboardState.seasons = data.seasons;
      dashboardState.tournaments = data.tournaments;
      dashboardState.selectedSeasonId =
        dashboardState.selectedSeasonId || data.seasons.find((season) => season.isActive)?.id || data.seasons[0]?.id || "";
      dashboardState.selectedTournamentId =
        dashboardState.selectedTournamentId || data.tournaments[0]?.id || "";
      dashboardState.players = data.leaderboard;
      dashboardState.leaderboard = data.leaderboard;
      dashboardState.leaderboardUpdatedAt = data.leaderboardUpdatedAt;
      markLeaderboardDirty();
      dashboardState.userProgress = data.userProgress;
      dashboardState.matches = data.matches;
      dashboardState.matchesCursor = data.nextCursor;
      dashboardState.matchBracketContextByMatchId = data.matchBracketContextByMatchId;

      populateSeasonOptions();
      populateSeasonManagerLoadOptions();
      populateTournamentOptions();
      populateTournamentPlannerLoadOptions();
      populateMatchFormOptions();
      renderSeasonEditor();
      renderTournamentPlanner();

      if (dashboardState.segmentMode !== "global") {
        await loadLeaderboard();
      }
    } catch (error) {
      dashboardState.error = error instanceof Error ? error.message : "Failed to load dashboard data.";
    } finally {
      dashboardState.loading = false;
      setGlobalLoading(false);
      syncDashboardState();
    }
  };

  const initAuthenticatedDashboard = async (): Promise<void> => {
    await tryRedeemPendingShareToken();
    await loadDashboard();
  };

  async function loadMatches(options: { reset?: boolean; filter?: MatchFeedFilter } = {}): Promise<void> {
    const filter = options.filter ?? dashboardState.matchesFilter;
    const limit = getMatchLimitForFilter(filter);
    const cursor = options.reset ? undefined : dashboardState.matchesCursor ?? undefined;

    dashboardState.matchesLoading = true;
    syncDashboardState();

    try {
      const data: GetMatchesData = await runAuthedAction("getMatches", {
        filter,
        limit,
        cursor,
      });
      const bracketContext = Object.fromEntries(
        data.matches
          .filter((match) => Boolean(match.bracketContext))
          .map((match) => [match.id, match.bracketContext as MatchBracketContext]),
      );

      dashboardState.matches = options.reset ? data.matches : [...dashboardState.matches, ...data.matches];
      dashboardState.matchesCursor = data.nextCursor;
      dashboardState.matchBracketContextByMatchId = options.reset
        ? bracketContext
        : {
            ...dashboardState.matchBracketContextByMatchId,
            ...bracketContext,
          };
      dashboardState.matchesFilter = filter;
    } catch (error) {
      dashboardState.error = error instanceof Error ? error.message : "Failed to load matches.";
    } finally {
      dashboardState.matchesLoading = false;
      syncDashboardState();
    }
  }

  async function applyMatchFilter(filter: MatchFeedFilter): Promise<void> {
    if (dashboardState.matchesFilter === filter && dashboardState.matches.length > 0 && !dashboardState.matchesLoading) {
      return;
    }

    dashboardState.matchesFilter = filter;
    dashboardState.matches = [];
    dashboardState.matchesCursor = null;
    dashboardState.matchBracketContextByMatchId = {};
    await loadMatches({ reset: true, filter });
  }

  const loadMoreMatches = async (): Promise<void> => {
    if (!dashboardState.matchesCursor) {
      return;
    }

    await loadMatches({ reset: false });
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
      setGlobalLoading(true, "Saving match...");
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
      resetScoreInputs();
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
      setGlobalLoading(false);
      syncDashboardState();
    }
  };

  const resetSeasonForm = (): void => {
    dashboardState.editingSeasonId = "";
    dashboardState.editingSeasonParticipantIds = isAuthedState(state.current)
      ? [state.current.session.user.id]
      : [];
    seasonNameInput.value = "";
    seasonStartDateInput.value = getTodayDateValue();
    seasonEndDateInput.value = "";
    seasonBaseEloSelect.value = "carry_over";
    seasonIsActiveInput.checked = true;
    seasonIsPublicInput.checked = false;
    loadSeasonSelect.value = "";
    syncLoadControlsVisibility();
    setSeasonSharePanelTargetId("");
  };

  const submitSeason = async (): Promise<void> => {
    dashboardState.seasonSubmitting = true;
    dashboardState.seasonFormError = "";
    dashboardState.seasonFormMessage = "";
    syncDashboardState();

    try {
      if (!seasonNameInput.value.trim()) {
        throw new Error("Season name is required.");
      }
      if (!seasonStartDateInput.value) {
        throw new Error("Season start date is required.");
      }
      if (seasonEndDateInput.value && seasonEndDateInput.value < seasonStartDateInput.value) {
        throw new Error("Season end date cannot be earlier than the start date.");
      }
      setGlobalLoading(true, "Saving season...");
      const payload = collectSeasonPayload();
      const data = await runAuthedAction("createSeason", payload);
      dashboardState.seasonFormMessage = `${dashboardState.editingSeasonId ? "Season updated" : "Season created"} and added to the dashboard.`;
      dashboardState.selectedSeasonId = data.season.id;
      dashboardState.editingSeasonId = data.season.id;
      dashboardState.editingSeasonParticipantIds = [...payload.participantIds];
      dashboardState.screen = "createSeason";
      syncAuthState();
      setSeasonSharePanelTargetId(data.season.id);
      await loadDashboard();
      await refreshSegmentShareLink("season", data.season.id, seasonSharePanelElements);
    } catch (error) {
      dashboardState.seasonFormError =
        error instanceof Error ? error.message : "Failed to create season.";
    } finally {
      dashboardState.seasonSubmitting = false;
      setGlobalLoading(false);
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
      tournamentDateInput.value = data.tournament.date;
      tournamentSeasonSelect.value = data.tournament.seasonId || "";
      tournamentPlannerState.participantIds = data.participantIds;
      tournamentPlannerState.rounds = data.rounds.map((round) => ({
        title: round.title,
        matches: round.matches.map((match) => ({
          id: match.id,
          leftPlayerId: match.leftPlayerId,
          rightPlayerId: match.rightPlayerId,
          createdMatchId: match.createdMatchId,
          winnerPlayerId: match.winnerPlayerId,
          locked: match.locked,
          isFinal: match.isFinal,
        })),
      }));
      tournamentPlannerState.firstRoundMatches = tournamentPlannerState.rounds[0]
        ? tournamentPlannerState.rounds[0].matches
        : [];
      tournamentPlannerState.error = "";
      renderTournamentPlanner();
      syncDashboardState();
      setTournamentSharePanelTargetId(data.tournament.id);
      void refreshSegmentShareLink("tournament", data.tournament.id, tournamentSharePanelElements);
    } catch (error) {
      tournamentPlannerState.error =
        error instanceof Error ? error.message : "Failed to load tournament.";
      renderTournamentPlanner();
      syncDashboardState();
    }
  };

  const saveTournament = async (): Promise<void> => {
    dashboardState.tournamentSubmitting = true;
    dashboardState.tournamentFormMessage = "";
    syncDashboardState();
    try {
      if (tournamentPlannerState.participantIds.length < 2) {
        throw new Error("Select at least 2 participants.");
      }
      setGlobalLoading(true, "Saving tournament...");
      const payload: CreateTournamentPayload = {
        tournamentId: tournamentPlannerState.tournamentId || null,
        name: tournamentNameInput.value.trim() || "New tournament",
        date: tournamentDateInput.value || null,
        seasonId: tournamentSeasonSelect.value || null,
        participantIds: tournamentPlannerState.participantIds,
        rounds: tournamentPlannerState.rounds.map((round, roundIndex) => ({
          title: round.title,
          matches: round.matches.map((match) => ({
            id: match.id,
            leftPlayerId: match.leftPlayerId,
            rightPlayerId: match.rightPlayerId,
            createdMatchId: match.createdMatchId || null,
            winnerPlayerId: match.winnerPlayerId || null,
            locked: Boolean(match.locked),
            isFinal: Boolean(match.isFinal ?? roundIndex === tournamentPlannerState.rounds.length - 1),
          })),
        })) as TournamentBracketRound[],
      };
      const data = await runAuthedAction("createTournament", payload);
      tournamentPlannerState.tournamentId = data.tournament.id;
      tournamentPlannerState.name = data.tournament.name;
      dashboardState.tournamentFormMessage = "Tournament created";
      tournamentPlannerState.error = "";
      setTournamentSharePanelTargetId(data.tournament.id);
      await loadDashboard();
      await refreshSegmentShareLink("tournament", data.tournament.id, tournamentSharePanelElements);
      populateTournamentPlannerLoadOptions();
      loadTournamentSelect.value = data.tournament.id;
      renderTournamentPlanner();
      syncDashboardState();
    } catch (error) {
      tournamentPlannerState.error =
        error instanceof Error ? error.message : "Failed to save tournament.";
      renderTournamentPlanner();
      syncDashboardState();
    } finally {
      dashboardState.tournamentSubmitting = false;
      setGlobalLoading(false);
    }
  };

  const deleteMatch = async (match: MatchRecord): Promise<void> => {
    const confirmed = await promptDeleteWarning({
      context: "match",
      detail: () => {
        const contextLabel = renderMatchContext(
          match,
          dashboardState.seasons,
          dashboardState.tournaments,
          dashboardState.matchBracketContextByMatchId[match.id] ?? null,
        );
        const playedAtLabel = formatDateTime(match.playedAt);
        const scoreLabel = match.score.length > 0 ? renderMatchScore(match) : "";
        const detailParts = [scoreLabel, contextLabel, playedAtLabel].filter(Boolean);
        return detailParts.join(" • ");
      },
    });

    if (!confirmed) {
      return;
    }

    try {
      setGlobalLoading(true, "Deleting match and recalculating rankings...");
      const data: DeactivateEntityData = await runAuthedAction("deactivateMatch", {
        id: match.id,
        reason: "Deleted from the web app",
      });
      dashboardState.matchFormMessage = data.status === "deleted"
        ? "Match deleted and rankings recalculated."
        : "";
      await loadDashboard();
    } catch (error) {
      dashboardState.error = error instanceof Error ? error.message : "Could not delete match.";
      syncDashboardState();
    } finally {
      setGlobalLoading(false);
    }
  };

  const deleteTournament = async (): Promise<void> => {
    const tournament = getEditingTournament();
    if (!tournament) {
      return;
    }

    const confirmed = await promptDeleteWarning({
      context: "tournament",
      detail: () => {
        const dateLabel = tournament.date ? formatDate(tournament.date) : "";
        const detailParts = [tournament.name, dateLabel].filter(Boolean);
        return detailParts.join(" • ");
      },
    });

    if (!confirmed) {
      return;
    }

    try {
      setGlobalLoading(true, "Deleting tournament and recalculating rankings...");
      const data: DeactivateEntityData = await runAuthedAction("deactivateTournament", {
        id: tournament.id,
        reason: "Deleted from the web app",
      });
      dashboardState.tournamentFormMessage = data.status === "deleted"
        ? "Tournament deleted and rankings recalculated."
        : "";
      dashboardState.screen = "dashboard";
      tournamentPlannerState.tournamentId = "";
      setTournamentSharePanelTargetId("");
      tournamentPlannerState.rounds = [];
      tournamentPlannerState.firstRoundMatches = [];
      await loadDashboard();
    } catch (error) {
      tournamentPlannerState.error = error instanceof Error ? error.message : "Could not delete tournament.";
      syncDashboardState();
    } finally {
      setGlobalLoading(false);
    }
  };

  const deleteSeason = async (): Promise<void> => {
    const season = getEditingSeason();
    if (!season) {
      return;
    }

    const confirmed = await promptDeleteWarning({
      context: "season",
      detail: () => {
        const rangeParts: string[] = [];
        if (season.startDate) {
          rangeParts.push(formatDate(season.startDate));
        }
        if (season.endDate) {
          rangeParts.push(formatDate(season.endDate));
        }
        const rangeLabel = rangeParts.join(" – ");
        return rangeLabel ? `${season.name} • ${rangeLabel}` : season.name;
      },
      confirmationValue: season.name,
    });

    if (!confirmed) {
      return;
    }

    try {
      setGlobalLoading(true, "Deleting season and recalculating rankings...");
      const data: DeactivateEntityData = await runAuthedAction("deactivateSeason", {
        id: season.id,
        reason: "Deleted from the web app",
      });
      dashboardState.seasonFormMessage = data.status === "deleted"
        ? "Season deleted and rankings recalculated."
        : "";
      dashboardState.screen = "dashboard";
      resetSeasonForm();
      await loadDashboard();
    } catch (error) {
      dashboardState.seasonFormError = error instanceof Error ? error.message : "Could not delete season.";
      syncDashboardState();
    } finally {
      setGlobalLoading(false);
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
    resetScoreInputs();
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
      await initAuthenticatedDashboard();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      state.current = { status: "error", message };
    }

    syncAuthState();
  };

  logoutButton.addEventListener("click", () => {
    authMenuOpen = false;
    clearSession();
    setIdleState();
  });

  faqMenuButton.addEventListener("click", () => {
    openFaqScreen();
  });

  footerFaqButton.addEventListener("click", () => {
    openFaqScreen();
  });

  footerPrivacyButton.addEventListener("click", () => {
    openPrivacyScreen();
  });

  authMenuButton.addEventListener("click", () => {
    createMenuOpen = false;
    authMenuOpen = !authMenuOpen;
    syncAuthState();
  });

  createMenuButton.addEventListener("click", () => {
    authMenuOpen = false;
    createMenuOpen = !createMenuOpen;
    syncAuthState();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (languageMenuOpen && target instanceof Node && !languageSwitch.contains(target)) {
      languageMenuOpen = false;
      updateLanguageMenuState();
    }

    if (!authMenuOpen && !createMenuOpen) {
      return;
    }
    if (
      !(target instanceof Node) ||
      authActions.contains(target) ||
      createMenuButton.contains(target) ||
      createMenu.contains(target)
    ) {
      return;
    }

    authMenuOpen = false;
    createMenuOpen = false;
    syncAuthState();
  });

  refreshButton.addEventListener("click", () => {
    void loadDashboard();
  });

  openCreateMatchButton.addEventListener("click", () => {
    createMenuOpen = false;
    resetScoreInputs();
    dashboardState.screen = "createMatch";
    syncAuthState();
    syncDashboardState();
  });

  openCreateTournamentButton.addEventListener("click", () => {
    createMenuOpen = false;
    dashboardState.screen = "createTournament";
    tournamentPlannerState.error = "";
    dashboardState.tournamentFormMessage = "";
    populateTournamentPlannerLoadOptions();
    renderTournamentPlanner();
    syncAuthState();
    syncDashboardState();
  });

  openCreateSeasonButton.addEventListener("click", () => {
    createMenuOpen = false;
    dashboardState.screen = "createSeason";
    dashboardState.seasonFormError = "";
    dashboardState.seasonFormMessage = "";
    resetSeasonForm();
    populateSeasonManagerLoadOptions();
    renderSeasonEditor();
    syncAuthState();
    syncDashboardState();
  });

  openScoreCardButton.addEventListener("click", () => {
    createMenuOpen = false;
    showScoreCard();
    syncAuthState();
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

  closeCreateSeasonButton.addEventListener("click", () => {
    dashboardState.screen = "dashboard";
    syncAuthState();
    syncDashboardState();
  });

  faqBackButton.addEventListener("click", () => {
    closeFaqScreen();
  });

  privacyBackButton.addEventListener("click", () => {
    closePrivacyScreen();
  });

  closeScoreCardButton.addEventListener("click", () => {
    hideScoreCard();
  });

  resetScoreCardButton.addEventListener("click", () => {
    resetScoreCard();
  });

  scoreCardOverlay.addEventListener("click", (event) => {
    if (event.target === scoreCardOverlay) {
      hideScoreCard();
    }
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
    renderTournamentDraftSummary();
    syncLoadControlsVisibility();
    syncDashboardState();
  });

  loadSeasonSelect.addEventListener("change", () => {
    dashboardState.editingSeasonId = loadSeasonSelect.value;
    syncLoadControlsVisibility();
    syncDashboardState();
  });

  loadSeasonButton.addEventListener("click", () => {
    const season = dashboardState.seasons.find((entry) => entry.id === loadSeasonSelect.value);
    if (!season) {
      dashboardState.seasonFormError = "Select a saved season first.";
      dashboardState.seasonFormMessage = "";
      syncDashboardState();
      return;
    }

    dashboardState.editingSeasonId = season.id;
    dashboardState.editingSeasonParticipantIds = [...season.participantIds];
    seasonNameInput.value = season.name;
    seasonStartDateInput.value = season.startDate;
    seasonEndDateInput.value = season.endDate || "";
    seasonBaseEloSelect.value = season.baseEloMode;
    seasonIsActiveInput.checked = season.isActive;
    seasonIsPublicInput.checked = season.isPublic;
    dashboardState.seasonFormError = "";
    dashboardState.seasonFormMessage = "";
    renderSeasonEditor();
    syncDashboardState();
    setSeasonSharePanelTargetId(season.id);
    void refreshSegmentShareLink("season", season.id, seasonSharePanelElements);
  });

  tournamentNameInput.addEventListener("input", () => {
    tournamentPlannerState.name = tournamentNameInput.value;
    renderTournamentDraftSummary();
  });

  saveTournamentButton.addEventListener("click", () => {
    void saveTournament();
  });

  deleteTournamentButton.addEventListener("click", () => {
    void deleteTournament();
  });

  deleteSeasonButton.addEventListener("click", () => {
    void deleteSeason();
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
    formTournamentSelect,
    winnerTeamSelect,
    pointsToWinSelect,
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

  seasonForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitSeason();
  });

  [seasonNameInput, seasonStartDateInput, seasonEndDateInput, seasonBaseEloSelect, seasonIsActiveInput, seasonIsPublicInput].forEach(
    (input) => {
      input.addEventListener("change", () => {
        renderSeasonDraftSummary();
        syncDashboardState();
      });
    },
  );

  [tournamentNameInput, tournamentDateInput, tournamentSeasonSelect].forEach((input) => {
    input.addEventListener("change", () => {
      renderTournamentDraftSummary();
      syncDashboardState();
    });
  });

  scoreInputs.forEach((game) => {
    game.teamA.addEventListener("input", () => {
      renderMatchDraftSummary();
    });
    game.teamB.addEventListener("input", () => {
      renderMatchDraftSummary();
    });
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

  leaderboardHeading.append(leaderboardTitle);
  segmentToggle.append(globalButton, seasonButton, tournamentButton);
  leaderboardTop.append(leaderboardHeading, segmentToggle);
  leaderboardPanel.append(
    leaderboardTop,
    seasonSelect,
    tournamentSelect,
    leaderboardList,
    leaderboardStatsGroup,
  );

  matchesHeading.append(matchesTitle, matchesMeta);
  matchesTop.append(matchesHeading, matchFiltersRow);
  matchesPanel.append(matchesTop, matchesList, loadMoreButton);
  progressPanel.append(progressHeader, progressSummary, progressBody);

  composerHeading.append(composerTitle, composerMeta);
  composerTop.append(composerHeading, closeCreateMatchButton);

  const buildField = (labelKey: TextKey, input: HTMLElement): HTMLLabelElement => {
    const label = document.createElement("label");
    label.className = "form-field";
    const copy = document.createElement("span");
    copy.className = "field-label";
    bindLocalizedText(copy, labelKey);
    label.append(copy, input);
    return label;
  };

  const createPanelSection = (titleKey: TextKey, ...children: HTMLElement[]): HTMLElement => {
    const section = document.createElement("section");
    section.className = "panel-section";
    const heading = document.createElement("h4");
    heading.className = "card-title";
    bindLocalizedText(heading, titleKey);
    section.append(heading, ...children);
    return section;
  };

  const buildSharePanel = (
    segmentType: SegmentType,
    targetGetter: () => string,
  ): SharePanelElements => {
    const section = document.createElement("section");
    section.className = "panel-section share-panel";

    const heading = document.createElement("h4");
    heading.className = "card-title";
    const titleSegmentKey =
      segmentType === "season" ? "shareSegmentTypeSeason" : "shareSegmentTypeTournament";
    heading.textContent = t("shareInviteTitle").replace("{segment}", t(titleSegmentKey));

    const controls = document.createElement("div");
    controls.className = "share-panel__controls";

    const buttonRow = document.createElement("div");
    buttonRow.className = "share-panel__button-row";
    const createButton = document.createElement("button");
    createButton.type = "button";
    createButton.className = "primary-button share-panel__create-button";
    bindLocalizedText(createButton, "shareCreateLink");
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "secondary-button share-panel__copy-button";
    bindLocalizedText(copyButton, "shareCopyLink");
    buttonRow.append(createButton, copyButton);

    const buttonStack = document.createElement("div");
    buttonStack.className = "share-panel__button-stack";
    const copyFeedback = document.createElement("span");
    copyFeedback.className = "share-panel__copy-feedback";
    buttonStack.append(buttonRow, copyFeedback);

    const qrWrapper = document.createElement("div");
    qrWrapper.className = "share-panel__qr";
    const qrCanvas = document.createElement("canvas");
    qrCanvas.className = "share-panel__qr-canvas";
    qrWrapper.append(qrCanvas);
    qrWrapper.hidden = true;

    controls.append(buttonStack, qrWrapper);

    const status = document.createElement("p");
    status.className = "form-status share-panel__status";
    status.dataset.status = "ready";

    section.append(heading, controls, status);

    const elements: SharePanelElements = {
      section,
      createButton,
      copyButton,
      status,
      qrCanvas,
      qrWrapper,
      copyFeedback,
      animationTimer: null,
    };

    copyButton.addEventListener("click", async () => {
      const targetId = targetGetter();
      const key = buildSegmentShareKey(segmentType, targetId);
      const shareInfo = targetId ? dashboardState.shareCache[key] : null;
      if (!shareInfo?.url) {
        showShareNotice(t("shareNoSegment"));
        return;
      }
      try {
        await copyTextToClipboard(shareInfo.url);
        showCopyFeedback(segmentType === "season" ? "season" : "tournament", copyFeedback, t("shareCopied"));
      } catch {
        showShareNotice(t("shareCopyFailure"));
      }
    });

    createButton.addEventListener("click", () => {
      const targetId = targetGetter();
      if (!targetId) {
        showShareNotice(t("shareNoSegment"));
        return;
      }
      void refreshSegmentShareLink(segmentType, targetId, elements);
    });

    return elements;
  };

  const teamGrid = document.createElement("div");
  teamGrid.className = "team-grid";
  const teamA1Field = buildField("teamAPlayer1", teamA1Select);
  const teamA2Field = buildField("teamAPlayer2", teamA2Select);
  const teamB1Field = buildField("teamBPlayer1", teamB1Select);
  const teamB2Field = buildField("teamBPlayer2", teamB2Select);
  teamGrid.append(
    teamA1Field,
    teamA2Field,
    teamB1Field,
    teamB2Field,
  );

  scoreInputs.forEach((game, index) => {
    const gameBlock = document.createElement("div");
    gameBlock.className = "score-game-block";

    const gameLabel = document.createElement("span");
    gameLabel.className = "score-game-heading";
    gameLabel.textContent = `Game ${index + 1}`;

    const row = document.createElement("div");
    row.className = "score-row";

    const separator = document.createElement("span");
    separator.className = "score-separator";
    separator.textContent = "-";

    const teamACell = document.createElement("div");
    teamACell.className = "score-input-cell score-input-cell--left";
    game.teamALabel.className = "score-input-label";
    teamACell.append(game.teamALabel, game.teamA);

    const teamBCell = document.createElement("div");
    teamBCell.className = "score-input-cell score-input-cell--right";
    game.teamBLabel.className = "score-input-label";
    teamBCell.append(game.teamBLabel, game.teamB);

    row.append(teamACell, separator, teamBCell);
    gameBlock.append(gameLabel, row);
    scoreGrid.append(gameBlock);
  });

  scoreSection.append(scoreLabel, scoreGrid);

  const matchContextSection = document.createElement("section");
  matchContextSection.className = "panel-section";
  matchContextSection.append(buildField("matchFieldSeason", formSeasonSelect), buildField("matchFieldTournament", formTournamentSelect));

  const matchRulesSection = document.createElement("section");
  matchRulesSection.className = "panel-section";
  matchRulesSection.append(
    buildField("matchFieldMatchType", matchTypeSelect),
    buildField("matchFieldFormat", formatTypeSelect),
    buildField("matchFieldPoints", pointsToWinSelect),
  );

  const matchPlayersSection = document.createElement("section");
  matchPlayersSection.className = "panel-section";
  matchPlayersSection.append(teamGrid, suggestMatchButton);

  const matchReviewSection = document.createElement("section");
  matchReviewSection.className = "panel-section";
  matchReviewSection.append(buildField("matchFieldWinner", winnerTeamSelect), scoreSection);

  const matchActions = document.createElement("div");
  matchActions.className = "form-actions";
  matchActions.append(submitMatchButton);

  const matchActionsWrapper = document.createElement("div");
  matchActionsWrapper.className = "form-actions-wrapper";
  matchActionsWrapper.append(matchActions, composerStatus);

  matchForm.append(matchContextSection, matchRulesSection, matchPlayersSection, matchReviewSection, matchActionsWrapper);

  composerPanel.append(composerTop, matchQuickBar, matchForm);

  welcomeTitleRow.append(welcomeTitle, refreshButton);
  welcomeBlock.append(welcomeTitleRow, welcomeText);
  dashboardHeader.append(welcomeBlock);
  viewGrid.append(leaderboardPanel, matchesPanel);
  dashboard.append(dashboardHeader, progressPanel, dashboardStatus, viewGrid);
  createMatchScreen.append(composerPanel);

  tournamentHeading.append(tournamentTitle, tournamentMeta);
  tournamentTop.append(tournamentHeading, closeCreateTournamentButton);
  participantSection.append(
    participantLabel,
    tournamentSelectAllParticipantsField,
    participantList,
  );
  const tournamentActions = document.createElement("div");
  tournamentActions.className = "form-actions";
  tournamentActions.append(suggestTournamentButton, saveTournamentButton, deleteTournamentButton);
  const tournamentActionsWrapper = document.createElement("div");
  tournamentActionsWrapper.className = "form-actions-wrapper";
  tournamentActionsWrapper.append(tournamentActions, tournamentStatus);
  const tournamentDetailsSection = createPanelSection(
    "tournamentDetails",
    buildField("loadSavedTournament", loadTournamentSelect),
    tournamentLoadActions,
    buildField("tournamentSeasonLabel", tournamentSeasonSelect),
    buildField("tournamentName", tournamentNameInput),
    buildField("tournamentDate", tournamentDateInput),
  );
  const tournamentParticipantsSection = createPanelSection("participants", participantSection);
  const tournamentBracketSection = createPanelSection("bracketPreviewSection", bracketBoard);

  const seasonSharePanelInstance = buildSharePanel("season", getSeasonShareTargetId);
  seasonSharePanelElements = seasonSharePanelInstance;

  const tournamentSharePanelInstance = buildSharePanel("tournament", getTournamentShareTargetId);
  tournamentSharePanelElements = tournamentSharePanelInstance;

  tournamentPanel.append(
    tournamentTop,
    tournamentQuickBar,
    tournamentDetailsSection,
    tournamentParticipantsSection,
    tournamentActionsWrapper,
    tournamentBracketSection,
  );
  createTournamentScreen.append(tournamentPanel);

  replaceOptions(
    seasonBaseEloSelect,
    [
      { value: "carry_over", label: t("carryOverElo") },
      { value: "reset_1200", label: t("resetElo") },
    ],
    "carry_over",
    t("carryOverElo"),
  );

  const seasonActiveField = document.createElement("label");
  seasonActiveField.className = "checkbox-field";
  const seasonActiveCopy = document.createElement("span");
  seasonActiveCopy.className = "field-label";
  bindLocalizedText(seasonActiveCopy, "seasonActiveLabel");
  seasonActiveField.append(seasonIsActiveInput, seasonActiveCopy);

  const seasonPublicField = document.createElement("label");
  seasonPublicField.className = "checkbox-field";
  const seasonPublicCopy = document.createElement("span");
  seasonPublicCopy.className = "field-label";
  bindLocalizedText(seasonPublicCopy, "seasonPublicLabel");
  seasonPublicField.append(seasonIsPublicInput, seasonPublicCopy);
  seasonParticipantSection.append(
    seasonParticipantLabel,
    seasonSelectAllParticipantsField,
    seasonParticipantList,
  );

  seasonHeading.append(seasonTitle, seasonMeta);
  seasonTop.append(seasonHeading, closeCreateSeasonButton);
  const seasonActions = document.createElement("div");
  seasonActions.className = "form-actions";
  seasonActions.append(submitSeasonButton, deleteSeasonButton);
  const seasonActionsWrapper = document.createElement("div");
  seasonActionsWrapper.className = "form-actions-wrapper";
  seasonActionsWrapper.append(seasonActions, seasonStatus);

  const seasonDetailsSection = createPanelSection(
    "seasonDetails",
    buildField("loadSavedSeason", loadSeasonSelect),
    seasonLoadActions,
    buildField("seasonName", seasonNameInput),
    buildField("seasonStartDate", seasonStartDateInput),
    buildField("seasonEndDate", seasonEndDateInput),
  );

  const seasonParticipantsSection = createPanelSection("participants", seasonParticipantSection);

  const seasonRulesSection = createPanelSection(
    "rankingRules",
    buildField("baseElo", seasonBaseEloSelect),
    seasonActiveField,
    seasonPublicField,
  );

  seasonForm.append(
    seasonDetailsSection,
    seasonParticipantsSection,
    seasonRulesSection,
    seasonActionsWrapper,
  );
  seasonPanel.append(seasonTop, seasonQuickBar, seasonForm);
  createSeasonScreen.append(seasonPanel);

  function updateSeasonSharePanelVisibility(): void {
    if (!seasonSharePanelElements) {
      return;
    }
    const hasSegment = Boolean(dashboardState.sharePanelSeasonTargetId);
    if (hasSegment && !seasonSharePanelMounted) {
      seasonForm.insertBefore(seasonSharePanelElements.section, seasonActionsWrapper);
      seasonSharePanelMounted = true;
    } else if (!hasSegment && seasonSharePanelMounted) {
      seasonForm.removeChild(seasonSharePanelElements.section);
      seasonSharePanelMounted = false;
    }
  }

  function updateTournamentSharePanelVisibility(): void {
    if (!tournamentSharePanelElements) {
      return;
    }
    const hasSegment = Boolean(dashboardState.sharePanelTournamentTargetId);
    if (hasSegment && !tournamentSharePanelMounted) {
      tournamentPanel.insertBefore(tournamentSharePanelElements.section, tournamentActionsWrapper);
      tournamentSharePanelMounted = true;
    } else if (!hasSegment && tournamentSharePanelMounted) {
      tournamentPanel.removeChild(tournamentSharePanelElements.section);
      tournamentSharePanelMounted = false;
    }
  }

  header.append(brandMark, providerStack);
  card.append(
    header,
    shareAlert,
    loginView,
    dashboard,
    createMatchScreen,
    createTournamentScreen,
    createSeasonScreen,
    faqScreen,
    privacyScreen,
    footer,
  );
  container.append(card, scoreCardOverlay, deleteWarningOverlay, loadingOverlay);

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
    void initAuthenticatedDashboard();
  }

  return container;
};
  const createProgressSummaryItem = (text: string): HTMLSpanElement => {
    const item = document.createElement("span");
    item.className = "progress-summary__item";
    item.textContent = text;
    return item;
  };
