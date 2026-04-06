import { isoNow } from "../db";
import { errorResponse, successResponse } from "../responses";
import { calculateSeasonScore, MINIMUM_MATCHES_TO_QUALIFY } from "../services/elo";
import { getBracketRounds } from "../services/brackets";
import { canAccessSeason, canAccessTournament, getSeasonById, getTournamentById } from "../services/visibility";
import type {
  ApiRequest,
  Env,
  GetSegmentLeaderboardPayload,
  LeaderboardEntry,
  SegmentLeaderboardStats,
  TournamentBracketRound,
  UserRow,
} from "../types";

type TournamentPlacementMetrics = {
  stageReached: Record<string, number>;
  bracketWins: Record<string, number>;
  bracketLosses: Record<string, number>;
  championIds: Set<string>;
};

function buildTournamentPlacementMetrics(rounds: TournamentBracketRound[]): TournamentPlacementMetrics {
  const metrics: TournamentPlacementMetrics = {
    stageReached: {},
    bracketWins: {},
    bracketLosses: {},
    championIds: new Set<string>(),
  };

  rounds.forEach((round, roundIndex) => {
    const stageReached = roundIndex + 1;
    round.matches.forEach((match) => {
      const participants = [match.leftPlayerId, match.rightPlayerId].filter((playerId): playerId is string =>
        Boolean(playerId),
      );

      participants.forEach((playerId) => {
        metrics.stageReached[playerId] = Math.max(metrics.stageReached[playerId] ?? 0, stageReached);
      });

      if (!match.winnerPlayerId) {
        return;
      }

      metrics.bracketWins[match.winnerPlayerId] = (metrics.bracketWins[match.winnerPlayerId] ?? 0) + 1;
      if (match.isFinal) {
        metrics.championIds.add(match.winnerPlayerId);
      }

      const loserId = participants.find((playerId) => playerId !== match.winnerPlayerId) ?? null;
      if (loserId) {
        metrics.bracketLosses[loserId] = (metrics.bracketLosses[loserId] ?? 0) + 1;
      }
    });
  });

  return metrics;
}

function getTournamentPlacementLabel(
  rounds: TournamentBracketRound[],
  metrics: TournamentPlacementMetrics,
  userId: string,
): { key: LeaderboardEntry["placementLabelKey"]; count: number | null } | null {
  if (metrics.championIds.has(userId)) {
    return { key: "leaderboardPlacementWinner", count: null };
  }

  const stageReached = metrics.stageReached[userId] ?? 0;
  if (stageReached <= 0) {
    return null;
  }

  const round = rounds[stageReached - 1];
  if (!round) {
    return null;
  }

  const matchCount = round.matches.length;
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
    count: matchCount * 2,
  };
}

export async function handleGetSegmentLeaderboard(
  request: ApiRequest<"getSegmentLeaderboard", GetSegmentLeaderboardPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const { segmentType, segmentId } = request.payload;
  if (!segmentId || (segmentType !== "season" && segmentType !== "tournament")) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "getSegmentLeaderboard requires segmentType and segmentId.");
  }

  if (segmentType === "season") {
    const season = await getSeasonById(env, segmentId);
    if (!canAccessSeason(season, sessionUser.id)) {
      return errorResponse(request.requestId, "FORBIDDEN", "You do not have access to this season.");
    }
  } else {
    const tournament = await getTournamentById(env, segmentId);
    if (!(await canAccessTournament(env, tournament, sessionUser.id))) {
      return errorResponse(request.requestId, "FORBIDDEN", "You do not have access to this tournament.");
    }
  }

  const rows = await env.DB.prepare(
    `
      SELECT es.user_id, es.elo, es.matches_played, es.matches_played_equivalent, es.wins, es.losses,
             es.streak, es.last_match_at, es.updated_at, es.season_glicko_rating, es.season_glicko_rd,
             es.season_conservative_rating, es.season_attended_weeks, es.season_total_weeks,
             es.season_attendance_penalty, u.display_name, u.avatar_url
      FROM elo_segments es
      JOIN users u ON u.id = es.user_id
      WHERE es.segment_type = ?1 AND es.segment_id = ?2
    `,
  )
    .bind(segmentType, segmentId)
    .all<{
      user_id: string;
      elo: number;
      matches_played: number;
      matches_played_equivalent: number;
      wins: number;
      losses: number;
      streak: number;
      last_match_at: string;
      updated_at: string;
      season_glicko_rating: number | null;
      season_glicko_rd: number | null;
      season_conservative_rating: number | null;
      season_attended_weeks: number;
      season_total_weeks: number;
      season_attendance_penalty: number;
      display_name: string;
      avatar_url: string | null;
    }>();

  const tournamentRounds =
    segmentType === "tournament" ? await getBracketRounds(env, segmentId) : ([] as TournamentBracketRound[]);
  const tournamentPlacementMetrics =
    segmentType === "tournament" ? buildTournamentPlacementMetrics(tournamentRounds) : null;
  const nowIso = isoNow(env.runtime);
  const totalMatchesRow = await env.DB.prepare(
    `
      SELECT COUNT(*) AS total_matches
      FROM matches m
      LEFT JOIN tournaments t ON t.id = m.tournament_id
      WHERE m.status = 'active'
        AND (
          (?1 = 'season' AND (m.season_id = ?2 OR t.season_id = ?2))
          OR (?1 = 'tournament' AND m.tournament_id = ?2)
        )
    `,
  )
    .bind(segmentType, segmentId)
    .first<{ total_matches: number }>();

  const leaderboard = rows.results
    .map<LeaderboardEntry>((row) => {
      const matchEquivalentPlayed = Number(row.matches_played_equivalent ?? row.matches_played ?? 0);
      const seasonGlickoRating = row.season_glicko_rating === null ? undefined : Number(row.season_glicko_rating);
      const seasonGlickoRd = row.season_glicko_rd === null ? undefined : Number(row.season_glicko_rd);
      const seasonAttendedWeeks = Number(row.season_attended_weeks ?? 0);
      const seasonTotalWeeks = Number(row.season_total_weeks ?? 0);
      const seasonAttendancePenalty = Number(row.season_attendance_penalty ?? 0);
      const seasonConservativeRating =
        row.season_conservative_rating === null ? undefined : Number(row.season_conservative_rating);
      return {
        userId: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        elo: Number(row.elo),
        wins: Number(row.wins),
        losses: Number(row.losses),
        streak: Number(row.streak),
        matchEquivalentPlayed,
        lastMatchAt: row.last_match_at || null,
        seasonGlickoRating,
        seasonGlickoRd,
        seasonConservativeRating,
        seasonAttendancePenalty: segmentType === "season" ? seasonAttendancePenalty : undefined,
        seasonAttendedWeeks: segmentType === "season" ? seasonAttendedWeeks : undefined,
        seasonTotalWeeks: segmentType === "season" ? seasonTotalWeeks : undefined,
        seasonScore:
          segmentType === "season"
            ? calculateSeasonScore({
                rating: seasonGlickoRating ?? Number(row.elo),
                rd: seasonGlickoRd ?? 0,
                attendedWeeks: seasonAttendedWeeks,
                totalWeeks: seasonTotalWeeks,
              })
            : undefined,
        isQualified: segmentType === "season" ? matchEquivalentPlayed >= MINIMUM_MATCHES_TO_QUALIFY : undefined,
        ...(segmentType === "tournament" && tournamentPlacementMetrics
          ? (() => {
              const placement = getTournamentPlacementLabel(tournamentRounds, tournamentPlacementMetrics, row.user_id);
              if (!placement) {
                return {};
              }
              return {
                placementLabelKey: placement.key,
                placementLabelCount: placement.count,
              };
            })()
          : {}),
        rank: 0,
      };
    })
    .sort((left, right) => {
      if (segmentType === "season") {
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
      }

      const leftMetrics = tournamentPlacementMetrics;
      const rightChampion = leftMetrics?.championIds.has(right.userId) ?? false;
      const leftChampion = leftMetrics?.championIds.has(left.userId) ?? false;
      if (rightChampion !== leftChampion) {
        return Number(rightChampion) - Number(leftChampion);
      }

      const leftStageReached = leftMetrics?.stageReached[left.userId] ?? 0;
      const rightStageReached = leftMetrics?.stageReached[right.userId] ?? 0;
      if (rightStageReached !== leftStageReached) {
        return rightStageReached - leftStageReached;
      }

      const leftWins = leftMetrics?.bracketWins[left.userId] ?? 0;
      const rightWins = leftMetrics?.bracketWins[right.userId] ?? 0;
      if (rightWins !== leftWins) {
        return rightWins - leftWins;
      }

      const leftLosses = leftMetrics?.bracketLosses[left.userId] ?? 0;
      const rightLosses = leftMetrics?.bracketLosses[right.userId] ?? 0;
      if (leftLosses !== rightLosses) {
        return leftLosses - rightLosses;
      }

      return left.displayName.localeCompare(right.displayName);
    })
    .slice(0, 100)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  const topMatchesPlayer = leaderboard
    .slice()
    .sort((left, right) => {
      const leftMatches = left.wins + left.losses;
      const rightMatches = right.wins + right.losses;
      if (rightMatches !== leftMatches) {
        return rightMatches - leftMatches;
      }
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      if (left.losses !== right.losses) {
        return left.losses - right.losses;
      }
      return left.displayName.localeCompare(right.displayName);
    })[0] ?? null;

  const topWinsPlayer = leaderboard
    .slice()
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      const leftMatches = left.wins + left.losses;
      const rightMatches = right.wins + right.losses;
      if (rightMatches !== leftMatches) {
        return rightMatches - leftMatches;
      }
      if (left.losses !== right.losses) {
        return left.losses - right.losses;
      }
      return left.displayName.localeCompare(right.displayName);
    })[0] ?? null;

  const tournamentWinnerRow =
    segmentType === "tournament"
      ? await env.DB.prepare(
          `
            SELECT tbm.winner_player_id AS user_id, u.display_name, u.avatar_url
            FROM tournament_bracket_matches tbm
            JOIN users u ON u.id = tbm.winner_player_id
            WHERE tbm.tournament_id = ?1
              AND tbm.is_final = 1
              AND tbm.winner_player_id IS NOT NULL
            LIMIT 1
          `,
        )
          .bind(segmentId)
          .first<{
            user_id: string;
            display_name: string;
            avatar_url: string | null;
          }>()
      : null;

  const stats: SegmentLeaderboardStats = {
    totalMatches: Number(totalMatchesRow?.total_matches ?? 0),
    mostMatchesPlayer: topMatchesPlayer
      ? {
          userId: topMatchesPlayer.userId,
          displayName: topMatchesPlayer.displayName,
          avatarUrl: topMatchesPlayer.avatarUrl,
          matchesPlayed: topMatchesPlayer.wins + topMatchesPlayer.losses,
          wins: topMatchesPlayer.wins,
          losses: topMatchesPlayer.losses,
        }
      : null,
    mostWinsPlayer: topWinsPlayer
      ? {
          userId: topWinsPlayer.userId,
          displayName: topWinsPlayer.displayName,
          avatarUrl: topWinsPlayer.avatarUrl,
          matchesPlayed: topWinsPlayer.wins + topWinsPlayer.losses,
          wins: topWinsPlayer.wins,
          losses: topWinsPlayer.losses,
        }
      : null,
    tournamentWinnerPlayer: tournamentWinnerRow
      ? {
          userId: tournamentWinnerRow.user_id,
          displayName: tournamentWinnerRow.display_name,
          avatarUrl: tournamentWinnerRow.avatar_url,
        }
      : null,
  };

  return successResponse(request.requestId, {
    segmentType,
    segmentId,
    leaderboard,
    updatedAt:
      segmentType === "season"
        ? nowIso
        : rows.results.reduce((latest, row) => {
            if (!row.updated_at) {
              return latest;
            }
            return Date.parse(row.updated_at) > Date.parse(latest) ? row.updated_at : latest;
          }, rows.results[0]?.updated_at ?? nowIso),
    stats,
  });
}
