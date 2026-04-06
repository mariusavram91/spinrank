export const ACHIEVEMENTS = [
  { key: "account_created", category: "onboarding", tier: "bronze", points: 10, sortOrder: 10, icon: "spark" },
  { key: "first_match", category: "onboarding", tier: "bronze", points: 20, sortOrder: 20, icon: "paddle" },
  { key: "first_win", category: "performance", tier: "bronze", points: 30, sortOrder: 30, icon: "trophy" },
  { key: "matches_10", category: "activity", tier: "silver", points: 50, sortOrder: 40, icon: "steps" },
  { key: "matches_25", category: "activity", tier: "gold", points: 100, sortOrder: 50, icon: "crown" },
  { key: "win_streak_3", category: "performance", tier: "silver", points: 60, sortOrder: 60, icon: "bolt" },
  { key: "win_streak_5", category: "performance", tier: "gold", points: 120, sortOrder: 70, icon: "flame" },
  { key: "rank_top_3", category: "performance", tier: "gold", points: 120, sortOrder: 80, icon: "podium" },
  { key: "rank_1", category: "performance", tier: "platinum", points: 200, sortOrder: 90, icon: "medal" },
  { key: "season_creator", category: "community", tier: "silver", points: 70, sortOrder: 100, icon: "calendar" },
  { key: "tournament_creator", category: "community", tier: "silver", points: 80, sortOrder: 110, icon: "bracket" },
] as const;

export type AchievementDefinition = (typeof ACHIEVEMENTS)[number];
export type AchievementKey = AchievementDefinition["key"];
