import type { AchievementOverview } from "../../../src/api/contract";

export const createAchievementOverview = (): AchievementOverview => ({
  totalUnlocked: 0,
  totalAvailable: 0,
  score: 0,
  items: [],
  recentUnlocks: [],
  featured: [],
  nextUp: null,
});
