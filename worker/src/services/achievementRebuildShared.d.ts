export type AchievementBuildInput = {
  id: string;
  created_at: string;
  wins?: number | null;
  losses?: number | null;
  streak?: number | null;
  rank?: number | null;
  global_elo?: number | null;
  matches_played?: number | null;
};

export type AchievementBuildData = {
  seasonsCreated: Map<string, number>;
  tournamentsCreated: Map<string, number>;
  seasonsPlayed: Map<string, number>;
  tournamentsPlayed: Map<string, number>;
  singlesCount: Map<string, number>;
  doublesCount: Map<string, number>;
  perfect11Count: Map<string, number>;
  perfect21Count: Map<string, number>;
  blowout11Count: Map<string, number>;
  blowout21Count: Map<string, number>;
  marathonMatchCount?: Map<string, number>;
  luckyNumbersCount?: Map<string, number>;
  mirrorMatchCount?: Map<string, number>;
  stylePointsCount?: Map<string, number>;
  squadPartnerCount?: Map<string, number>;
  rivalMatchesMax?: Map<string, number>;
  unbeatenRunMax?: Map<string, number>;
  weeklyMatchStreak?: Map<string, number>;
  comebackWinsCount?: Map<string, number>;
  deuceWinsCount?: Map<string, number>;
  decidingSetWinsCount?: Map<string, number>;
  clutchComebackCount?: Map<string, number>;
  upsetVictoryCount?: Map<string, number>;
  seasonWinnerCount: Map<string, number>;
  seasonPodiumCount: Map<string, number>;
  spring2026ChampionCount?: Map<string, number>;
  spring2026Top3Count?: Map<string, number>;
  tournamentWinnerCount: Map<string, number>;
  tournamentFinalCount: Map<string, number>;
  rankDynastyCount?: Map<string, number>;
  topTenDefenderCount?: Map<string, number>;
  completionist25Count?: Map<string, number>;
  completionist50Count?: Map<string, number>;
  completionist75Count?: Map<string, number>;
  allRounderCount?: Map<string, number>;
};

export type AchievementBuildResult = {
  key: string;
  progressValue: number;
  progressTarget: number | null;
  unlock: boolean;
  context: Record<string, unknown>;
  nowIso: string;
};

export function buildAchievementState(
  user: AchievementBuildInput,
  nowIso: string,
  maps: AchievementBuildData,
): AchievementBuildResult[];
