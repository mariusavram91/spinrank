import { isoNow, parseJsonArray, parseJsonObject } from "../db";
import type { AchievementOverview, AchievementSummaryItem, Env } from "../types";
import { ACHIEVEMENTS, type AchievementDefinition } from "./achievementCatalog";
import { buildAchievementState } from "./achievementRebuildShared.js";
import { calculateSeasonScore, MINIMUM_MATCHES_TO_QUALIFY } from "./elo";

export type AchievementTrigger =
  | { type: "bootstrap"; userId: string; nowIso: string }
  | {
      type: "match_created";
      userIds: string[];
      actorUserId: string;
      matchId: string;
      nowIso: string;
      matchType?: "singles" | "doubles";
      seasonId?: string | null;
      tournamentId?: string | null;
      preMatchGlobalEloByUserId?: Record<string, number>;
    }
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

type TimeMilestoneKey = "days_30" | "days_180" | "days_365";
type AchievementProgressMutation = {
  userId: string;
  achievementKey: string;
  progressValue: number;
  progressTarget?: number | null;
  unlock?: boolean;
  context?: Record<string, unknown>;
  replaceProgress?: boolean;
};

type MatchHistoryRow = {
  user_id: string;
  player_team: "A" | "B";
  id: string;
  match_type: "singles" | "doubles";
  format_type: "single_game" | "best_of_3";
  points_to_win: 11 | 21;
  team_a_player_ids_json: string;
  team_b_player_ids_json: string;
  score_json: string;
  winner_team: "A" | "B";
  global_elo_delta_json: string;
  played_at: string;
  created_at: string;
};

type MatchHistoryStats = {
  marathonMatchCount: Map<string, number>;
  luckyNumbersCount: Map<string, number>;
  mirrorMatchCount: Map<string, number>;
  stylePointsCount: Map<string, number>;
  squadPartnerCount: Map<string, number>;
  rivalMatchesMax: Map<string, number>;
  unbeatenRunMax: Map<string, number>;
  weeklyMatchStreak: Map<string, number>;
  comebackWinsCount: Map<string, number>;
  deuceWinsCount: Map<string, number>;
  decidingSetWinsCount: Map<string, number>;
  clutchComebackCount: Map<string, number>;
  upsetVictoryCount: Map<string, number>;
};

const RANK_ONE_MIN_MATCHES = 60;
const DEFENDER_RANK_THRESHOLD = 5;
const UNSTOPPABLE_STREAK_TARGET = 7;

const TIME_MILESTONES: ReadonlyArray<readonly [TimeMilestoneKey, number]> = [
  ["days_30", 30],
  ["days_180", 180],
  ["days_365", 365],
];

const achievementCatalogReadyByDatabase = new WeakSet<object>();

const buildTitleKey = (key: string): string => `achievement.${key}.title`;
const buildDescriptionKey = (key: string): string => `achievement.${key}.description`;
const achievementProgressUpsertSql = `
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
`;
const achievementProgressReplaceSql = `
  INSERT INTO user_achievements (
    user_id, achievement_key, unlocked_at, progress_value, progress_target, last_evaluated_at, context_json
  ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  ON CONFLICT(user_id, achievement_key) DO UPDATE SET
    progress_value = excluded.progress_value,
    progress_target = COALESCE(excluded.progress_target, user_achievements.progress_target),
    unlocked_at = COALESCE(user_achievements.unlocked_at, excluded.unlocked_at),
    last_evaluated_at = excluded.last_evaluated_at,
    context_json = excluded.context_json
`;
const achievementJobInsertSql = `
  INSERT INTO achievement_jobs (id, payload_json, created_at, attempts, last_attempted_at, last_error)
  VALUES (?1, ?2, ?3, 0, NULL, NULL)
`;

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

export async function ensureAchievementCatalog(env: Env): Promise<void> {
  if (achievementCatalogReadyByDatabase.has(env.DB as object)) {
    return;
  }

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

  achievementCatalogReadyByDatabase.add(env.DB as object);
}

function serializeAchievementTrigger(trigger: AchievementTrigger): string {
  return JSON.stringify(trigger);
}

export function createEnqueueAchievementTriggerStatement(
  env: Env,
  trigger: AchievementTrigger,
  createdAt: string,
): D1PreparedStatement {
  return env.DB.prepare(achievementJobInsertSql).bind(
    env.runtime?.randomUUID?.() ?? crypto.randomUUID(),
    serializeAchievementTrigger(trigger),
    createdAt,
  );
}

export async function enqueueAchievementTrigger(
  env: Env,
  trigger: AchievementTrigger,
  createdAt = isoNow(env.runtime),
): Promise<void> {
  await createEnqueueAchievementTriggerStatement(env, trigger, createdAt).run();
}

function createAchievementProgressStatement(
  env: Env,
  mutation: AchievementProgressMutation,
  nowIso: string,
): D1PreparedStatement {
  return env.DB.prepare(mutation.replaceProgress ? achievementProgressReplaceSql : achievementProgressUpsertSql).bind(
    mutation.userId,
    mutation.achievementKey,
    mutation.unlock ? nowIso : null,
    mutation.progressValue,
    mutation.progressTarget ?? null,
    nowIso,
    JSON.stringify(mutation.context ?? {}),
  );
}

async function flushAchievementProgressMutations(
  env: Env,
  mutations: AchievementProgressMutation[],
  nowIso: string,
): Promise<void> {
  if (mutations.length === 0) {
    return;
  }

  await env.DB.batch(mutations.map((mutation) => createAchievementProgressStatement(env, mutation, nowIso)));
}

async function loadUserMatchHistory(env: Env, userIds: string[]): Promise<MatchHistoryRow[]> {
  if (userIds.length === 0) {
    return [];
  }
  const placeholders = userIds.map((_, index) => `?${index + 1}`).join(",");
  const rows = await env.DB.prepare(
    `
      SELECT
        mp.user_id,
        mp.team AS player_team,
        m.id,
        m.match_type,
        m.format_type,
        m.points_to_win,
        m.team_a_player_ids_json,
        m.team_b_player_ids_json,
        m.score_json,
        m.winner_team,
        m.global_elo_delta_json,
        m.played_at,
        m.created_at
      FROM match_players mp
      JOIN matches m
        ON m.id = mp.match_id
      WHERE mp.user_id IN (${placeholders})
        AND m.status = 'active'
      ORDER BY m.played_at ASC, m.created_at ASC, m.id ASC
    `,
  )
    .bind(...userIds)
    .all<MatchHistoryRow>();

  return rows.results;
}

function toWeekStart(date: Date): string {
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() - day + 1);
  return normalized.toISOString().slice(0, 10);
}

function countConsecutiveWeeks(weekStarts: Set<string>): number {
  const sorted = [...weekStarts].sort();
  let best = 0;
  let current = 0;
  let previousMs: number | null = null;

  for (const weekStart of sorted) {
    const currentMs = Date.parse(`${weekStart}T00:00:00.000Z`);
    if (previousMs !== null && currentMs - previousMs === 7 * 24 * 60 * 60 * 1000) {
      current += 1;
    } else {
      current = 1;
    }
    best = Math.max(best, current);
    previousMs = currentMs;
  }

  return best;
}

function computeMatchHistoryStats(
  rows: MatchHistoryRow[],
  upsetContextByMatchId: Map<string, Record<string, number>> = new Map(),
): MatchHistoryStats {
  const marathonMatchCount = new Map<string, number>();
  const luckyNumbersCount = new Map<string, number>();
  const mirrorMatchCount = new Map<string, number>();
  const stylePointsCount = new Map<string, number>();
  const squadPartnerCount = new Map<string, number>();
  const rivalMatchesMax = new Map<string, number>();
  const unbeatenRunMax = new Map<string, number>();
  const weeklyMatchStreak = new Map<string, number>();
  const comebackWinsCount = new Map<string, number>();
  const deuceWinsCount = new Map<string, number>();
  const decidingSetWinsCount = new Map<string, number>();
  const clutchComebackCount = new Map<string, number>();
  const upsetVictoryCount = new Map<string, number>();

  const partnersByUserId = new Map<string, Set<string>>();
  const rivalCountsByUserId = new Map<string, Map<string, number>>();
  const weekStartsByUserId = new Map<string, Set<string>>();
  const mirrorByUserId = new Map<string, Map<string, { win: boolean; loss: boolean }>>();
  const styleRunByUserId = new Map<string, number>();
  const unbeatenRunByUserId = new Map<string, number>();

  for (const row of rows) {
    const score = parseJsonObject<Array<{ teamA: number; teamB: number }>>(row.score_json, []);
    const teamAPlayerIds = parseJsonArray<string>(row.team_a_player_ids_json);
    const teamBPlayerIds = parseJsonArray<string>(row.team_b_player_ids_json);
    const ownTeamIds = row.player_team === "A" ? teamAPlayerIds : teamBPlayerIds;
    const opponentIds = row.player_team === "A" ? teamBPlayerIds : teamAPlayerIds;
    const didWin = row.player_team === row.winner_team;
    const userId = row.user_id;

    if (row.format_type === "best_of_3" && score.length === 3) {
      marathonMatchCount.set(userId, (marathonMatchCount.get(userId) ?? 0) + 1);
    }

    const weekStarts = weekStartsByUserId.get(userId) ?? new Set<string>();
    weekStarts.add(toWeekStart(new Date(row.played_at)));
    weekStartsByUserId.set(userId, weekStarts);

    const partners = partnersByUserId.get(userId) ?? new Set<string>();
    ownTeamIds.filter((playerId) => playerId !== userId).forEach((partnerId) => partners.add(partnerId));
    partnersByUserId.set(userId, partners);

    if (row.match_type === "singles") {
      const rivalCounts = rivalCountsByUserId.get(userId) ?? new Map<string, number>();
      opponentIds.forEach((opponentId) => {
        rivalCounts.set(opponentId, (rivalCounts.get(opponentId) ?? 0) + 1);
      });
      rivalCountsByUserId.set(userId, rivalCounts);

      const matchDate = row.played_at.slice(0, 10);
      const mirrorKeyBase = mirrorByUserId.get(userId) ?? new Map<string, { win: boolean; loss: boolean }>();
      opponentIds.forEach((opponentId) => {
        const mirrorKey = `${matchDate}:${opponentId}`;
        const outcome = mirrorKeyBase.get(mirrorKey) ?? { win: false, loss: false };
        if (didWin) {
          outcome.win = true;
        } else {
          outcome.loss = true;
        }
        mirrorKeyBase.set(mirrorKey, outcome);
      });
      mirrorByUserId.set(userId, mirrorKeyBase);
    }

    let exactStyleRun = styleRunByUserId.get(userId) ?? 0;
    score.forEach((game, gameIndex) => {
      const ownScore = row.player_team === "A" ? Number(game.teamA) : Number(game.teamB);
      const opponentScore = row.player_team === "A" ? Number(game.teamB) : Number(game.teamA);
      const wonGame = ownScore > opponentScore;

      if (wonGame && ownScore === 11 && opponentScore === 7) {
        luckyNumbersCount.set(userId, (luckyNumbersCount.get(userId) ?? 0) + 1);
      }
      if (wonGame && ownScore >= row.points_to_win + 1 && opponentScore >= row.points_to_win - 1) {
        deuceWinsCount.set(userId, (deuceWinsCount.get(userId) ?? 0) + 1);
      }

      if (wonGame && ownScore === 11 && opponentScore === 9) {
        exactStyleRun += 1;
        stylePointsCount.set(userId, Math.max(stylePointsCount.get(userId) ?? 0, exactStyleRun));
      } else {
        exactStyleRun = 0;
      }

      if (
        didWin &&
        row.format_type === "best_of_3" &&
        score.length === 3 &&
        gameIndex === score.length - 1 &&
        wonGame
      ) {
        decidingSetWinsCount.set(userId, (decidingSetWinsCount.get(userId) ?? 0) + 1);
      }
    });
    styleRunByUserId.set(userId, exactStyleRun);

    if (didWin && score.length > 0) {
      const firstGame = score[0];
      const firstOwnScore = row.player_team === "A" ? Number(firstGame.teamA) : Number(firstGame.teamB);
      const firstOpponentScore = row.player_team === "A" ? Number(firstGame.teamB) : Number(firstGame.teamA);
      if (firstOwnScore < firstOpponentScore) {
        comebackWinsCount.set(userId, (comebackWinsCount.get(userId) ?? 0) + 1);
        clutchComebackCount.set(userId, (clutchComebackCount.get(userId) ?? 0) + 1);
      }
    }

    const unbeatenRun = didWin ? (unbeatenRunByUserId.get(userId) ?? 0) + 1 : 0;
    unbeatenRunByUserId.set(userId, unbeatenRun);
    unbeatenRunMax.set(userId, Math.max(unbeatenRunMax.get(userId) ?? 0, unbeatenRun));

    const upsetContext = upsetContextByMatchId.get(row.id);
    if (didWin && upsetContext?.[userId] !== undefined) {
      const ownPreMatchElo = Number(upsetContext[userId]);
      const opponentOverThreshold = opponentIds.some((opponentId) => Number(upsetContext[opponentId] ?? ownPreMatchElo) - ownPreMatchElo >= 100);
      if (opponentOverThreshold) {
        upsetVictoryCount.set(userId, (upsetVictoryCount.get(userId) ?? 0) + 1);
      }
    }
  }

  for (const [userId, partners] of partnersByUserId) {
    squadPartnerCount.set(userId, partners.size);
  }
  for (const [userId, counts] of rivalCountsByUserId) {
    rivalMatchesMax.set(userId, Math.max(0, ...counts.values()));
  }
  for (const [userId, weekStarts] of weekStartsByUserId) {
    weeklyMatchStreak.set(userId, countConsecutiveWeeks(weekStarts));
  }
  for (const [userId, states] of mirrorByUserId) {
    const mirroredCount = [...states.values()].filter((state) => state.win && state.loss).length;
    mirrorMatchCount.set(userId, mirroredCount);
  }

  return {
    marathonMatchCount,
    luckyNumbersCount,
    mirrorMatchCount,
    stylePointsCount,
    squadPartnerCount,
    rivalMatchesMax,
    unbeatenRunMax,
    weeklyMatchStreak,
    comebackWinsCount,
    deuceWinsCount,
    decidingSetWinsCount,
    clutchComebackCount,
    upsetVictoryCount,
  };
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

async function loadUserRankSnapshots(
  env: Env,
  userIds: string[],
): Promise<Array<{ id: string; rank: number; global_elo: number }>> {
  if (userIds.length === 0) {
    return [];
  }
  const placeholders = userIds.map((_, index) => `?${index + 1}`).join(",");
  const rows = await env.DB.prepare(
    `
      SELECT
        u.id,
        u.global_elo,
        1 + (
          SELECT COUNT(*)
          FROM users ahead
          WHERE ahead.global_elo > u.global_elo
             OR (ahead.global_elo = u.global_elo AND ahead.wins > u.wins)
             OR (ahead.global_elo = u.global_elo AND ahead.wins = u.wins AND ahead.losses < u.losses)
             OR (
               ahead.global_elo = u.global_elo
               AND ahead.wins = u.wins
               AND ahead.losses = u.losses
               AND ahead.display_name < u.display_name
             )
        ) AS rank
      FROM users u
      WHERE u.id IN (${placeholders})
    `,
  )
    .bind(...userIds)
    .all<{ id: string; rank: number; global_elo: number }>();

  return rows.results;
}

async function unlockSimpleAchievement(
  env: Env,
  userId: string,
  achievementKey: string,
  nowIso: string,
): Promise<void> {
  await flushAchievementProgressMutations(
    env,
    [
      {
        userId,
        achievementKey,
        progressValue: 1,
        progressTarget: 1,
        unlock: true,
      },
    ],
    nowIso,
  );
}

async function loadCreatedCounts(
  env: Env,
  table: "seasons" | "tournaments",
  userIds: string[],
): Promise<Array<{ user_id: string; created_count: number }>> {
  if (userIds.length === 0) {
    return [];
  }
  const placeholders = userIds.map((_, index) => `?${index + 1}`).join(",");
  const rows = await env.DB.prepare(
    `
      SELECT created_by_user_id AS user_id, COUNT(*) AS created_count
      FROM ${table}
      WHERE created_by_user_id IN (${placeholders})
      GROUP BY created_by_user_id
    `,
  )
    .bind(...userIds)
    .all<{ user_id: string; created_count: number }>();

  return rows.results;
}

async function loadSegmentPlayedCounts(
  env: Env,
  segment: "season" | "tournament",
  userIds: string[],
): Promise<Array<{ user_id: string; played_count: number }>> {
  if (userIds.length === 0) {
    return [];
  }
  const placeholders = userIds.map((_, index) => `?${index + 1}`).join(",");
  const column = segment === "season" ? "m.season_id" : "m.tournament_id";
  const rows = await env.DB.prepare(
    `
      SELECT mp.user_id, COUNT(DISTINCT ${column}) AS played_count
      FROM match_players mp
      JOIN matches m
        ON m.id = mp.match_id
      WHERE mp.user_id IN (${placeholders})
        AND m.status = 'active'
        AND ${column} IS NOT NULL
      GROUP BY mp.user_id
    `,
  )
    .bind(...userIds)
    .all<{ user_id: string; played_count: number }>();

  return rows.results;
}

async function loadMatchTypeCounts(
  env: Env,
  userIds: string[],
): Promise<Array<{ user_id: string; singles_count: number; doubles_count: number }>> {
  if (userIds.length === 0) {
    return [];
  }
  const placeholders = userIds.map((_, index) => `?${index + 1}`).join(",");
  const rows = await env.DB.prepare(
    `
      SELECT
        mp.user_id,
        SUM(CASE WHEN m.match_type = 'singles' THEN 1 ELSE 0 END) AS singles_count,
        SUM(CASE WHEN m.match_type = 'doubles' THEN 1 ELSE 0 END) AS doubles_count
      FROM match_players mp
      JOIN matches m
        ON m.id = mp.match_id
      WHERE mp.user_id IN (${placeholders})
        AND m.status = 'active'
      GROUP BY mp.user_id
    `,
  )
    .bind(...userIds)
    .all<{ user_id: string; singles_count: number; doubles_count: number }>();

  return rows.results;
}

async function loadWinnerScorelineCounts(
  env: Env,
  userIds: string[],
  args: { pointsToWin: 11 | 21; loserScoreCap: number },
): Promise<Array<{ user_id: string; count: number }>> {
  if (userIds.length === 0) {
    return [];
  }

  const placeholders = userIds.map((_, index) => `?${index + 3}`).join(",");
  const rows = await env.DB.prepare(
    `
      SELECT mp.user_id, COUNT(DISTINCT m.id) AS count
      FROM matches m
      JOIN match_players mp
        ON mp.match_id = m.id
       AND mp.team = m.winner_team
      WHERE m.status = 'active'
        AND m.points_to_win = ?1
        AND mp.user_id IN (${placeholders})
        AND EXISTS (
          SELECT 1
          FROM json_each(m.score_json) game
          WHERE (
            m.winner_team = 'A'
            AND json_extract(game.value, '$.teamA') = ?1
            AND json_extract(game.value, '$.teamB') <= ?2
          ) OR (
            m.winner_team = 'B'
            AND json_extract(game.value, '$.teamB') = ?1
            AND json_extract(game.value, '$.teamA') <= ?2
          )
        )
      GROUP BY mp.user_id
    `,
  )
    .bind(args.pointsToWin, args.loserScoreCap, ...userIds)
    .all<{ user_id: string; count: number }>();

  return rows.results;
}

async function loadCompletedSeasonOutcomeCounts(
  env: Env,
  userIds: string[],
  nowIso: string,
): Promise<{
  seasonWinnerCount: Map<string, number>;
  seasonPodiumCount: Map<string, number>;
  spring2026ChampionCount: Map<string, number>;
  spring2026Top3Count: Map<string, number>;
}> {
  if (userIds.length === 0) {
    return {
      seasonWinnerCount: new Map(),
      seasonPodiumCount: new Map(),
      spring2026ChampionCount: new Map(),
      spring2026Top3Count: new Map(),
    };
  }

  const rows = await env.DB.prepare(
    `
      SELECT
        es.segment_id AS season_id,
        es.user_id,
        es.elo,
        es.matches_played,
        es.matches_played_equivalent,
        es.wins,
        es.losses,
        es.season_glicko_rating,
        es.season_glicko_rd,
        es.season_conservative_rating,
        es.season_attended_weeks,
        es.season_total_weeks,
        es.season_attendance_penalty,
        u.display_name
      FROM elo_segments es
      JOIN seasons s
        ON s.id = es.segment_id
      JOIN users u
        ON u.id = es.user_id
      WHERE es.segment_type = 'season'
        AND s.status != 'deleted'
        AND (
          s.status = 'completed'
          OR s.completed_at IS NOT NULL
          OR (s.end_date != '' AND s.end_date < ?1)
        )
    `,
  )
    .bind(nowIso.slice(0, 10))
    .all<{
      season_id: string;
      user_id: string;
      elo: number;
      matches_played: number;
      matches_played_equivalent: number;
      wins: number;
      losses: number;
      season_glicko_rating: number | null;
      season_glicko_rd: number | null;
      season_conservative_rating: number | null;
      season_attended_weeks: number;
      season_total_weeks: number;
      season_attendance_penalty: number;
      display_name: string;
    }>();

  const targetUserIds = new Set(userIds);
  const winnerCount = new Map<string, number>();
  const podiumCount = new Map<string, number>();
  const spring2026ChampionCount = new Map<string, number>();
  const spring2026Top3Count = new Map<string, number>();
  const rowsBySeasonId = new Map<string, typeof rows.results>();

  for (const row of rows.results) {
    const seasonRows = rowsBySeasonId.get(row.season_id) ?? [];
    seasonRows.push(row);
    rowsBySeasonId.set(row.season_id, seasonRows);
  }

  for (const seasonRows of rowsBySeasonId.values()) {
    const qualified = seasonRows
      .filter((row) => Number(row.matches_played_equivalent ?? row.matches_played ?? 0) >= MINIMUM_MATCHES_TO_QUALIFY)
      .map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        elo: Number(row.elo),
        wins: Number(row.wins),
        losses: Number(row.losses),
        seasonConservativeRating:
          row.season_conservative_rating === null ? 0 : Number(row.season_conservative_rating),
        seasonGlickoRating: row.season_glicko_rating === null ? 0 : Number(row.season_glicko_rating),
        seasonGlickoRd: row.season_glicko_rd === null ? 0 : Number(row.season_glicko_rd),
        seasonAttendedWeeks: Number(row.season_attended_weeks ?? 0),
        seasonTotalWeeks: Number(row.season_total_weeks ?? 0),
      }))
      .sort((left, right) => {
        const leftSeasonScore = calculateSeasonScore({
          rating: left.seasonGlickoRating || left.elo,
          rd: left.seasonGlickoRd,
          attendedWeeks: left.seasonAttendedWeeks,
          totalWeeks: left.seasonTotalWeeks,
        });
        const rightSeasonScore = calculateSeasonScore({
          rating: right.seasonGlickoRating || right.elo,
          rd: right.seasonGlickoRd,
          attendedWeeks: right.seasonAttendedWeeks,
          totalWeeks: right.seasonTotalWeeks,
        });
        if (rightSeasonScore !== leftSeasonScore) {
          return rightSeasonScore - leftSeasonScore;
        }
        if (right.seasonConservativeRating !== left.seasonConservativeRating) {
          return right.seasonConservativeRating - left.seasonConservativeRating;
        }
        if (right.seasonGlickoRating !== left.seasonGlickoRating) {
          return right.seasonGlickoRating - left.seasonGlickoRating;
        }
        if (right.elo !== left.elo) {
          return right.elo - left.elo;
        }
        if (right.wins !== left.wins) {
          return right.wins - left.wins;
        }
        if (left.losses !== right.losses) {
          return left.losses - right.losses;
        }
        return left.displayName.localeCompare(right.displayName);
      });

    if (qualified.length === 0) {
      continue;
    }

    const winner = qualified[0];
    if (winner && targetUserIds.has(winner.userId)) {
      winnerCount.set(winner.userId, (winnerCount.get(winner.userId) ?? 0) + 1);
      spring2026ChampionCount.set(winner.userId, winnerCount.get(winner.userId) ?? 0);
    }
    qualified.slice(0, 3).forEach((row) => {
      if (targetUserIds.has(row.userId)) {
        podiumCount.set(row.userId, (podiumCount.get(row.userId) ?? 0) + 1);
        spring2026Top3Count.set(row.userId, podiumCount.get(row.userId) ?? 0);
      }
    });
  }

  return {
    seasonWinnerCount: winnerCount,
    seasonPodiumCount: podiumCount,
    spring2026ChampionCount,
    spring2026Top3Count,
  };
}

async function loadCompletedTournamentOutcomeCounts(
  env: Env,
  userIds: string[],
): Promise<{
  tournamentWinnerCount: Map<string, number>;
  tournamentFinalCount: Map<string, number>;
}> {
  if (userIds.length === 0) {
    return {
      tournamentWinnerCount: new Map(),
      tournamentFinalCount: new Map(),
    };
  }

  const finalRows = await env.DB.prepare(
    `
      SELECT tbm.left_player_id, tbm.right_player_id, tbm.winner_player_id
      FROM tournament_bracket_matches tbm
      JOIN tournaments t
        ON t.id = tbm.tournament_id
      WHERE tbm.is_final = 1
        AND tbm.winner_player_id IS NOT NULL
        AND t.status != 'deleted'
        AND (
          t.status = 'completed'
          OR (t.completed_at IS NOT NULL AND t.completed_at != '')
        )
    `,
  ).all<{ left_player_id: string | null; right_player_id: string | null; winner_player_id: string }>();

  const targetUserIds = new Set(userIds);
  const winnerCount = new Map<string, number>();
  const finalCount = new Map<string, number>();

  for (const row of finalRows.results) {
    if (targetUserIds.has(row.winner_player_id)) {
      winnerCount.set(row.winner_player_id, (winnerCount.get(row.winner_player_id) ?? 0) + 1);
    }
    const finalistId = [row.left_player_id, row.right_player_id].find(
      (playerId) => playerId && playerId !== row.winner_player_id,
    );
    if (finalistId && targetUserIds.has(finalistId)) {
      finalCount.set(finalistId, (finalCount.get(finalistId) ?? 0) + 1);
    }
  }

  return {
    tournamentWinnerCount: winnerCount,
    tournamentFinalCount: finalCount,
  };
}

async function loadAchievementProgressRows(
  env: Env,
  userIds: string[],
  achievementKeys: string[],
): Promise<Array<{ user_id: string; achievement_key: string; progress_value: number | null }>> {
  if (userIds.length === 0 || achievementKeys.length === 0) {
    return [];
  }

  const userPlaceholders = userIds.map((_, index) => `?${index + 1}`).join(",");
  const keyPlaceholders = achievementKeys.map((_, index) => `?${userIds.length + index + 1}`).join(",");
  const rows = await env.DB.prepare(
    `
      SELECT user_id, achievement_key, progress_value
      FROM user_achievements
      WHERE user_id IN (${userPlaceholders})
        AND achievement_key IN (${keyPlaceholders})
    `,
  )
    .bind(...userIds, ...achievementKeys)
    .all<{ user_id: string; achievement_key: string; progress_value: number | null }>();

  return rows.results;
}

async function loadUsersWithExistingSegmentParticipation(
  env: Env,
  segment: "season" | "tournament",
  segmentId: string,
  userIds: string[],
  currentMatchId: string,
): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }

  const placeholders = userIds.map((_, index) => `?${index + 3}`).join(",");
  const column = segment === "season" ? "m.season_id" : "m.tournament_id";
  const rows = await env.DB.prepare(
    `
      SELECT DISTINCT mp.user_id
      FROM match_players mp
      JOIN matches m
        ON m.id = mp.match_id
      WHERE ${column} = ?1
        AND m.id != ?2
        AND m.status = 'active'
        AND mp.user_id IN (${placeholders})
    `,
  )
    .bind(segmentId, currentMatchId, ...userIds)
    .all<{ user_id: string }>();

  return new Set(rows.results.map((row) => row.user_id));
}

function buildAchievementProgressIndex(
  rows: Array<{ user_id: string; achievement_key: string; progress_value: number | null }>,
): Map<string, Map<string, number>> {
  const progressByUserId = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const userProgress = progressByUserId.get(row.user_id) ?? new Map<string, number>();
    userProgress.set(row.achievement_key, Number(row.progress_value ?? 0));
    progressByUserId.set(row.user_id, userProgress);
  }

  return progressByUserId;
}

function getProgressValue(progressByUserId: Map<string, Map<string, number>>, userId: string, keys: string[]): number {
  const userProgress = progressByUserId.get(userId);
  if (!userProgress) {
    return 0;
  }

  return Math.max(...keys.map((key) => userProgress.get(key) ?? 0), 0);
}

async function evaluateLegacyMatchMilestones(env: Env, userIds: string[], nowIso: string): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  const [rows, seasonPlayedRows, tournamentPlayedRows, matchTypeRows] = await Promise.all([
    loadUserMatchStats(env, uniqueUserIds),
    loadSegmentPlayedCounts(env, "season", uniqueUserIds),
    loadSegmentPlayedCounts(env, "tournament", uniqueUserIds),
    loadMatchTypeCounts(env, uniqueUserIds),
  ]);
  const seasonsPlayedByUserId = new Map(seasonPlayedRows.map((row) => [row.user_id, Number(row.played_count)]));
  const tournamentsPlayedByUserId = new Map(tournamentPlayedRows.map((row) => [row.user_id, Number(row.played_count)]));
  const matchTypeCountsByUserId = new Map(
    matchTypeRows.map((row) => [row.user_id, { singles: Number(row.singles_count), doubles: Number(row.doubles_count) }]),
  );
  const mutations: AchievementProgressMutation[] = [];

  for (const row of rows) {
    const matchesPlayed = Number(row.matches_played);
    const wins = Number(row.wins);
    const streak = Number(row.streak);
    const seasonsPlayed = seasonsPlayedByUserId.get(row.id) ?? 0;
    const tournamentsPlayed = tournamentsPlayedByUserId.get(row.id) ?? 0;
    const matchTypeCounts = matchTypeCountsByUserId.get(row.id) ?? { singles: 0, doubles: 0 };

    for (const [achievementKey, target] of [
      ["first_match", 1],
      ["matches_3", 3],
      ["matches_5", 5],
      ["matches_10", 10],
      ["matches_25", 25],
      ["matches_50", 50],
      ["matches_100", 100],
      ["matches_250", 250],
      ["matches_500", 500],
      ["matches_1000", 1000],
    ] as const) {
      mutations.push({
        userId: row.id,
        achievementKey,
        progressValue: Math.min(matchesPlayed, target),
        progressTarget: target,
        unlock: matchesPlayed >= target,
      });
    }
    for (const [achievementKey, target, value] of [
      ["first_singles", 1, matchTypeCounts.singles],
      ["singles_10", 10, matchTypeCounts.singles],
      ["first_doubles", 1, matchTypeCounts.doubles],
      ["doubles_10", 10, matchTypeCounts.doubles],
    ] as const) {
      mutations.push({
        userId: row.id,
        achievementKey,
        progressValue: Math.min(value, target),
        progressTarget: target,
        unlock: value >= target,
      });
    }
    for (const [achievementKey, target] of [
      ["season_played", 1],
      ["seasons_played_3", 3],
      ["seasons_played_5", 5],
    ] as const) {
      mutations.push({
        userId: row.id,
        achievementKey,
        progressValue: Math.min(seasonsPlayed, target),
        progressTarget: target,
        unlock: seasonsPlayed >= target,
      });
    }
    for (const [achievementKey, target] of [
      ["tournament_played", 1],
      ["tournaments_played_3", 3],
      ["tournaments_played_5", 5],
    ] as const) {
      mutations.push({
        userId: row.id,
        achievementKey,
        progressValue: Math.min(tournamentsPlayed, target),
        progressTarget: target,
        unlock: tournamentsPlayed >= target,
      });
    }
    mutations.push({
      userId: row.id,
      achievementKey: "first_win",
      progressValue: Math.min(wins, 1),
      progressTarget: 1,
      unlock: wins >= 1,
    });
    mutations.push({
      userId: row.id,
      achievementKey: "win_streak_3",
      progressValue: Math.min(Math.max(streak, 0), 3),
      progressTarget: 3,
      unlock: streak >= 3,
      context: streak >= 3 ? { streak } : undefined,
    });
    mutations.push({
      userId: row.id,
      achievementKey: "win_streak_7",
      progressValue: Math.min(Math.max(streak, 0), UNSTOPPABLE_STREAK_TARGET),
      progressTarget: UNSTOPPABLE_STREAK_TARGET,
      unlock: streak >= UNSTOPPABLE_STREAK_TARGET,
      context: streak >= UNSTOPPABLE_STREAK_TARGET ? { streak } : undefined,
    });
    mutations.push({
      userId: row.id,
      achievementKey: "positive_record_60",
      progressValue: matchesPlayed >= 50 ? Math.min(Math.round((wins / Math.max(matchesPlayed, 1)) * 100), 60) : 0,
      progressTarget: 60,
      unlock: matchesPlayed >= 50 && wins / Math.max(matchesPlayed, 1) > 0.6,
    });
    mutations.push({
      userId: row.id,
      achievementKey: "dominant_era_70",
      progressValue: matchesPlayed >= 30 ? Math.min(Math.round((wins / Math.max(matchesPlayed, 1)) * 100), 70) : 0,
      progressTarget: 70,
      unlock: matchesPlayed >= 30 && wins / Math.max(matchesPlayed, 1) > 0.7,
    });
  }

  await flushAchievementProgressMutations(env, mutations, nowIso);
}

async function evaluateIncrementalMatchMilestones(
  env: Env,
  trigger: Extract<AchievementTrigger, { type: "match_created" }>,
): Promise<void> {
  const uniqueUserIds = [...new Set(trigger.userIds)];
  const trackedKeys = [
    "first_singles",
    "singles_10",
    "first_doubles",
    "doubles_10",
    "season_played",
    "seasons_played_3",
    "seasons_played_5",
    "tournament_played",
    "tournaments_played_3",
    "tournaments_played_5",
  ];
  const [rows, progressRows, seasonParticipants, tournamentParticipants, matchTypeRows, seasonPlayedRows, tournamentPlayedRows] = await Promise.all([
    loadUserMatchStats(env, uniqueUserIds),
    loadAchievementProgressRows(env, uniqueUserIds, trackedKeys),
    trigger.seasonId
      ? loadUsersWithExistingSegmentParticipation(env, "season", trigger.seasonId, uniqueUserIds, trigger.matchId)
      : Promise.resolve(new Set<string>()),
    trigger.tournamentId
      ? loadUsersWithExistingSegmentParticipation(env, "tournament", trigger.tournamentId, uniqueUserIds, trigger.matchId)
      : Promise.resolve(new Set<string>()),
    loadMatchTypeCounts(env, uniqueUserIds),
    trigger.seasonId ? loadSegmentPlayedCounts(env, "season", uniqueUserIds) : Promise.resolve([]),
    trigger.tournamentId ? loadSegmentPlayedCounts(env, "tournament", uniqueUserIds) : Promise.resolve([]),
  ]);
  const progressByUserId = buildAchievementProgressIndex(progressRows);
  const matchTypeCountsByUserId = new Map(
    matchTypeRows.map((row) => [row.user_id, { singles: Number(row.singles_count), doubles: Number(row.doubles_count) }]),
  );
  const seasonsPlayedByUserId = new Map(seasonPlayedRows.map((row) => [row.user_id, Number(row.played_count)]));
  const tournamentsPlayedByUserId = new Map(tournamentPlayedRows.map((row) => [row.user_id, Number(row.played_count)]));
  const mutations: AchievementProgressMutation[] = [];

  for (const row of rows) {
    const matchesPlayed = Number(row.matches_played);
    const wins = Number(row.wins);
    const streak = Number(row.streak);

    for (const [achievementKey, target] of [
      ["first_match", 1],
      ["matches_3", 3],
      ["matches_5", 5],
      ["matches_10", 10],
      ["matches_25", 25],
      ["matches_50", 50],
      ["matches_100", 100],
      ["matches_250", 250],
      ["matches_500", 500],
      ["matches_1000", 1000],
    ] as const) {
      mutations.push({
        userId: row.id,
        achievementKey,
        progressValue: Math.min(matchesPlayed, target),
        progressTarget: target,
        unlock: matchesPlayed >= target,
      });
    }

    if (trigger.matchType === "singles") {
      const optimisticSinglesPlayed = getProgressValue(progressByUserId, row.id, ["first_singles", "singles_10"]) + 1;
      const singlesPlayed = Math.max(optimisticSinglesPlayed, matchTypeCountsByUserId.get(row.id)?.singles ?? 0);
      for (const [achievementKey, target] of [
        ["first_singles", 1],
        ["singles_10", 10],
      ] as const) {
        mutations.push({
          userId: row.id,
          achievementKey,
          progressValue: Math.min(singlesPlayed, target),
          progressTarget: target,
          unlock: singlesPlayed >= target,
        });
      }
    }

    if (trigger.matchType === "doubles") {
      const optimisticDoublesPlayed = getProgressValue(progressByUserId, row.id, ["first_doubles", "doubles_10"]) + 1;
      const doublesPlayed = Math.max(optimisticDoublesPlayed, matchTypeCountsByUserId.get(row.id)?.doubles ?? 0);
      for (const [achievementKey, target] of [
        ["first_doubles", 1],
        ["doubles_10", 10],
      ] as const) {
        mutations.push({
          userId: row.id,
          achievementKey,
          progressValue: Math.min(doublesPlayed, target),
          progressTarget: target,
          unlock: doublesPlayed >= target,
        });
      }
    }

    if (trigger.seasonId) {
      const optimisticSeasonsPlayed =
        getProgressValue(progressByUserId, row.id, ["season_played", "seasons_played_3", "seasons_played_5"]) +
        (seasonParticipants.has(row.id) ? 0 : 1);
      const seasonsPlayed = Math.max(optimisticSeasonsPlayed, seasonsPlayedByUserId.get(row.id) ?? 0);
      for (const [achievementKey, target] of [
        ["season_played", 1],
        ["seasons_played_3", 3],
        ["seasons_played_5", 5],
      ] as const) {
        mutations.push({
          userId: row.id,
          achievementKey,
          progressValue: Math.min(seasonsPlayed, target),
          progressTarget: target,
          unlock: seasonsPlayed >= target,
        });
      }
    }

    if (trigger.tournamentId) {
      const optimisticTournamentsPlayed =
        getProgressValue(progressByUserId, row.id, ["tournament_played", "tournaments_played_3", "tournaments_played_5"]) +
        (tournamentParticipants.has(row.id) ? 0 : 1);
      const tournamentsPlayed = Math.max(
        optimisticTournamentsPlayed,
        tournamentsPlayedByUserId.get(row.id) ?? 0,
      );
      for (const [achievementKey, target] of [
        ["tournament_played", 1],
        ["tournaments_played_3", 3],
        ["tournaments_played_5", 5],
      ] as const) {
        mutations.push({
          userId: row.id,
          achievementKey,
          progressValue: Math.min(tournamentsPlayed, target),
          progressTarget: target,
          unlock: tournamentsPlayed >= target,
        });
      }
    }

    mutations.push({
      userId: row.id,
      achievementKey: "first_win",
      progressValue: Math.min(wins, 1),
      progressTarget: 1,
      unlock: wins >= 1,
    });
    mutations.push({
      userId: row.id,
      achievementKey: "win_streak_3",
      progressValue: Math.min(Math.max(streak, 0), 3),
      progressTarget: 3,
      unlock: streak >= 3,
      context: streak >= 3 ? { streak } : undefined,
    });
    mutations.push({
      userId: row.id,
      achievementKey: "win_streak_7",
      progressValue: Math.min(Math.max(streak, 0), UNSTOPPABLE_STREAK_TARGET),
      progressTarget: UNSTOPPABLE_STREAK_TARGET,
      unlock: streak >= UNSTOPPABLE_STREAK_TARGET,
      context: streak >= UNSTOPPABLE_STREAK_TARGET ? { streak } : undefined,
    });
    mutations.push({
      userId: row.id,
      achievementKey: "positive_record_60",
      progressValue: matchesPlayed >= 50 ? Math.min(Math.round((wins / Math.max(matchesPlayed, 1)) * 100), 60) : 0,
      progressTarget: 60,
      unlock: matchesPlayed >= 50 && wins / Math.max(matchesPlayed, 1) > 0.6,
    });
    mutations.push({
      userId: row.id,
      achievementKey: "dominant_era_70",
      progressValue: matchesPlayed >= 30 ? Math.min(Math.round((wins / Math.max(matchesPlayed, 1)) * 100), 70) : 0,
      progressTarget: 70,
      unlock: matchesPlayed >= 30 && wins / Math.max(matchesPlayed, 1) > 0.7,
    });
  }

  await flushAchievementProgressMutations(env, mutations, trigger.nowIso);
}

async function evaluateTimeMilestones(env: Env, userId: string, nowIso: string): Promise<void> {
  const user = await env.DB.prepare(
    `
      SELECT created_at
      FROM users
      WHERE id = ?1
    `,
  )
    .bind(userId)
    .first<{ created_at: string }>();

  if (!user?.created_at) {
    return;
  }

  const elapsedDays = Math.max(
    0,
    Math.floor((Date.parse(nowIso) - Date.parse(user.created_at)) / (1000 * 60 * 60 * 24)),
  );

  const mutations: AchievementProgressMutation[] = [];
  for (const [achievementKey, target] of TIME_MILESTONES) {
    mutations.push({
      userId,
      achievementKey,
      progressValue: Math.min(elapsedDays, target),
      progressTarget: target,
      unlock: elapsedDays >= target,
    });
  }
  await flushAchievementProgressMutations(env, mutations, nowIso);
}

async function evaluateScorelineMilestones(env: Env, userIds: string[], nowIso: string): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  const [perfect11Rows, perfect21Rows, blowout11Rows, blowout21Rows] = await Promise.all([
    loadWinnerScorelineCounts(env, uniqueUserIds, { pointsToWin: 11, loserScoreCap: 0 }),
    loadWinnerScorelineCounts(env, uniqueUserIds, { pointsToWin: 21, loserScoreCap: 0 }),
    loadWinnerScorelineCounts(env, uniqueUserIds, { pointsToWin: 11, loserScoreCap: 4 }),
    loadWinnerScorelineCounts(env, uniqueUserIds, { pointsToWin: 21, loserScoreCap: 9 }),
  ]);
  const perfect11ByUserId = new Map(perfect11Rows.map((row) => [row.user_id, Number(row.count)]));
  const perfect21ByUserId = new Map(perfect21Rows.map((row) => [row.user_id, Number(row.count)]));
  const blowout11ByUserId = new Map(blowout11Rows.map((row) => [row.user_id, Number(row.count)]));
  const blowout21ByUserId = new Map(blowout21Rows.map((row) => [row.user_id, Number(row.count)]));
  const mutations: AchievementProgressMutation[] = [];

  for (const userId of uniqueUserIds) {
    for (const [achievementKey, target, value] of [
      ["perfect_11_0", 1, perfect11ByUserId.get(userId) ?? 0],
      ["perfect_21_0", 1, perfect21ByUserId.get(userId) ?? 0],
      ["blowout_11_4", 1, blowout11ByUserId.get(userId) ?? 0],
      ["blowout_21_9", 1, blowout21ByUserId.get(userId) ?? 0],
    ] as const) {
      mutations.push({
        userId,
        achievementKey,
        progressValue: Math.min(value, target),
        progressTarget: target,
        unlock: value >= target,
      });
    }
  }

  await flushAchievementProgressMutations(env, mutations, nowIso);
}

async function evaluateCompetitiveFinishMilestones(env: Env, userIds: string[], nowIso: string): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  const [seasonCounts, tournamentCounts] = await Promise.all([
    loadCompletedSeasonOutcomeCounts(env, uniqueUserIds, nowIso),
    loadCompletedTournamentOutcomeCounts(env, uniqueUserIds),
  ]);
  const mutations: AchievementProgressMutation[] = [];

  for (const userId of uniqueUserIds) {
    for (const [achievementKey, target, value] of [
      ["season_podium", 1, seasonCounts.seasonPodiumCount.get(userId) ?? 0],
      ["season_winner", 1, seasonCounts.seasonWinnerCount.get(userId) ?? 0],
      ["season_podiums_3", 3, seasonCounts.seasonPodiumCount.get(userId) ?? 0],
      ["season_wins_3", 3, seasonCounts.seasonWinnerCount.get(userId) ?? 0],
      ["season_top3", 1, seasonCounts.seasonPodiumCount.get(userId) ?? 0],
      ["season_champion", 1, seasonCounts.seasonWinnerCount.get(userId) ?? 0],
      ["tournament_finalist", 1, tournamentCounts.tournamentFinalCount.get(userId) ?? 0],
      ["tournament_winner", 1, tournamentCounts.tournamentWinnerCount.get(userId) ?? 0],
      ["tournament_finals_3", 3, tournamentCounts.tournamentFinalCount.get(userId) ?? 0],
      ["tournament_wins_3", 3, tournamentCounts.tournamentWinnerCount.get(userId) ?? 0],
    ] as const) {
      mutations.push({
        userId,
        achievementKey,
        progressValue: Math.min(value, target),
        progressTarget: target,
        unlock: value >= target,
      });
    }
  }

  await flushAchievementProgressMutations(env, mutations, nowIso);
}

async function evaluateAdvancedMatchMilestones(
  env: Env,
  trigger: Extract<AchievementTrigger, { type: "match_created" }>,
): Promise<void> {
  const uniqueUserIds = [...new Set(trigger.userIds)];
  const historyRows = await loadUserMatchHistory(env, uniqueUserIds);
  const upsetContextByMatchId =
    trigger.preMatchGlobalEloByUserId && trigger.matchId
      ? new Map([[trigger.matchId, trigger.preMatchGlobalEloByUserId]])
      : new Map<string, Record<string, number>>();
  const stats = computeMatchHistoryStats(historyRows, upsetContextByMatchId);
  const mutations: AchievementProgressMutation[] = [];

  for (const userId of uniqueUserIds) {
    for (const [achievementKey, target, value] of [
      ["marathon_match", 1, stats.marathonMatchCount.get(userId) ?? 0],
      ["lucky_numbers", 7, stats.luckyNumbersCount.get(userId) ?? 0],
      ["mirror_match", 1, stats.mirrorMatchCount.get(userId) ?? 0],
      ["style_points", 3, stats.stylePointsCount.get(userId) ?? 0],
      ["squad_goals", 5, stats.squadPartnerCount.get(userId) ?? 0],
      ["rivalry_begins", 5, stats.rivalMatchesMax.get(userId) ?? 0],
      ["arch_rival", 15, stats.rivalMatchesMax.get(userId) ?? 0],
      ["iron_wall_10", 10, stats.unbeatenRunMax.get(userId) ?? 0],
      ["weekly_warrior_4", 4, stats.weeklyMatchStreak.get(userId) ?? 0],
      ["clutch_player", 1, stats.clutchComebackCount.get(userId) ?? 0],
      ["comeback_king", 3, stats.comebackWinsCount.get(userId) ?? 0],
      ["deuce_master", 5, stats.deuceWinsCount.get(userId) ?? 0],
      ["ice_cold", 1, stats.decidingSetWinsCount.get(userId) ?? 0],
      ["upset_victory", 1, stats.upsetVictoryCount.get(userId) ?? 0],
    ] as const) {
      mutations.push({
        userId,
        achievementKey,
        progressValue: Math.min(value, target),
        progressTarget: target,
        unlock: value >= target,
      });
    }
  }

  await flushAchievementProgressMutations(env, mutations, trigger.nowIso);
}

async function evaluateCollectionMilestones(env: Env, userIds: string[], nowIso: string): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) {
    return;
  }

  const placeholders = uniqueUserIds.map((_, index) => `?${index + 1}`).join(",");
  const unlockedRows = await env.DB.prepare(
    `
      SELECT user_id, achievement_key
      FROM user_achievements
      WHERE user_id IN (${placeholders})
        AND unlocked_at IS NOT NULL
    `,
  )
    .bind(...uniqueUserIds)
    .all<{ user_id: string; achievement_key: string }>();

  const unlockedByUserId = new Map<string, Set<string>>();
  unlockedRows.results.forEach((row) => {
    const unlocked = unlockedByUserId.get(row.user_id) ?? new Set<string>();
    unlocked.add(row.achievement_key);
    unlockedByUserId.set(row.user_id, unlocked);
  });

  const allRounderKeys = ["first_singles", "first_doubles", "season_played", "tournament_played"];
  const mutations: AchievementProgressMutation[] = [];

  for (const userId of uniqueUserIds) {
    const unlocked = unlockedByUserId.get(userId) ?? new Set<string>();
    const allRounderProgress = allRounderKeys.filter((key) => unlocked.has(key)).length;
    const unlockedCount = unlocked.size;

    mutations.push({
      userId,
      achievementKey: "all_rounder",
      progressValue: allRounderProgress,
      progressTarget: 4,
      unlock: allRounderProgress >= 4,
    });

    for (const [achievementKey, target] of [
      ["completionist_25", 25],
      ["completionist_50", 50],
      ["completionist_75", 75],
    ] as const) {
      mutations.push({
        userId,
        achievementKey,
        progressValue: Math.min(unlockedCount, target),
        progressTarget: target,
        unlock: unlockedCount >= target,
      });
    }
  }

  await flushAchievementProgressMutations(env, mutations, nowIso);
}

async function evaluateRankStreakMilestones(env: Env, userIds: string[], nowIso: string): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) {
    return;
  }

  const [rankRows, statRows, progressRows] = await Promise.all([
    loadUserRankSnapshots(env, uniqueUserIds),
    loadUserMatchStats(env, uniqueUserIds),
    loadAchievementProgressRows(env, uniqueUserIds, ["rank_dynasty_10", "top_five_defender_5"]),
  ]);
  const matchesPlayedByUserId = new Map(statRows.map((row) => [row.id, Number(row.matches_played ?? 0)]));
  const progressByUserId = buildAchievementProgressIndex(progressRows);
  const mutations: AchievementProgressMutation[] = [];

  for (const row of rankRows) {
    const matchesPlayed = matchesPlayedByUserId.get(row.id) ?? 0;
    const rank = Number(row.rank);
    const nextDynastyProgress =
      matchesPlayed >= RANK_ONE_MIN_MATCHES && rank === 1
        ? (progressByUserId.get(row.id)?.get("rank_dynasty_10") ?? 0) + 1
        : 0;
    const nextDefenderProgress =
      matchesPlayed >= 10 && rank <= DEFENDER_RANK_THRESHOLD
        ? (progressByUserId.get(row.id)?.get("top_five_defender_5") ?? 0) + 1
        : 0;

    mutations.push({
      userId: row.id,
      achievementKey: "rank_dynasty_10",
      progressValue: Math.min(nextDynastyProgress, 10),
      progressTarget: 10,
      unlock: nextDynastyProgress >= 10,
      context: { rank, matchesPlayed },
      replaceProgress: true,
    });
    mutations.push({
      userId: row.id,
      achievementKey: "top_five_defender_5",
      progressValue: Math.min(nextDefenderProgress, 5),
      progressTarget: 5,
      unlock: nextDefenderProgress >= 5,
      context: { rank, matchesPlayed },
      replaceProgress: true,
    });
  }

  await flushAchievementProgressMutations(env, mutations, nowIso);
}

function buildTimeMilestoneOverlay(
  rows: AchievementRow[],
  args: { createdAt: string | null; nowIso: string },
): AchievementRow[] {
  if (!args.createdAt) {
    return rows;
  }

  const createdAtMs = Date.parse(args.createdAt);
  const nowMs = Date.parse(args.nowIso);
  if (Number.isNaN(createdAtMs) || Number.isNaN(nowMs)) {
    return rows;
  }

  const elapsedDays = Math.max(0, Math.floor((nowMs - createdAtMs) / (1000 * 60 * 60 * 24)));
  const overlayByKey = new Map<TimeMilestoneKey, { progressValue: number; progressTarget: number; unlockedAt: string | null }>(
    TIME_MILESTONES.map(([achievementKey, target]) => [
      achievementKey,
      {
        progressValue: Math.min(elapsedDays, target),
        progressTarget: target,
        unlockedAt: elapsedDays >= target ? new Date(createdAtMs + target * 24 * 60 * 60 * 1000).toISOString() : null,
      },
    ]),
  );

  return rows.map((row) => {
    const overlay = overlayByKey.get(row.key as TimeMilestoneKey);
    if (!overlay) {
      return row;
    }

    return {
      ...row,
      unlocked_at: row.unlocked_at ?? overlay.unlockedAt,
      progress_value: Math.max(Number(row.progress_value ?? 0), overlay.progressValue),
      progress_target: row.progress_target ?? overlay.progressTarget,
    };
  });
}

async function evaluateCreationMilestones(
  env: Env,
  table: "seasons" | "tournaments",
  userIds: string[],
  nowIso: string,
): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  const rows = await loadCreatedCounts(env, table, uniqueUserIds);
  const countsByUserId = new Map(rows.map((row) => [row.user_id, Number(row.created_count)]));

  const milestones =
    table === "seasons"
      ? ([
          ["season_creator", 1],
          ["seasons_3", 3],
          ["seasons_5", 5],
        ] as const)
      : ([
          ["tournament_creator", 1],
          ["tournaments_3", 3],
          ["tournaments_5", 5],
        ] as const);
  const mutations: AchievementProgressMutation[] = [];

  for (const userId of uniqueUserIds) {
    const createdCount = countsByUserId.get(userId) ?? 0;
    for (const [achievementKey, target] of milestones) {
      mutations.push({
        userId,
        achievementKey,
        progressValue: Math.min(createdCount, target),
        progressTarget: target,
        unlock: createdCount >= target,
      });
    }
  }

  await flushAchievementProgressMutations(env, mutations, nowIso);
}

async function evaluateRankMilestones(env: Env, userIds: string[], nowIso: string): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  const [rankRows, statRows] = await Promise.all([
    loadUserRankSnapshots(env, uniqueUserIds),
    loadUserMatchStats(env, uniqueUserIds),
  ]);
  const matchesPlayedByUserId = new Map(statRows.map((row) => [row.id, Number(row.matches_played ?? 0)]));
  const mutations: AchievementProgressMutation[] = [];

  for (const row of rankRows) {
    const rank = Number(row.rank);
    const elo = Number(row.global_elo ?? 1200);
    const matchesPlayed = matchesPlayedByUserId.get(row.id) ?? 0;
    if (matchesPlayed >= 10 && rank <= 10) {
      mutations.push({
        userId: row.id,
        achievementKey: "rank_top_10",
        progressValue: 10,
        progressTarget: 10,
        unlock: true,
        context: { rank },
      });
    }
    if (matchesPlayed >= 15 && rank <= 3) {
      mutations.push({
        userId: row.id,
        achievementKey: "rank_top_3",
        progressValue: 3,
        progressTarget: 3,
        unlock: true,
        context: { rank },
      });
    }
    if (matchesPlayed >= RANK_ONE_MIN_MATCHES && rank === 1) {
      mutations.push({
        userId: row.id,
        achievementKey: "rank_1",
        progressValue: 1,
        progressTarget: 1,
        unlock: true,
        context: { rank },
      });
    }
    for (const [achievementKey, target] of [
      ["elo_1250", 1250],
      ["elo_1350", 1350],
      ["elo_1500", 1500],
      ["elo_1700", 1700],
    ] as const) {
      mutations.push({
        userId: row.id,
        achievementKey,
        progressValue: Math.min(elo, target),
        progressTarget: target,
        unlock: elo >= target,
        context: elo >= target ? { elo } : undefined,
      });
    }
  }

  await flushAchievementProgressMutations(env, mutations, nowIso);
}

async function loadAchievementRebuildData(
  env: Env,
  userIds: string[],
  nowIso = isoNow(env.runtime),
): Promise<{
  users: Array<{
    id: string;
    global_elo: number;
    wins: number;
    losses: number;
    streak: number;
    created_at: string;
    rank: number;
    matches_played: number;
  }>;
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
  marathonMatchCount: Map<string, number>;
  luckyNumbersCount: Map<string, number>;
  mirrorMatchCount: Map<string, number>;
  stylePointsCount: Map<string, number>;
  squadPartnerCount: Map<string, number>;
  rivalMatchesMax: Map<string, number>;
  unbeatenRunMax: Map<string, number>;
  weeklyMatchStreak: Map<string, number>;
  comebackWinsCount: Map<string, number>;
  deuceWinsCount: Map<string, number>;
  decidingSetWinsCount: Map<string, number>;
  clutchComebackCount: Map<string, number>;
  upsetVictoryCount: Map<string, number>;
  seasonWinnerCount: Map<string, number>;
  seasonPodiumCount: Map<string, number>;
  spring2026ChampionCount: Map<string, number>;
  spring2026Top3Count: Map<string, number>;
  tournamentWinnerCount: Map<string, number>;
  tournamentFinalCount: Map<string, number>;
  rankDynastyCount: Map<string, number>;
  topTenDefenderCount: Map<string, number>;
  completionist25Count: Map<string, number>;
  completionist50Count: Map<string, number>;
  completionist75Count: Map<string, number>;
  allRounderCount: Map<string, number>;
}> {
  const uniqueUserIds = [...new Set(userIds)];
  const [
    users,
    seasonsCreatedRows,
    tournamentsCreatedRows,
    seasonsPlayedRows,
    tournamentsPlayedRows,
    matchTypeRows,
    perfect11Rows,
    perfect21Rows,
    blowout11Rows,
    blowout21Rows,
    historyRows,
    seasonOutcomeCounts,
    tournamentOutcomeCounts,
  ] =
    await Promise.all([
      loadUserRankSnapshots(env, uniqueUserIds).then(async (rankRows) => {
        const stats = await loadUserMatchStats(env, uniqueUserIds);
        const statsByUserId = new Map(stats.map((row) => [row.id, row]));
        const createdRows = await env.DB.prepare(
          `
            SELECT id, created_at, wins, losses, streak
            FROM users
            WHERE id IN (${uniqueUserIds.map((_, index) => `?${index + 1}`).join(",")})
          `,
        )
          .bind(...uniqueUserIds)
          .all<{ id: string; created_at: string; wins: number; losses: number; streak: number }>();

        const createdByUserId = new Map(createdRows.results.map((row) => [row.id, row]));
        return rankRows.map((row) => {
          const base = createdByUserId.get(row.id);
          const stat = statsByUserId.get(row.id);
          return {
            id: row.id,
            global_elo: Number(row.global_elo),
            wins: Number(base?.wins ?? stat?.wins ?? 0),
            losses: Number(base?.losses ?? stat?.losses ?? 0),
            streak: Number(base?.streak ?? stat?.streak ?? 0),
            created_at: String(base?.created_at ?? isoNow(env.runtime)),
            rank: Number(row.rank),
            matches_played: Number(stat?.matches_played ?? 0),
          };
        });
      }),
      loadCreatedCounts(env, "seasons", uniqueUserIds),
      loadCreatedCounts(env, "tournaments", uniqueUserIds),
      loadSegmentPlayedCounts(env, "season", uniqueUserIds),
      loadSegmentPlayedCounts(env, "tournament", uniqueUserIds),
      loadMatchTypeCounts(env, uniqueUserIds),
      loadWinnerScorelineCounts(env, uniqueUserIds, { pointsToWin: 11, loserScoreCap: 0 }),
      loadWinnerScorelineCounts(env, uniqueUserIds, { pointsToWin: 21, loserScoreCap: 0 }),
      loadWinnerScorelineCounts(env, uniqueUserIds, { pointsToWin: 11, loserScoreCap: 4 }),
      loadWinnerScorelineCounts(env, uniqueUserIds, { pointsToWin: 21, loserScoreCap: 9 }),
      loadUserMatchHistory(env, uniqueUserIds),
      loadCompletedSeasonOutcomeCounts(env, uniqueUserIds, nowIso),
      loadCompletedTournamentOutcomeCounts(env, uniqueUserIds),
    ]);
  const historyStats = computeMatchHistoryStats(historyRows);
  const singlesCountMap = new Map(matchTypeRows.map((row) => [row.user_id, Number(row.singles_count)]));
  const doublesCountMap = new Map(matchTypeRows.map((row) => [row.user_id, Number(row.doubles_count)]));
  const seasonsPlayedMap = new Map(seasonsPlayedRows.map((row) => [row.user_id, Number(row.played_count)]));
  const tournamentsPlayedMap = new Map(tournamentsPlayedRows.map((row) => [row.user_id, Number(row.played_count)]));
  const allRounderCount = new Map(
    uniqueUserIds.map((userId) => [
      userId,
      [
        (singlesCountMap.get(userId) ?? 0) > 0,
        (doublesCountMap.get(userId) ?? 0) > 0,
        (seasonsPlayedMap.get(userId) ?? 0) > 0,
        (tournamentsPlayedMap.get(userId) ?? 0) > 0,
      ].filter(Boolean).length,
    ]),
  );

  return {
    users,
    seasonsCreated: new Map(seasonsCreatedRows.map((row) => [row.user_id, Number(row.created_count)])),
    tournamentsCreated: new Map(tournamentsCreatedRows.map((row) => [row.user_id, Number(row.created_count)])),
    seasonsPlayed: seasonsPlayedMap,
    tournamentsPlayed: tournamentsPlayedMap,
    singlesCount: singlesCountMap,
    doublesCount: doublesCountMap,
    perfect11Count: new Map(perfect11Rows.map((row) => [row.user_id, Number(row.count)])),
    perfect21Count: new Map(perfect21Rows.map((row) => [row.user_id, Number(row.count)])),
    blowout11Count: new Map(blowout11Rows.map((row) => [row.user_id, Number(row.count)])),
    blowout21Count: new Map(blowout21Rows.map((row) => [row.user_id, Number(row.count)])),
    marathonMatchCount: historyStats.marathonMatchCount,
    luckyNumbersCount: historyStats.luckyNumbersCount,
    mirrorMatchCount: historyStats.mirrorMatchCount,
    stylePointsCount: historyStats.stylePointsCount,
    squadPartnerCount: historyStats.squadPartnerCount,
    rivalMatchesMax: historyStats.rivalMatchesMax,
    unbeatenRunMax: historyStats.unbeatenRunMax,
    weeklyMatchStreak: historyStats.weeklyMatchStreak,
    comebackWinsCount: historyStats.comebackWinsCount,
    deuceWinsCount: historyStats.deuceWinsCount,
    decidingSetWinsCount: historyStats.decidingSetWinsCount,
    clutchComebackCount: historyStats.clutchComebackCount,
    upsetVictoryCount: new Map(),
    seasonWinnerCount: seasonOutcomeCounts.seasonWinnerCount,
    seasonPodiumCount: seasonOutcomeCounts.seasonPodiumCount,
    spring2026ChampionCount: seasonOutcomeCounts.spring2026ChampionCount,
    spring2026Top3Count: seasonOutcomeCounts.spring2026Top3Count,
    tournamentWinnerCount: tournamentOutcomeCounts.tournamentWinnerCount,
    tournamentFinalCount: tournamentOutcomeCounts.tournamentFinalCount,
    rankDynastyCount: new Map(),
    topTenDefenderCount: new Map(),
    completionist25Count: new Map(),
    completionist50Count: new Map(),
    completionist75Count: new Map(),
    allRounderCount,
  };
}

export async function rebuildAchievementsForUsers(
  env: Env,
  userIds: string[],
  nowIso = isoNow(env.runtime),
): Promise<void> {
  await ensureAchievementCatalog(env);

  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) {
    return;
  }

  const data = await loadAchievementRebuildData(env, uniqueUserIds, nowIso);
  const mutations: AchievementProgressMutation[] = data.users.flatMap((user) =>
    buildAchievementState(user, nowIso, data).map((achievement) => ({
      userId: user.id,
      achievementKey: achievement.key,
      progressValue: achievement.progressValue,
      progressTarget: achievement.progressTarget,
      unlock: achievement.unlock,
      context: achievement.context,
    })),
  );

  await flushAchievementProgressMutations(env, mutations, nowIso);
  await evaluateCollectionMilestones(env, uniqueUserIds, nowIso);
}

export async function evaluateAchievementsForTrigger(env: Env, trigger: AchievementTrigger): Promise<void> {
  await ensureAchievementCatalog(env);

  switch (trigger.type) {
    case "bootstrap":
      await unlockSimpleAchievement(env, trigger.userId, "account_created", trigger.nowIso);
      await evaluateTimeMilestones(env, trigger.userId, trigger.nowIso);
      await evaluateCollectionMilestones(env, [trigger.userId], trigger.nowIso);
      break;
    case "season_created":
      await evaluateCreationMilestones(env, "seasons", [trigger.actorUserId], trigger.nowIso);
      await evaluateCollectionMilestones(env, [trigger.actorUserId], trigger.nowIso);
      break;
    case "tournament_created":
      await evaluateCreationMilestones(env, "tournaments", [trigger.actorUserId], trigger.nowIso);
      await evaluateCollectionMilestones(env, [trigger.actorUserId], trigger.nowIso);
      break;
    case "match_created":
      if (trigger.matchType) {
        await evaluateIncrementalMatchMilestones(env, trigger);
      } else {
        await evaluateLegacyMatchMilestones(env, trigger.userIds, trigger.nowIso);
      }
      await evaluateScorelineMilestones(env, trigger.userIds, trigger.nowIso);
      await evaluateAdvancedMatchMilestones(env, trigger);
      await evaluateCompetitiveFinishMilestones(env, trigger.userIds, trigger.nowIso);
      await evaluateCollectionMilestones(env, trigger.userIds, trigger.nowIso);
      break;
    case "rankings_recomputed":
      await evaluateRankMilestones(env, trigger.userIds, trigger.nowIso);
      await evaluateRankStreakMilestones(env, trigger.userIds, trigger.nowIso);
      await evaluateCompetitiveFinishMilestones(env, trigger.userIds, trigger.nowIso);
      await evaluateCollectionMilestones(env, trigger.userIds, trigger.nowIso);
      break;
  }
}

type AchievementJobRow = {
  id: string;
  payload_json: string;
};

export async function processPendingAchievementJobs(env: Env, limit = 25): Promise<{ processed: number; failed: number }> {
  const rows = await env.DB.prepare(
    `
      SELECT id, payload_json
      FROM achievement_jobs
      ORDER BY created_at ASC, id ASC
      LIMIT ?1
    `,
  )
    .bind(limit)
    .all<AchievementJobRow>();

  let processed = 0;
  let failed = 0;

  for (const row of rows.results) {
    const attemptedAt = isoNow(env.runtime);
    try {
      const trigger = JSON.parse(row.payload_json) as AchievementTrigger;
      await evaluateAchievementsForTrigger(env, trigger);
      await env.DB.prepare(`DELETE FROM achievement_jobs WHERE id = ?1`).bind(row.id).run();
      processed += 1;
    } catch (error) {
      failed += 1;
      await env.DB.prepare(
        `
          UPDATE achievement_jobs
          SET attempts = attempts + 1,
              last_attempted_at = ?2,
              last_error = ?3
          WHERE id = ?1
        `,
      )
        .bind(row.id, attemptedAt, error instanceof Error ? error.message : "Unknown achievement job failure.")
        .run();
    }
  }

  return { processed, failed };
}

export async function getAchievementOverview(env: Env, userId: string): Promise<AchievementOverview> {
  await ensureAchievementCatalog(env);
  const nowIso = isoNow(env.runtime);

  const [rows, user] = await Promise.all([
    env.DB.prepare(
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
      >(),
    env.DB.prepare(
      `
        SELECT created_at
        FROM users
        WHERE id = ?1
      `,
    )
      .bind(userId)
      .first<{ created_at: string | null }>(),
  ]);

  const iconByKey = new Map(ACHIEVEMENTS.map((achievement) => [achievement.key, achievement.icon]));
  const itemRows = buildTimeMilestoneOverlay(rows.results, {
    createdAt: user?.created_at ?? null,
    nowIso,
  });
  const items = itemRows.map((row) =>
    mapAchievementRow({
      ...row,
      icon: iconByKey.get(row.key) ?? "user_plus",
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
    items,
    recentUnlocks,
    featured,
    nextUp,
  };
}
