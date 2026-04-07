export type AchievementBuildInput = {
  id: string;
  created_at: string;
  wins?: number | null;
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
