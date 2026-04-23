import { parseJsonArray } from "../db";
import { successResponse } from "../responses";
import { calculateSeasonScore, MINIMUM_LEADERBOARD_MATCHES } from "../services/elo";
import { buildVisibleSeasonsSql, buildVisibleTournamentsSql, getRecentCompletionCutoffDate } from "../services/visibility";
import type {
  ApiRequest,
  Env,
  GetProfileSegmentSummariesPayload,
  LeaderboardEntry,
  ProfileSegmentSummaryRecord,
  SegmentType,
  SeasonRow,
  TournamentRow,
  UserRow,
} from "../types";

type SegmentRatingRow = {
  segment_id: string;
  user_id: string;
  elo: number;
  matches_played: number;
  matches_played_equivalent: number;
  wins: number;
  losses: number;
  streak: number;
  best_win_streak: number;
  highest_score: number;
  last_match_at: string;
  season_glicko_rating: number | null;
  season_glicko_rd: number | null;
  season_conservative_rating: number | null;
  season_attended_weeks: number;
  season_total_weeks: number;
  season_attendance_penalty: number;
  display_name: string;
};

type VisibleSeasonRow = Pick<SeasonRow, "id" | "participant_ids_json">;

type VisibleTournamentRow = Pick<TournamentRow, "id"> & {
  participant_count: number;
};

type TournamentBracketRow = {
  tournament_id: string;
  round_index: number;
  left_player_id: string | null;
  right_player_id: string | null;
  winner_player_id: string | null;
  is_final: number;
};

type TournamentPlacementMetrics = {
  stageReached: Record<string, number>;
  bracketWins: Record<string, number>;
  bracketLosses: Record<string, number>;
  championIds: Set<string>;
};

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0))].slice(0, 100);
}

function buildInClausePlaceholders(count: number, offset = 1): string {
  return Array.from({ length: count }, (_, index) => `?${index + offset}`).join(", ");
}

function buildTournamentPlacementMetrics(rows: TournamentBracketRow[]): TournamentPlacementMetrics {
  const metrics: TournamentPlacementMetrics = {
    stageReached: {},
    bracketWins: {},
    bracketLosses: {},
    championIds: new Set<string>(),
  };

  rows.forEach((match) => {
    const stageReached = Number(match.round_index) + 1;
    const participants = [match.left_player_id, match.right_player_id].filter((playerId): playerId is string => Boolean(playerId));

    participants.forEach((playerId) => {
      metrics.stageReached[playerId] = Math.max(metrics.stageReached[playerId] ?? 0, stageReached);
    });

    if (!match.winner_player_id) {
      return;
    }

    metrics.bracketWins[match.winner_player_id] = (metrics.bracketWins[match.winner_player_id] ?? 0) + 1;
    if (Boolean(match.is_final)) {
      metrics.championIds.add(match.winner_player_id);
    }

    const loserId = participants.find((playerId) => playerId !== match.winner_player_id) ?? null;
    if (loserId) {
      metrics.bracketLosses[loserId] = (metrics.bracketLosses[loserId] ?? 0) + 1;
    }
  });

  return metrics;
}

function getTournamentPlacementLabel(
  metrics: TournamentPlacementMetrics,
  rounds: number[],
  userId: string,
): { key: LeaderboardEntry["placementLabelKey"]; count: number | null } | null {
  if (metrics.championIds.has(userId)) {
    return { key: "leaderboardPlacementWinner", count: null };
  }

  const stageReached = metrics.stageReached[userId] ?? 0;
  if (stageReached <= 0) {
    return null;
  }

  const matchCount = rounds[stageReached - 1] ?? 0;
  if (matchCount === 1) {
    return { key: "leaderboardPlacementFinal", count: null };
  }
  if (matchCount === 2) {
    return { key: "leaderboardPlacementSemifinals", count: null };
  }
  if (matchCount === 4) {
    return { key: "leaderboardPlacementQuarterfinals", count: null };
  }

  return {
    key: "leaderboardPlacementRoundOf",
    count: matchCount > 0 ? matchCount * 2 : null,
  };
}

function mapSeasonEntries(rows: SegmentRatingRow[]): LeaderboardEntry[] {
  return rows.map<LeaderboardEntry>((row) => {
    const matchEquivalentPlayed = Number(row.matches_played_equivalent ?? row.matches_played ?? 0);
    const seasonGlickoRating = row.season_glicko_rating === null ? undefined : Number(row.season_glicko_rating);
    const seasonGlickoRd = row.season_glicko_rd === null ? undefined : Number(row.season_glicko_rd);
    const seasonAttendancePenalty = Number(row.season_attendance_penalty ?? 0);
    const currentSeasonScore = calculateSeasonScore({
      rating: seasonGlickoRating ?? Number(row.elo),
      rd: seasonGlickoRd ?? 0,
      attendancePenalty: seasonAttendancePenalty,
    });

    return {
      userId: row.user_id,
      displayName: row.display_name,
      avatarUrl: null,
      elo: Number(row.elo),
      wins: Number(row.wins),
      losses: Number(row.losses),
      streak: Number(row.streak),
      bestWinStreak: Number(row.best_win_streak ?? 0),
      highestScore: Math.max(Number(row.highest_score ?? 0), Number(currentSeasonScore ?? 0)),
      matchEquivalentPlayed,
      lastMatchAt: row.last_match_at || null,
      seasonGlickoRating,
      seasonGlickoRd,
      seasonConservativeRating:
        row.season_conservative_rating === null ? undefined : Number(row.season_conservative_rating),
      seasonAttendancePenalty,
      seasonAttendedWeeks: Number(row.season_attended_weeks ?? 0),
      seasonTotalWeeks: Number(row.season_total_weeks ?? 0),
      seasonScore: currentSeasonScore,
      isQualified: matchEquivalentPlayed >= MINIMUM_LEADERBOARD_MATCHES,
      rank: 0,
    };
  });
}

function sortSeasonEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .slice()
    .sort((left, right) => {
      const leftMatches = Number(left.matchEquivalentPlayed ?? left.wins + left.losses);
      const rightMatches = Number(right.matchEquivalentPlayed ?? right.wins + right.losses);
      const leftQualified = leftMatches >= MINIMUM_LEADERBOARD_MATCHES;
      const rightQualified = rightMatches >= MINIMUM_LEADERBOARD_MATCHES;

      if (leftQualified !== rightQualified) {
        return Number(rightQualified) - Number(leftQualified);
      }
      if (!leftQualified) {
        if (rightMatches !== leftMatches) {
          return rightMatches - leftMatches;
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
      }

      const leftSeasonScore = left.seasonScore ?? left.elo;
      const rightSeasonScore = right.seasonScore ?? right.elo;
      if (rightSeasonScore !== leftSeasonScore) {
        return rightSeasonScore - leftSeasonScore;
      }
      if ((right.seasonConservativeRating ?? 0) !== (left.seasonConservativeRating ?? 0)) {
        return (right.seasonConservativeRating ?? 0) - (left.seasonConservativeRating ?? 0);
      }
      if ((right.seasonGlickoRating ?? 0) !== (left.seasonGlickoRating ?? 0)) {
        return (right.seasonGlickoRating ?? 0) - (left.seasonGlickoRating ?? 0);
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
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function sortTournamentEntries(
  entries: LeaderboardEntry[],
  metrics: TournamentPlacementMetrics,
): LeaderboardEntry[] {
  return entries
    .slice()
    .sort((left, right) => {
      const rightChampion = metrics.championIds.has(right.userId);
      const leftChampion = metrics.championIds.has(left.userId);
      if (rightChampion !== leftChampion) {
        return Number(rightChampion) - Number(leftChampion);
      }

      const leftStageReached = metrics.stageReached[left.userId] ?? 0;
      const rightStageReached = metrics.stageReached[right.userId] ?? 0;
      if (rightStageReached !== leftStageReached) {
        return rightStageReached - leftStageReached;
      }

      const leftWins = metrics.bracketWins[left.userId] ?? 0;
      const rightWins = metrics.bracketWins[right.userId] ?? 0;
      if (rightWins !== leftWins) {
        return rightWins - leftWins;
      }

      const leftLosses = metrics.bracketLosses[left.userId] ?? 0;
      const rightLosses = metrics.bracketLosses[right.userId] ?? 0;
      if (leftLosses !== rightLosses) {
        return leftLosses - rightLosses;
      }

      return left.displayName.localeCompare(right.displayName);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

async function loadSegmentRatings(
  env: Env,
  segmentType: SegmentType,
  segmentIds: string[],
): Promise<Map<string, SegmentRatingRow[]>> {
  if (segmentIds.length === 0) {
    return new Map();
  }

  const placeholders = buildInClausePlaceholders(segmentIds.length, 2);
  const result = await env.DB.prepare(
    `
      SELECT
        es.segment_id,
        es.user_id,
        es.elo,
        es.matches_played,
        es.matches_played_equivalent,
        es.wins,
        es.losses,
        es.streak,
        es.best_win_streak,
        es.highest_score,
        es.last_match_at,
        es.season_glicko_rating,
        es.season_glicko_rd,
        es.season_conservative_rating,
        es.season_attended_weeks,
        es.season_total_weeks,
        es.season_attendance_penalty,
        u.display_name
      FROM elo_segments es
      JOIN users u
        ON u.id = es.user_id
      WHERE es.segment_type = ?1
        AND es.segment_id IN (${placeholders})
    `,
  )
    .bind(segmentType, ...segmentIds)
    .all<SegmentRatingRow>();

  const grouped = new Map<string, SegmentRatingRow[]>();
  result.results.forEach((row) => {
    const rows = grouped.get(row.segment_id) ?? [];
    rows.push(row);
    grouped.set(row.segment_id, rows);
  });
  return grouped;
}

async function loadVisibleSeasons(env: Env, sessionUserId: string, seasonIds: string[]): Promise<VisibleSeasonRow[]> {
  if (seasonIds.length === 0) {
    return [];
  }

  const placeholders = buildInClausePlaceholders(seasonIds.length, 3);
  const result = await env.DB.prepare(
    `
      WITH visible AS (
        ${buildVisibleSeasonsSql()}
      )
      SELECT id, participant_ids_json
      FROM visible
      WHERE id IN (${placeholders})
    `,
  )
    .bind(sessionUserId, getRecentCompletionCutoffDate(env.runtime), ...seasonIds)
    .all<VisibleSeasonRow>();

  return result.results;
}

async function loadVisibleTournaments(
  env: Env,
  sessionUserId: string,
  tournamentIds: string[],
): Promise<VisibleTournamentRow[]> {
  if (tournamentIds.length === 0) {
    return [];
  }

  const placeholders = buildInClausePlaceholders(tournamentIds.length, 3);
  const result = await env.DB.prepare(
    `
      WITH visible AS (
        ${buildVisibleTournamentsSql()}
      ),
      participant_summary AS (
        SELECT tournament_id, COUNT(*) AS participant_count
        FROM tournament_participants
        GROUP BY tournament_id
      )
      SELECT v.id, COALESCE(ps.participant_count, 0) AS participant_count
      FROM visible v
      LEFT JOIN participant_summary ps
        ON ps.tournament_id = v.id
      WHERE v.id IN (${placeholders})
    `,
  )
    .bind(sessionUserId, getRecentCompletionCutoffDate(env.runtime), ...tournamentIds)
    .all<VisibleTournamentRow>();

  return result.results;
}

async function loadTournamentBrackets(
  env: Env,
  tournamentIds: string[],
): Promise<Map<string, TournamentBracketRow[]>> {
  if (tournamentIds.length === 0) {
    return new Map();
  }

  const placeholders = buildInClausePlaceholders(tournamentIds.length);
  const result = await env.DB.prepare(
    `
      SELECT tournament_id, round_index, left_player_id, right_player_id, winner_player_id, is_final
      FROM tournament_bracket_matches
      WHERE tournament_id IN (${placeholders})
      ORDER BY tournament_id ASC, round_index ASC, match_index ASC
    `,
  )
    .bind(...tournamentIds)
    .all<TournamentBracketRow>();

  const grouped = new Map<string, TournamentBracketRow[]>();
  result.results.forEach((row) => {
    const rows = grouped.get(row.tournament_id) ?? [];
    rows.push(row);
    grouped.set(row.tournament_id, rows);
  });
  return grouped;
}

export async function handleGetProfileSegmentSummaries(
  request: ApiRequest<"getProfileSegmentSummaries", GetProfileSegmentSummariesPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const seasonIds = normalizeIds(request.payload?.seasonIds);
  const tournamentIds = normalizeIds(request.payload?.tournamentIds);

  const [visibleSeasons, visibleTournaments, seasonRatings, tournamentRatings, tournamentBrackets] = await Promise.all([
    loadVisibleSeasons(env, sessionUser.id, seasonIds),
    loadVisibleTournaments(env, sessionUser.id, tournamentIds),
    loadSegmentRatings(env, "season", seasonIds),
    loadSegmentRatings(env, "tournament", tournamentIds),
    loadTournamentBrackets(env, tournamentIds),
  ]);

  const summaries: ProfileSegmentSummaryRecord[] = [];

  visibleSeasons.forEach((season) => {
    const ranked = sortSeasonEntries(mapSeasonEntries(seasonRatings.get(season.id) ?? []));
    const currentEntry = ranked.find((entry) => entry.userId === sessionUser.id);
    summaries.push({
      segmentType: "season",
      segmentId: season.id,
      wins: currentEntry?.wins ?? 0,
      losses: currentEntry?.losses ?? 0,
      rank: currentEntry?.rank ?? null,
      participantCount: parseJsonArray<string>(season.participant_ids_json).length,
    });
  });

  visibleTournaments.forEach((tournament) => {
    const bracketRows = tournamentBrackets.get(tournament.id) ?? [];
    const metrics = buildTournamentPlacementMetrics(bracketRows);
    const roundMatchCounts = bracketRows.reduce<number[]>((counts, row) => {
      counts[row.round_index] = (counts[row.round_index] ?? 0) + 1;
      return counts;
    }, []);
    const ranked = sortTournamentEntries(
      (tournamentRatings.get(tournament.id) ?? []).map<LeaderboardEntry>((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        avatarUrl: null,
        elo: Number(row.elo),
        wins: Number(row.wins),
        losses: Number(row.losses),
        streak: Number(row.streak),
        rank: 0,
        ...(() => {
          const placement = getTournamentPlacementLabel(metrics, roundMatchCounts, row.user_id);
          return placement
            ? {
                placementLabelKey: placement.key,
                placementLabelCount: placement.count,
              }
            : {};
        })(),
      })),
      metrics,
    );
    const currentEntry = ranked.find((entry) => entry.userId === sessionUser.id);

    summaries.push({
      segmentType: "tournament",
      segmentId: tournament.id,
      wins: currentEntry?.wins ?? 0,
      losses: currentEntry?.losses ?? 0,
      rank: currentEntry?.rank ?? null,
      participantCount: Number(tournament.participant_count ?? 0),
      placementLabelKey: currentEntry?.placementLabelKey,
      placementLabelCount: currentEntry?.placementLabelCount ?? null,
    });
  });

  return successResponse(request.requestId, { summaries });
}
