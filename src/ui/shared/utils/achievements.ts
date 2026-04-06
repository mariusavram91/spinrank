import type { AchievementOverview } from "../../../api/contract";

const STORAGE_KEY = "spinrank.seen-achievements";

function getUnlockedTokens(overview: AchievementOverview | null): string[] {
  if (!overview) {
    return [];
  }
  const unlockedItems = overview.items.filter((item) => item.unlockedAt);
  return [...new Set(unlockedItems.map((item) => `${item.key}:${item.unlockedAt}`))];
}

function getUnreadUnlockedTokens(overview: AchievementOverview | null): string[] {
  const seen = new Set(loadSeenTokens());
  return getUnlockedTokens(overview).filter((token) => !seen.has(token));
}

function loadSeenTokens(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function saveSeenTokens(tokens: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Ignore storage failures; the notification dot is best-effort only.
  }
}

export function hasUnreadAchievements(overview: AchievementOverview | null): boolean {
  return getUnreadUnlockedTokens(overview).length > 0;
}

export function getUnreadAchievementKeys(overview: AchievementOverview | null): string[] {
  if (!overview) {
    return [];
  }

  const unreadTokens = new Set(getUnreadUnlockedTokens(overview));
  return overview.items
    .filter((item) => item.unlockedAt && unreadTokens.has(`${item.key}:${item.unlockedAt}`))
    .map((item) => item.key);
}

export function markAchievementsAsSeen(overview: AchievementOverview | null): void {
  const unlockedTokens = getUnlockedTokens(overview);
  if (unlockedTokens.length === 0) {
    return;
  }

  const next = new Set(loadSeenTokens());
  unlockedTokens.forEach((token) => next.add(token));
  saveSeenTokens([...next]);
}
