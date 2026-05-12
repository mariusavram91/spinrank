import { isoNow, parseJsonArray } from "../db";
import { errorResponse, successResponse } from "../responses";
import { calculateSeasonScore, MINIMUM_LEADERBOARD_MATCHES } from "../services/elo";
import { getBracketRounds } from "../services/brackets";
import { canAccessSeason, canAccessTournament, getSeasonById, getTournamentById } from "../services/visibility";
import type {
  ApiRequest,
  Env,
  GetSegmentLeaderboardPayload,
  LeaderboardEntry,
  SegmentGameScoreChart,
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

type SegmentMatchRow = {
  match_type: "singles" | "doubles";
  points_to_win?: 11 | 21;
  team_a_player_ids_json: string;
  team_b_player_ids_json: string;
  winner_team: "A" | "B";
};

type SegmentGameScoreCountRow = {
  match_type: "singles" | "doubles";
  points_to_win: 11 | 21;
  winner_score: number;
  loser_score: number;
  game_count: number;
};

const MIN_AWARD_MATCHES = 10;
const SCORE_CHART_CONFIGS: Array<{ matchType: "singles" | "doubles"; pointsToWin: 11 | 21 }> = [
  { matchType: "singles", pointsToWin: 11 },
  { matchType: "singles", pointsToWin: 21 },
  { matchType: "doubles", pointsToWin: 11 },
  { matchType: "doubles", pointsToWin: 21 },
];

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

function chooseBestSinglesPlayer(
  matches: SegmentMatchRow[],
  playerProfiles: Map<string, { displayName: string; avatarUrl: string | null }>,
) {
  const records = new Map<string, { wins: number; losses: number }>();
  matches.forEach((match) => {
    if (match.match_type !== "singles") {
      return;
    }
    const teamA = parseJsonArray<string>(match.team_a_player_ids_json);
    const teamB = parseJsonArray<string>(match.team_b_player_ids_json);
    const playerA = teamA[0];
    const playerB = teamB[0];
    if (!playerA || !playerB) {
      return;
    }
    const winnerId = match.winner_team === "A" ? playerA : playerB;
    const loserId = winnerId === playerA ? playerB : playerA;
    const winner = records.get(winnerId) ?? { wins: 0, losses: 0 };
    winner.wins += 1;
    records.set(winnerId, winner);
    const loser = records.get(loserId) ?? { wins: 0, losses: 0 };
    loser.losses += 1;
    records.set(loserId, loser);
  });

  const rankedSingles = [...records.entries()]
    .map(([userId, record]) => {
      const profile = playerProfiles.get(userId);
      return {
        userId,
        displayName: profile?.displayName ?? userId,
        avatarUrl: profile?.avatarUrl ?? null,
        wins: record.wins,
        losses: record.losses,
      };
    })
    .filter((entry) => entry.wins + entry.losses >= MIN_AWARD_MATCHES)
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      if (left.losses !== right.losses) {
        return left.losses - right.losses;
      }
      const leftMatches = left.wins + left.losses;
      const rightMatches = right.wins + right.losses;
      if (rightMatches !== leftMatches) {
        return rightMatches - leftMatches;
      }
      return left.displayName.localeCompare(right.displayName);
    });

  return rankedSingles[0] ?? null;
}

function chooseBestDoublesPair(
  matches: SegmentMatchRow[],
  playerProfiles: Map<string, { displayName: string; avatarUrl: string | null }>,
) {
  const records = new Map<string, { playerIds: [string, string]; wins: number; losses: number }>();
  const upsertTeamRecord = (playerIds: string[], didWin: boolean): void => {
    if (playerIds.length < 2) {
      return;
    }
    const normalizedPair = [...playerIds].sort((left, right) => left.localeCompare(right)).slice(0, 2) as [string, string];
    const pairKey = normalizedPair.join("|");
    const record = records.get(pairKey) ?? { playerIds: normalizedPair, wins: 0, losses: 0 };
    if (didWin) {
      record.wins += 1;
    } else {
      record.losses += 1;
    }
    records.set(pairKey, record);
  };

  matches.forEach((match) => {
    if (match.match_type !== "doubles") {
      return;
    }
    const teamA = parseJsonArray<string>(match.team_a_player_ids_json);
    const teamB = parseJsonArray<string>(match.team_b_player_ids_json);
    if (teamA.length < 2 || teamB.length < 2) {
      return;
    }
    upsertTeamRecord(teamA, match.winner_team === "A");
    upsertTeamRecord(teamB, match.winner_team === "B");
  });

  const rankedPairs = [...records.values()]
    .map((record) => {
      const pairNames = record.playerIds
        .map((playerId) => playerProfiles.get(playerId)?.displayName ?? playerId)
        .sort((left, right) => left.localeCompare(right));
      return {
        playerIds: record.playerIds,
        displayName: pairNames.join(" & "),
        wins: record.wins,
        losses: record.losses,
      };
    })
    .filter((entry) => entry.wins + entry.losses >= MIN_AWARD_MATCHES)
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      if (left.losses !== right.losses) {
        return left.losses - right.losses;
      }
      const leftMatches = left.wins + left.losses;
      const rightMatches = right.wins + right.losses;
      if (rightMatches !== leftMatches) {
        return rightMatches - leftMatches;
      }
      return left.displayName.localeCompare(right.displayName);
    });

  return rankedPairs[0] ?? null;
}

function buildScoreLabel(winnerScore: number, loserScore: number): string {
  return `${winnerScore}:${loserScore}`;
}

function buildGameScoreCharts(rows: SegmentGameScoreCountRow[]): SegmentGameScoreChart[] {
  const countsByKey = new Map<string, number>();
  const observedByChart = new Map<string, Array<{ winnerScore: number; loserScore: number }>>();

  rows.forEach((row) => {
    const chartKey = `${row.match_type}:${row.points_to_win}`;
    const scoreKey = `${chartKey}:${row.winner_score}:${row.loser_score}`;
    countsByKey.set(scoreKey, Number(row.game_count));
    const observedScores = observedByChart.get(chartKey) ?? [];
    observedScores.push({
      winnerScore: Number(row.winner_score),
      loserScore: Number(row.loser_score),
    });
    observedByChart.set(chartKey, observedScores);
  });

  return SCORE_CHART_CONFIGS.map(({ matchType, pointsToWin }) => {
    const chartKey = `${matchType}:${pointsToWin}`;
    const baselineScores = Array.from({ length: pointsToWin - 1 }, (_, loserScore) => ({
      winnerScore: pointsToWin,
      loserScore,
    }));
    const deuceScores = (observedByChart.get(chartKey) ?? [])
      .filter(({ winnerScore, loserScore }) => winnerScore > pointsToWin || loserScore >= pointsToWin - 1)
      .sort((left, right) => {
        if (left.winnerScore !== right.winnerScore) {
          return left.winnerScore - right.winnerScore;
        }
        return left.loserScore - right.loserScore;
      });

    const uniqueScores = [...baselineScores, ...deuceScores].filter(
      (score, index, allScores) =>
        allScores.findIndex(
          (candidate) =>
            candidate.winnerScore === score.winnerScore && candidate.loserScore === score.loserScore,
        ) === index,
    );

    const bars = uniqueScores
      .map(({ winnerScore, loserScore }) => ({
        scoreLabel: buildScoreLabel(winnerScore, loserScore),
        winnerScore,
        loserScore,
        gamesPlayed: countsByKey.get(`${chartKey}:${winnerScore}:${loserScore}`) ?? 0,
      }))
      .sort((left, right) => {
        if (right.gamesPlayed !== left.gamesPlayed) {
          return right.gamesPlayed - left.gamesPlayed;
        }
        if (left.winnerScore !== right.winnerScore) {
          return left.winnerScore - right.winnerScore;
        }
        return left.loserScore - right.loserScore;
      });

    return {
      matchType,
      pointsToWin,
      totalGames: bars.reduce((sum, bar) => sum + bar.gamesPlayed, 0),
      bars,
    };
  });
}

export async function handleGetSegmentLeaderboard(
  request: ApiRequest<"getSegmentLeaderboard", GetSegmentLeaderboardPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const { segmentType, segmentId, includeScoreDistribution } = request.payload;
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
             es.streak, es.best_win_streak, es.highest_score, es.last_match_at, es.updated_at,
             es.season_glicko_rating, es.season_glicko_rd, es.season_conservative_rating,
             es.season_attended_weeks, es.season_total_weeks, es.season_attendance_penalty,
             u.display_name, u.avatar_url
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
      best_win_streak: number;
      highest_score: number;
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
  const segmentMatches = await env.DB.prepare(
    `
      SELECT m.match_type, m.points_to_win, m.team_a_player_ids_json, m.team_b_player_ids_json, m.winner_team
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
    .all<SegmentMatchRow>();
  const gameScoreCounts =
    segmentType === "season" && includeScoreDistribution
      ? await env.DB.prepare(
          `
            SELECT
              m.match_type,
              m.points_to_win,
              CASE
                WHEN CAST(json_extract(game.value, '$.teamA') AS INTEGER) >= CAST(json_extract(game.value, '$.teamB') AS INTEGER)
                  THEN CAST(json_extract(game.value, '$.teamA') AS INTEGER)
                ELSE CAST(json_extract(game.value, '$.teamB') AS INTEGER)
              END AS winner_score,
              CASE
                WHEN CAST(json_extract(game.value, '$.teamA') AS INTEGER) >= CAST(json_extract(game.value, '$.teamB') AS INTEGER)
                  THEN CAST(json_extract(game.value, '$.teamB') AS INTEGER)
                ELSE CAST(json_extract(game.value, '$.teamA') AS INTEGER)
              END AS loser_score,
              COUNT(*) AS game_count
            FROM matches m
            LEFT JOIN tournaments t ON t.id = m.tournament_id
            JOIN json_each(m.score_json) game
            WHERE m.status = 'active'
              AND (m.season_id = ?1 OR t.season_id = ?1)
            GROUP BY
              m.match_type,
              m.points_to_win,
              winner_score,
              loser_score
          `,
        )
          .bind(segmentId)
          .all<SegmentGameScoreCountRow>()
      : { results: [] as SegmentGameScoreCountRow[] };

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
      const currentSeasonScore =
        segmentType === "season"
          ? calculateSeasonScore({
              rating: seasonGlickoRating ?? Number(row.elo),
              rd: seasonGlickoRd ?? 0,
              attendancePenalty: seasonAttendancePenalty,
            })
          : undefined;
      return {
        userId: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        elo: Number(row.elo),
        wins: Number(row.wins),
        losses: Number(row.losses),
        streak: Number(row.streak),
        bestWinStreak: Number(row.best_win_streak ?? 0),
        highestScore:
          segmentType === "season"
            ? Math.max(Number(row.highest_score ?? 0), Number(currentSeasonScore ?? 0))
            : undefined,
        matchEquivalentPlayed,
        lastMatchAt: row.last_match_at || null,
        seasonGlickoRating,
        seasonGlickoRd,
        seasonConservativeRating,
        seasonAttendancePenalty: segmentType === "season" ? seasonAttendancePenalty : undefined,
        seasonAttendedWeeks: segmentType === "season" ? seasonAttendedWeeks : undefined,
        seasonTotalWeeks: segmentType === "season" ? seasonTotalWeeks : undefined,
        seasonScore: currentSeasonScore,
        isQualified: segmentType === "season" ? matchEquivalentPlayed >= MINIMUM_LEADERBOARD_MATCHES : undefined,
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
    bestSinglesPlayer: chooseBestSinglesPlayer(
      segmentMatches.results,
      new Map(
        leaderboard.map((entry) => [entry.userId, { displayName: entry.displayName, avatarUrl: entry.avatarUrl }] as const),
      ),
    ),
    bestDoublesPair: chooseBestDoublesPair(
      segmentMatches.results,
      new Map(
        leaderboard.map((entry) => [entry.userId, { displayName: entry.displayName, avatarUrl: entry.avatarUrl }] as const),
      ),
    ),
    gameScoreCharts:
      segmentType === "season" && includeScoreDistribution ? buildGameScoreCharts(gameScoreCounts.results) : undefined,
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
