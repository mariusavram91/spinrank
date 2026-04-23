import { decodeCursor, encodeCursor, isoNow, parseJsonArray, parseJsonObject } from "../db";
import { errorResponse, successResponse } from "../responses";
import { loadProfileSegmentSummariesForUser } from "./getProfileSegmentSummaries";
import { getAchievementOverview } from "../services/achievements";
import { MINIMUM_LEADERBOARD_MATCHES } from "../services/elo";
import { mapMatchRecordRow } from "../services/matchGuards";
import { getProfileActivityHeatmap } from "../services/profileActivity";
import { buildVisibleSeasonsSql, buildVisibleTournamentsSql, getRecentCompletionCutoffDate } from "../services/visibility";
import type {
  ApiRequest,
  Env,
  GetSharedUserProfilePayload,
  LeaderboardEntry,
  MatchRecord,
  SeasonRecord,
  SharedUserSeasonRecord,
  SharedUserTournamentRecord,
  TournamentRecord,
  UserProgressPoint,
  UserRow,
} from "../types";

type MatchRow = {
  id: string;
  match_type: MatchRecord["matchType"];
  format_type: MatchRecord["formatType"];
  points_to_win: number;
  team_a_player_ids_json: string;
  team_b_player_ids_json: string;
  score_json: string;
  winner_team: MatchRecord["winnerTeam"];
  played_at: string;
  season_id: string | null;
  tournament_id: string | null;
  created_by_user_id: string;
  status: MatchRecord["status"];
  created_at: string;
  delete_locked_at: string | null;
  has_active_dispute: number;
  round_title: string | null;
  is_final: number | null;
};

type MatchCursor = {
  playedAt: string;
  createdAt: string;
  id: string;
} | null;

const clampLimit = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 8;
  }
  return Math.max(1, Math.min(50, Math.trunc(Number(value))));
};

const MAX_SHARED_PROFILE_PROGRESS_POINTS = 120;

const sampleProgressPointsByExtrema = (points: UserProgressPoint[], maxPoints: number): UserProgressPoint[] => {
  if (points.length <= maxPoints || maxPoints <= 0) {
    return [...points];
  }
  if (maxPoints === 1) {
    return [points[points.length - 1]];
  }
  if (maxPoints === 2) {
    return [points[0], points[points.length - 1]];
  }

  const first = points[0];
  const last = points[points.length - 1];
  const interior = points.slice(1, -1);
  const interiorBudget = maxPoints - 2;
  if (interior.length <= interiorBudget) {
    return [first, ...interior, last];
  }

  const pickByBaseline = (pool: Array<{ point: UserProgressPoint; index: number }>, limit: number): number[] => {
    const slope = (last.elo - first.elo) / Math.max(points.length - 1, 1);
    return [...pool]
      .sort((left, right) => {
        const leftExpected = first.elo + slope * (left.index + 1);
        const rightExpected = first.elo + slope * (right.index + 1);
        const leftScore = Math.abs(left.point.elo - leftExpected);
        const rightScore = Math.abs(right.point.elo - rightExpected);
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }
        return left.index - right.index;
      })
      .slice(0, limit)
      .map((entry) => entry.index);
  };

  if (interiorBudget === 1) {
    const [index] = pickByBaseline(interior.map((point, index) => ({ point, index })), 1);
    return [first, interior[index], last];
  }

  const selectedInterior = new Set<number>();
  const bucketCount = Math.max(1, Math.floor(interiorBudget / 2));
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor((bucket * interior.length) / bucketCount);
    const end = Math.floor(((bucket + 1) * interior.length) / bucketCount);
    if (end <= start) {
      continue;
    }

    let minIndex = start;
    let maxIndex = start;
    for (let cursor = start + 1; cursor < end; cursor += 1) {
      if (interior[cursor].elo < interior[minIndex].elo) {
        minIndex = cursor;
      }
      if (interior[cursor].elo > interior[maxIndex].elo) {
        maxIndex = cursor;
      }
    }

    selectedInterior.add(minIndex);
    selectedInterior.add(maxIndex);
  }

  if (selectedInterior.size > interiorBudget) {
    const narrowed = pickByBaseline(
      [...selectedInterior].map((index) => ({ point: interior[index], index })),
      interiorBudget,
    );
    selectedInterior.clear();
    narrowed.forEach((index) => selectedInterior.add(index));
  }

  if (selectedInterior.size < interiorBudget) {
    const remaining = interior
      .map((point, index) => ({ point, index }))
      .filter((entry) => !selectedInterior.has(entry.index));
    const fill = pickByBaseline(remaining, interiorBudget - selectedInterior.size);
    fill.forEach((index) => selectedInterior.add(index));
  }

  const orderedInterior = [...selectedInterior].sort((left, right) => left - right).map((index) => interior[index]);
  return [first, ...orderedInterior, last];
};

const buildSharedUserProgressPoints = async (
  env: Env,
  viewerUserId: string,
  targetUserId: string,
  currentElo: number,
): Promise<UserProgressPoint[]> => {
  const progressRows = await env.DB.prepare(
    `
      SELECT m.played_at, m.global_elo_delta_json
      FROM match_players mp
      JOIN matches m
        ON m.id = mp.match_id
      LEFT JOIN seasons s
        ON s.id = m.season_id
      LEFT JOIN season_participants sp
        ON sp.season_id = m.season_id AND sp.user_id = ?1
      LEFT JOIN tournaments t
        ON t.id = m.tournament_id
      LEFT JOIN tournament_participants tp
        ON tp.tournament_id = m.tournament_id AND tp.user_id = ?1
      WHERE mp.user_id = ?2
        AND m.status = 'active'
        AND (
          (m.season_id IS NULL AND m.tournament_id IS NULL)
          OR (m.tournament_id IS NOT NULL AND (t.created_by_user_id = ?1 OR tp.user_id IS NOT NULL))
          OR (m.tournament_id IS NULL AND m.season_id IS NOT NULL AND (
            s.is_public = 1 OR s.created_by_user_id = ?1 OR sp.user_id IS NOT NULL
          ))
        )
      ORDER BY m.played_at ASC, m.created_at ASC, m.id ASC
    `,
  )
    .bind(viewerUserId, targetUserId)
    .all<{
      played_at: string;
      global_elo_delta_json: string;
    }>();

  const deltas = progressRows.results.map((row) => {
    const deltaMap = parseJsonObject<Record<string, number>>(row.global_elo_delta_json, {});
    return {
      playedAt: row.played_at,
      delta: Number(deltaMap[targetUserId] || 0),
    };
  });

  let elo = currentElo - deltas.reduce((total, item) => total + item.delta, 0);
  const points: UserProgressPoint[] = deltas.map((item) => {
    elo += item.delta;
    return {
      playedAt: item.playedAt,
      elo,
      delta: item.delta,
      label: item.playedAt,
      rank: null,
    };
  });

  const resolved =
    points.length > 0
      ? points
      : [
          {
            playedAt: isoNow(env.runtime),
            elo: currentElo,
            delta: 0,
            label: "current",
            rank: null,
          },
        ];

  return sampleProgressPointsByExtrema(resolved, MAX_SHARED_PROFILE_PROGRESS_POINTS);
};

const buildInClausePlaceholders = (count: number): string =>
  Array.from({ length: count }, (_, index) => `?${index + 1}`).join(", ");

const buildCursorPredicate = (alias: string): string => `
  ?3 IS NULL
  OR ${alias}.played_at < ?3
  OR (${alias}.played_at = ?3 AND ${alias}.created_at < ?4)
  OR (${alias}.played_at = ?3 AND ${alias}.created_at = ?4 AND ${alias}.id < ?5)
`;

const buildSelectColumns = (): string => `
  m.id,
  m.match_type,
  m.format_type,
  m.points_to_win,
  m.team_a_player_ids_json,
  m.team_b_player_ids_json,
  m.score_json,
  m.winner_team,
  m.played_at,
  m.season_id,
  m.tournament_id,
  m.created_by_user_id,
  m.status,
  m.created_at,
  m.delete_locked_at,
  m.has_active_dispute,
  tbm.round_title,
  tbm.is_final
`;

const buildVisibilityJoins = (): string => `
  LEFT JOIN seasons s
    ON s.id = m.season_id
  LEFT JOIN season_participants sp
    ON sp.season_id = m.season_id AND sp.user_id = ?1
  LEFT JOIN tournaments t
    ON t.id = m.tournament_id
  LEFT JOIN tournament_participants tp
    ON tp.tournament_id = m.tournament_id AND tp.user_id = ?1
  LEFT JOIN tournament_bracket_matches tbm
    ON tbm.created_match_id = m.id
`;

const buildVisibilityPredicate = (): string => `
  m.status = 'active'
  AND (s.id IS NULL OR s.status != 'deleted')
  AND (t.id IS NULL OR t.status != 'deleted')
  AND (
    (m.season_id IS NULL AND m.tournament_id IS NULL)
    OR (m.tournament_id IS NOT NULL AND (t.created_by_user_id = ?1 OR tp.user_id IS NOT NULL))
    OR (m.tournament_id IS NULL AND m.season_id IS NOT NULL AND (
      s.is_public = 1 OR s.created_by_user_id = ?1 OR sp.user_id IS NOT NULL
    ))
  )
`;

const mapMatchRow = (row: MatchRow): MatchRecord => ({
  ...mapMatchRecordRow(row),
  bracketContext: row.round_title
    ? {
        roundTitle: row.round_title,
        isFinal: Boolean(row.is_final),
      }
    : null,
});

const loadPlayersForMatches = async (env: Env, rows: MatchRow[]): Promise<LeaderboardEntry[]> => {
  const userIds = [...new Set(rows.flatMap((row) => [
    ...parseJsonArray<string>(row.team_a_player_ids_json),
    ...parseJsonArray<string>(row.team_b_player_ids_json),
  ]))];

  if (userIds.length === 0) {
    return [];
  }

  const result = await env.DB.prepare(
    `
      SELECT id, display_name, avatar_url, global_elo, wins, losses, streak
      FROM users
      WHERE id IN (${buildInClausePlaceholders(userIds.length)})
    `,
  )
    .bind(...userIds)
    .all<{
      id: string;
      display_name: string;
      avatar_url: string | null;
      global_elo: number;
      wins: number;
      losses: number;
      streak: number;
    }>();

  return result.results.map((row, index) => ({
    userId: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    elo: Number(row.global_elo),
    wins: Number(row.wins),
    losses: Number(row.losses),
    streak: Number(row.streak),
    rank: index + 1,
  }));
};

export async function handleGetSharedUserProfile(
  request: ApiRequest<"getSharedUserProfile", GetSharedUserProfilePayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const targetUserId = String(request.payload?.userId || "").trim();
  if (!targetUserId) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "getSharedUserProfile requires userId.");
  }

  const limit = clampLimit(request.payload?.limit);
  const cursor = request.payload?.cursor ? decodeCursor(request.payload.cursor) : null;
  const targetUser = await env.DB.prepare(
    `
      SELECT id, display_name, avatar_url, global_elo
           , best_win_streak
      FROM users
      WHERE id = ?1
    `,
  )
    .bind(targetUserId)
    .first<{
      id: string;
      display_name: string;
      avatar_url: string | null;
      global_elo: number;
      best_win_streak: number;
    }>();

  if (!targetUser) {
    return errorResponse(request.requestId, "NOT_FOUND", "User not found.");
  }

  const cutoff = getRecentCompletionCutoffDate(env.runtime);
  const [rankRow, achievementOverview, activityHeatmap, sharedUserProgressPoints, seasonRows, tournamentRows, matchRows] = await Promise.all([
    env.DB.prepare(
      `
        SELECT rank
        FROM (
          SELECT
            id,
            ROW_NUMBER() OVER (
              ORDER BY
                CASE WHEN wins + losses >= ${MINIMUM_LEADERBOARD_MATCHES} THEN 0 ELSE 1 END ASC,
                CASE WHEN wins + losses >= ${MINIMUM_LEADERBOARD_MATCHES} THEN global_elo END DESC,
                CASE WHEN wins + losses >= ${MINIMUM_LEADERBOARD_MATCHES} THEN wins END DESC,
                CASE WHEN wins + losses >= ${MINIMUM_LEADERBOARD_MATCHES} THEN losses END ASC,
                CASE WHEN wins + losses < ${MINIMUM_LEADERBOARD_MATCHES} THEN wins + losses END DESC,
                CASE WHEN wins + losses < ${MINIMUM_LEADERBOARD_MATCHES} THEN global_elo END DESC,
                CASE WHEN wins + losses < ${MINIMUM_LEADERBOARD_MATCHES} THEN wins END DESC,
                CASE WHEN wins + losses < ${MINIMUM_LEADERBOARD_MATCHES} THEN losses END ASC,
                display_name ASC
            ) AS rank
          FROM users
        )
        WHERE id = ?1
      `,
    )
      .bind(targetUserId)
      .first<{ rank: number }>(),
    getAchievementOverview(env, targetUserId),
    getProfileActivityHeatmap(env, sessionUser.id, targetUserId),
    buildSharedUserProgressPoints(env, sessionUser.id, targetUserId, Number(targetUser.global_elo)),
    env.DB.prepare(
      `
        WITH visible AS (
          ${buildVisibleSeasonsSql()}
        )
        SELECT v.*
        FROM visible v
        JOIN season_participants target_sp
          ON target_sp.season_id = v.id
         AND target_sp.user_id = ?3
        ORDER BY v.is_active DESC, v.start_date DESC, v.id DESC
      `,
    )
      .bind(sessionUser.id, cutoff, targetUserId)
      .all<{
        id: string;
        name: string;
        start_date: string;
        end_date: string;
        is_active: number;
        status: SeasonRecord["status"];
        base_elo_mode: SeasonRecord["baseEloMode"];
        participant_ids_json: string;
        created_by_user_id: string | null;
        created_at: string;
        completed_at: string | null;
        is_public: number;
      }>(),
    env.DB.prepare(
      `
        WITH visible AS (
          ${buildVisibleTournamentsSql()}
        ),
        participant_summary AS (
          SELECT
            tp.tournament_id,
            json_group_array(tp.user_id) AS participant_ids_json,
            COUNT(*) AS participant_count
          FROM (
            SELECT tournament_id, user_id
            FROM tournament_participants
            ORDER BY tournament_id ASC, user_id ASC
          ) tp
          GROUP BY tp.tournament_id
        ),
        bracket_summary AS (
          SELECT
            tbm.tournament_id,
            MAX(CASE WHEN tbm.is_final = 1 AND tbm.winner_player_id IS NOT NULL THEN 1 ELSE 0 END) AS has_completed_final,
            MAX(CASE WHEN tbm.created_match_id IS NOT NULL OR tbm.winner_player_id IS NOT NULL THEN 1 ELSE 0 END) AS has_progress
          FROM tournament_bracket_matches tbm
          GROUP BY tbm.tournament_id
        )
        SELECT
          v.*,
          s.name AS season_name,
          ps.participant_ids_json,
          COALESCE(ps.participant_count, 0) AS participant_count,
          CASE
            WHEN COALESCE(bs.has_completed_final, 0) = 1 THEN 'completed'
            WHEN COALESCE(bs.has_progress, 0) = 1 THEN 'in_progress'
            ELSE 'draft'
          END AS bracket_status
        FROM visible v
        JOIN tournament_participants target_tp
          ON target_tp.tournament_id = v.id
         AND target_tp.user_id = ?3
        LEFT JOIN seasons s ON s.id = v.season_id
        LEFT JOIN participant_summary ps ON ps.tournament_id = v.id
        LEFT JOIN bracket_summary bs ON bs.tournament_id = v.id
        ORDER BY v.date DESC, v.id DESC
      `,
    )
      .bind(sessionUser.id, cutoff, targetUserId)
      .all<{
        id: string;
        name: string;
        date: string;
        status: TournamentRecord["status"];
        season_id: string | null;
        season_name: string | null;
        created_by_user_id: string | null;
        created_at: string;
        completed_at: string | null;
        participant_ids_json: string | null;
        participant_count: number;
        bracket_status: TournamentRecord["bracketStatus"];
      }>(),
    env.DB.prepare(
      `
        SELECT
          ${buildSelectColumns()}
        FROM matches m
        INNER JOIN match_players viewer_mp
          ON viewer_mp.match_id = m.id AND viewer_mp.user_id = ?1
        INNER JOIN match_players target_mp
          ON target_mp.match_id = m.id AND target_mp.user_id = ?2
        ${buildVisibilityJoins()}
        WHERE ${buildVisibilityPredicate()}
          AND (${buildCursorPredicate("m")})
        ORDER BY m.played_at DESC, m.created_at DESC, m.id DESC
        LIMIT ?6
      `,
    )
      .bind(
        sessionUser.id,
        targetUserId,
        cursor?.playedAt ?? null,
        cursor?.createdAt ?? null,
        cursor?.id ?? null,
        limit + 1,
      )
      .all<MatchRow>(),
  ]);

  const seasons = seasonRows.results.map<SeasonRecord>((row) => ({
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: Boolean(row.is_active),
    status: row.status,
    baseEloMode: row.base_elo_mode,
    participantIds: parseJsonArray<string>(row.participant_ids_json),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
    isPublic: Boolean(row.is_public),
  }));

  const tournaments = tournamentRows.results.map<TournamentRecord>((row) => ({
    id: row.id,
    name: row.name,
    date: row.date,
    seasonId: row.season_id,
    seasonName: row.season_name,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
    participantCount: Number(row.participant_count || 0),
    participantIds: row.participant_ids_json ? JSON.parse(row.participant_ids_json) : [],
    bracketStatus: row.bracket_status,
  }));

  const sharedSegmentSummaries = await loadProfileSegmentSummariesForUser({
    env,
    viewerUserId: sessionUser.id,
    targetUserId,
    seasonIds: seasons.map((season) => season.id),
    tournamentIds: tournaments.map((tournament) => tournament.id),
  });
  const sharedSegmentSummaryByKey = new Map(
    sharedSegmentSummaries.map((summary) => [`${summary.segmentType}:${summary.segmentId}`, summary] as const),
  );
  const seasonSummaries = seasons.map<SharedUserSeasonRecord>((season) => ({
    season,
    summary: sharedSegmentSummaryByKey.get(`season:${season.id}`) ?? {
      segmentType: "season",
      segmentId: season.id,
      wins: 0,
      losses: 0,
      rank: null,
      participantCount: season.participantIds.length,
    },
  }));
  const tournamentSummaries = tournaments.map<SharedUserTournamentRecord>((tournament) => ({
    tournament,
    summary: sharedSegmentSummaryByKey.get(`tournament:${tournament.id}`) ?? {
      segmentType: "tournament",
      segmentId: tournament.id,
      wins: 0,
      losses: 0,
      rank: null,
      participantCount: tournament.participantCount,
    },
  }));

  const page = matchRows.results.slice(0, limit);
  const last = page.at(-1);
  const players = await loadPlayersForMatches(env, page);

  return successResponse(request.requestId, {
    user: {
      userId: targetUser.id,
      displayName: targetUser.display_name,
      avatarUrl: targetUser.avatar_url,
      currentRank: rankRow?.rank ? Number(rankRow.rank) : null,
      currentElo: Number(targetUser.global_elo),
      bestWinStreak: Number(targetUser.best_win_streak ?? 0),
    },
    achievements: achievementOverview.items.filter((item) => item.unlockedAt),
    activityHeatmap,
    sharedUserProgressPoints,
    seasons: seasonSummaries,
    tournaments: tournamentSummaries,
    matches: page.map(mapMatchRow),
    nextCursor:
      matchRows.results.length > limit && last
        ? encodeCursor({
            playedAt: last.played_at,
            createdAt: last.created_at,
            id: last.id,
          })
        : null,
    players,
    matchBracketContextByMatchId: Object.fromEntries(
      page
        .filter((match) => Boolean(match.round_title))
        .map((match) => [
          match.id,
          {
            roundTitle: match.round_title!,
            isFinal: Boolean(match.is_final),
          },
        ]),
    ),
  });
}
