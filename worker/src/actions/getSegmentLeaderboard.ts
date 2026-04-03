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
             es.streak, es.last_match_at, es.updated_at, u.display_name, u.avatar_url
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
      display_name: string;
      avatar_url: string | null;
    }>();

  const nowIso = new Date().toISOString();
  const tournamentRounds =
    segmentType === "tournament" ? await getBracketRounds(env, segmentId) : ([] as TournamentBracketRound[]);
  const tournamentPlacementMetrics =
    segmentType === "tournament" ? buildTournamentPlacementMetrics(tournamentRounds) : null;

  const leaderboard = rows.results
    .map<LeaderboardEntry>((row) => {
      const matchEquivalentPlayed = Number(row.matches_played_equivalent ?? row.matches_played ?? 0);
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
        seasonScore:
          segmentType === "season"
            ? calculateSeasonScore({
                elo: Number(row.elo),
                lastMatchAt: row.last_match_at || null,
                matchEquivalentPlayed,
                nowIso,
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
        if ((right.matchEquivalentPlayed ?? 0) !== (left.matchEquivalentPlayed ?? 0)) {
          return (right.matchEquivalentPlayed ?? 0) - (left.matchEquivalentPlayed ?? 0);
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

  const matchesColumn = segmentType === "season" ? "season_id" : "tournament_id";
  const matchesRow = await env.DB.prepare(
    `
      SELECT COUNT(*) AS total_matches
      FROM matches
      WHERE status = 'active' AND ${matchesColumn} = ?1
    `,
  )
    .bind(segmentId)
    .first<{ total_matches: number }>();

  const topMatchesRow = await env.DB.prepare(
    `
      SELECT es.user_id, es.matches_played, es.wins, es.losses, u.display_name, u.avatar_url
      FROM elo_segments es
      JOIN users u ON u.id = es.user_id
      WHERE es.segment_type = ?1 AND es.segment_id = ?2
      ORDER BY es.matches_played DESC, es.wins DESC, es.losses ASC, u.display_name ASC
      LIMIT 1
    `,
  )
    .bind(segmentType, segmentId)
    .first<{
      user_id: string;
      matches_played: number;
      wins: number;
      losses: number;
      display_name: string;
      avatar_url: string | null;
    }>();

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
    totalMatches: Number(matchesRow?.total_matches ?? 0),
    mostMatchesPlayer: topMatchesRow
      ? {
          userId: topMatchesRow.user_id,
          displayName: topMatchesRow.display_name,
          avatarUrl: topMatchesRow.avatar_url,
          matchesPlayed: Number(topMatchesRow.matches_played ?? 0),
          wins: Number(topMatchesRow.wins ?? 0),
          losses: Number(topMatchesRow.losses ?? 0),
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
