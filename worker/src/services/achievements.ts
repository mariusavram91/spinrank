import type { AchievementOverview, AchievementSummaryItem, Env } from "../types";
import { ACHIEVEMENTS, type AchievementDefinition } from "./achievementCatalog";

export type AchievementTrigger =
  | { type: "bootstrap"; userId: string; nowIso: string }
  | { type: "match_created"; userIds: string[]; actorUserId: string; matchId: string; nowIso: string }
  | { type: "season_created"; actorUserId: string; seasonId: string; nowIso: string }
  | { type: "tournament_created"; actorUserId: string; tournamentId: string; nowIso: string }
  | { type: "rankings_recomputed"; userIds: string[]; nowIso: string };

type AchievementRow = {
  key: AchievementDefinition["key"];
  category: AchievementDefinition["category"];
  tier: AchievementDefinition["tier"];
  icon: AchievementDefinition["icon"];
  points: number;
  sort_order: number;
  unlocked_at: string | null;
  progress_value: number | null;
  progress_target: number | null;
};

const buildTitleKey = (key: string): string => `achievement.${key}.title`;
const buildDescriptionKey = (key: string): string => `achievement.${key}.description`;

function mapAchievementRow(row: AchievementRow): AchievementSummaryItem {
  return {
    key: row.key,
    category: row.category,
    tier: row.tier,
    icon: row.icon,
    unlockedAt: row.unlocked_at,
    progressValue: Number(row.progress_value ?? 0),
    progressTarget: row.progress_target === null ? null : Number(row.progress_target),
    titleKey: buildTitleKey(row.key),
    descriptionKey: buildDescriptionKey(row.key),
    points: Number(row.points),
  };
}

async function ensureAchievementCatalog(env: Env): Promise<void> {
  await env.DB.batch(
    ACHIEVEMENTS.map((achievement) =>
      env.DB.prepare(
        `
          INSERT INTO achievement_definitions (key, category, tier, points, sort_order, active)
          VALUES (?1, ?2, ?3, ?4, ?5, 1)
          ON CONFLICT(key) DO UPDATE SET
            category = excluded.category,
            tier = excluded.tier,
            points = excluded.points,
            sort_order = excluded.sort_order,
            active = 1
        `,
      ).bind(
        achievement.key,
        achievement.category,
        achievement.tier,
        achievement.points,
        achievement.sortOrder,
      ),
    ),
  );
}

async function upsertAchievementProgress(args: {
  env: Env;
  userId: string;
  achievementKey: string;
  progressValue: number;
  progressTarget?: number | null;
  nowIso: string;
  unlock?: boolean;
  context?: Record<string, unknown>;
}): Promise<void> {
  await args.env.DB.prepare(
    `
      INSERT INTO user_achievements (
        user_id, achievement_key, unlocked_at, progress_value, progress_target, last_evaluated_at, context_json
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(user_id, achievement_key) DO UPDATE SET
        progress_value = MAX(user_achievements.progress_value, excluded.progress_value),
        progress_target = COALESCE(user_achievements.progress_target, excluded.progress_target),
        unlocked_at = COALESCE(user_achievements.unlocked_at, excluded.unlocked_at),
        last_evaluated_at = excluded.last_evaluated_at,
        context_json = CASE
          WHEN user_achievements.unlocked_at IS NULL AND excluded.unlocked_at IS NOT NULL THEN excluded.context_json
          ELSE user_achievements.context_json
        END
    `,
  )
    .bind(
      args.userId,
      args.achievementKey,
      args.unlock ? args.nowIso : null,
      args.progressValue,
      args.progressTarget ?? null,
      args.nowIso,
      JSON.stringify(args.context ?? {}),
    )
    .run();
}

async function loadUserMatchStats(
  env: Env,
  userIds: string[],
): Promise<Array<{ id: string; wins: number; losses: number; streak: number; matches_played: number }>> {
  if (userIds.length === 0) {
    return [];
  }
  const placeholders = userIds.map((_, index) => `?${index + 1}`).join(",");
  const rows = await env.DB.prepare(
    `
      SELECT id, wins, losses, streak, (wins + losses) AS matches_played
      FROM users
      WHERE id IN (${placeholders})
    `,
  )
    .bind(...userIds)
    .all<{ id: string; wins: number; losses: number; streak: number; matches_played: number }>();

  return rows.results;
}

async function loadUserRanks(env: Env, userIds: string[]): Promise<Array<{ id: string; rank: number }>> {
  if (userIds.length === 0) {
    return [];
  }
  const placeholders = userIds.map((_, index) => `?${index + 1}`).join(",");
  const rows = await env.DB.prepare(
    `
      SELECT ranked.id, ranked.rank
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY global_elo DESC, wins DESC, losses ASC, display_name ASC) AS rank
        FROM users
      ) ranked
      WHERE ranked.id IN (${placeholders})
    `,
  )
    .bind(...userIds)
    .all<{ id: string; rank: number }>();

  return rows.results;
}

async function unlockSimpleAchievement(
  env: Env,
  userId: string,
  achievementKey: string,
  nowIso: string,
): Promise<void> {
  await upsertAchievementProgress({
    env,
    userId,
    achievementKey,
    progressValue: 1,
    progressTarget: 1,
    nowIso,
    unlock: true,
  });
}

async function evaluateMatchMilestones(env: Env, userIds: string[], nowIso: string): Promise<void> {
  const rows = await loadUserMatchStats(env, [...new Set(userIds)]);

  for (const row of rows) {
    const matchesPlayed = Number(row.matches_played);
    const wins = Number(row.wins);
    const streak = Number(row.streak);

    await upsertAchievementProgress({
      env,
      userId: row.id,
      achievementKey: "first_match",
      progressValue: Math.min(matchesPlayed, 1),
      progressTarget: 1,
      nowIso,
      unlock: matchesPlayed >= 1,
    });
    await upsertAchievementProgress({
      env,
      userId: row.id,
      achievementKey: "matches_10",
      progressValue: Math.min(matchesPlayed, 10),
      progressTarget: 10,
      nowIso,
      unlock: matchesPlayed >= 10,
    });
    await upsertAchievementProgress({
      env,
      userId: row.id,
      achievementKey: "matches_25",
      progressValue: Math.min(matchesPlayed, 25),
      progressTarget: 25,
      nowIso,
      unlock: matchesPlayed >= 25,
    });
    await upsertAchievementProgress({
      env,
      userId: row.id,
      achievementKey: "first_win",
      progressValue: Math.min(wins, 1),
      progressTarget: 1,
      nowIso,
      unlock: wins >= 1,
    });
    await upsertAchievementProgress({
      env,
      userId: row.id,
      achievementKey: "win_streak_3",
      progressValue: Math.min(Math.max(streak, 0), 3),
      progressTarget: 3,
      nowIso,
      unlock: streak >= 3,
      context: streak >= 3 ? { streak } : undefined,
    });
    await upsertAchievementProgress({
      env,
      userId: row.id,
      achievementKey: "win_streak_5",
      progressValue: Math.min(Math.max(streak, 0), 5),
      progressTarget: 5,
      nowIso,
      unlock: streak >= 5,
      context: streak >= 5 ? { streak } : undefined,
    });
  }
}

async function evaluateRankMilestones(env: Env, userIds: string[], nowIso: string): Promise<void> {
  const rows = await loadUserRanks(env, [...new Set(userIds)]);

  for (const row of rows) {
    const rank = Number(row.rank);
    await upsertAchievementProgress({
      env,
      userId: row.id,
      achievementKey: "rank_top_3",
      progressValue: rank <= 3 ? 3 : 0,
      progressTarget: 3,
      nowIso,
      unlock: rank <= 3,
      context: rank <= 3 ? { rank } : undefined,
    });
    await upsertAchievementProgress({
      env,
      userId: row.id,
      achievementKey: "rank_1",
      progressValue: rank === 1 ? 1 : 0,
      progressTarget: 1,
      nowIso,
      unlock: rank === 1,
      context: rank === 1 ? { rank } : undefined,
    });
  }
}

export async function evaluateAchievementsForTrigger(env: Env, trigger: AchievementTrigger): Promise<void> {
  await ensureAchievementCatalog(env);

  switch (trigger.type) {
    case "bootstrap":
      await unlockSimpleAchievement(env, trigger.userId, "account_created", trigger.nowIso);
      break;
    case "season_created":
      await unlockSimpleAchievement(env, trigger.actorUserId, "season_creator", trigger.nowIso);
      break;
    case "tournament_created":
      await unlockSimpleAchievement(env, trigger.actorUserId, "tournament_creator", trigger.nowIso);
      break;
    case "match_created":
      await evaluateMatchMilestones(env, trigger.userIds, trigger.nowIso);
      break;
    case "rankings_recomputed":
      await evaluateRankMilestones(env, trigger.userIds, trigger.nowIso);
      break;
  }
}

export async function getAchievementOverview(env: Env, userId: string): Promise<AchievementOverview> {
  await ensureAchievementCatalog(env);

  const rows = await env.DB.prepare(
    `
      SELECT
        d.key,
        d.category,
        d.tier,
        d.points,
        d.sort_order,
        d.active,
        ua.unlocked_at,
        ua.progress_value,
        ua.progress_target
      FROM achievement_definitions d
      LEFT JOIN user_achievements ua
        ON ua.achievement_key = d.key
       AND ua.user_id = ?1
      WHERE d.active = 1
      ORDER BY d.sort_order ASC
    `,
  )
    .bind(userId)
    .all<
      AchievementRow & {
        active: number;
      }
    >();

  const iconByKey = new Map(ACHIEVEMENTS.map((achievement) => [achievement.key, achievement.icon]));
  const items = rows.results.map((row) =>
    mapAchievementRow({
      ...row,
      icon: iconByKey.get(row.key) ?? "spark",
    }),
  );
  const unlocked = items.filter((item) => item.unlockedAt);
  const locked = items.filter((item) => !item.unlockedAt);
  const recentUnlocks = [...unlocked]
    .sort((left, right) => Date.parse(right.unlockedAt || "") - Date.parse(left.unlockedAt || ""))
    .slice(0, 3);
  const featured = (recentUnlocks.length > 0 ? recentUnlocks : unlocked.slice(0, 3)).slice(0, 3);
  const nextUp =
    [...locked]
      .sort((left, right) => {
        const leftRatio = left.progressTarget ? left.progressValue / left.progressTarget : 0;
        const rightRatio = right.progressTarget ? right.progressValue / right.progressTarget : 0;
        if (rightRatio !== leftRatio) {
          return rightRatio - leftRatio;
        }
        return right.points - left.points;
      })
      .at(0) ?? null;

  return {
    totalUnlocked: unlocked.length,
    totalAvailable: items.length,
    score: unlocked.reduce((sum, item) => sum + item.points, 0),
    recentUnlocks,
    featured,
    nextUp,
  };
}
