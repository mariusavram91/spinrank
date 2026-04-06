import { dateOnly, isoNow, parseJsonArray, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import { createEnqueueAchievementTriggerStatement } from "../services/achievements";
import { applyBracketResult, getBracketRounds, isTournamentBracketCompleted, saveTournamentBracket } from "../services/brackets";
import { computeEloDeltaForTeams, createBlankRatingState, recomputeAllRankings } from "../services/elo";
import { canAccessSeason, canAccessTournament, getSeasonById, getTournamentById } from "../services/visibility";
import type {
  ApiRequest,
  CreateMatchPayload,
  Env,
  MatchRecord,
  MatchScoreGame,
  UserRow,
} from "../types";

function normalizePlayerIds(value: string[]): string[] {
  const normalized = value.map((playerId) => String(playerId || "").trim()).filter(Boolean);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("A team cannot contain the same player twice.");
  }
  return normalized;
}

function normalizeScore(value: MatchScoreGame[]): MatchScoreGame[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Score must include at least one game.");
  }

  return value.map((game) => {
    const teamA = Number(game.teamA);
    const teamB = Number(game.teamB);
    if (!Number.isInteger(teamA) || !Number.isInteger(teamB) || teamA < 0 || teamB < 0) {
      throw new Error("Game scores must be non-negative integers.");
    }
    return { teamA, teamB };
  });
}

function validateMatchScore(
  formatType: CreateMatchPayload["formatType"],
  pointsToWin: number,
  score: MatchScoreGame[],
  winnerTeam: CreateMatchPayload["winnerTeam"],
): void {
  const requiredWins = formatType === "single_game" ? 1 : 2;
  const maxGames = formatType === "single_game" ? 1 : 3;
  if (score.length < requiredWins || score.length > maxGames) {
    throw new Error("Score length does not match the selected format.");
  }

  let teamAWins = 0;
  let teamBWins = 0;
  score.forEach((game, index) => {
    const maxScore = Math.max(game.teamA, game.teamB);
    const scoreGap = Math.abs(game.teamA - game.teamB);
    if (maxScore < pointsToWin || game.teamA === game.teamB || scoreGap < 2) {
      throw new Error("Each game must be won by reaching the target score with at least a 2-point lead.");
    }
    if (game.teamA > game.teamB) {
      teamAWins += 1;
    } else {
      teamBWins += 1;
    }
    if (index < score.length - 1 && (teamAWins === requiredWins || teamBWins === requiredWins)) {
      throw new Error("Score includes games after the match winner was already decided.");
    }
  });

  const actualWinner = teamAWins > teamBWins ? "A" : "B";
  if (actualWinner !== winnerTeam) {
    throw new Error("winnerTeam does not match the submitted score.");
  }
}

async function validatePlayers(env: Env, playerIds: string[]): Promise<Record<string, UserRow>> {
  const placeholders = playerIds.map((_, index) => `?${index + 1}`).join(",");
  const result = await env.DB.prepare(
    `
      SELECT *
      FROM users
      WHERE id IN (${placeholders})
    `,
  )
    .bind(...playerIds)
    .all<UserRow>();

  const byId = Object.fromEntries(result.results.map((user) => [user.id, user]));
  if (Object.keys(byId).length !== playerIds.length) {
    throw new Error("One or more selected players do not exist.");
  }
  return byId;
}

async function loadTournamentRatings(
  env: Env,
  tournamentId: string,
  playerIds: string[],
): Promise<Record<string, ReturnType<typeof createBlankRatingState>>> {
  const placeholders = playerIds.map((_, index) => `?${index + 2}`).join(",");
  const result = await env.DB.prepare(
    `
      SELECT user_id, elo, wins, losses, streak, matches_played, matches_played_equivalent, last_match_at, updated_at
      FROM elo_segments
      WHERE segment_type = 'tournament'
        AND segment_id = ?1
        AND user_id IN (${placeholders})
    `,
  )
    .bind(tournamentId, ...playerIds)
    .all<{
      user_id: string;
      elo: number;
      wins: number;
      losses: number;
      streak: number;
      matches_played: number;
      matches_played_equivalent: number;
      last_match_at: string | null;
      updated_at: string;
    }>();

  return Object.fromEntries(
    result.results.map((row) => [
      row.user_id,
      {
        elo: Number(row.elo),
        wins: Number(row.wins),
        losses: Number(row.losses),
        streak: Number(row.streak),
        matchesPlayed: Number(row.matches_played),
        matchEquivalentPlayed: Number(row.matches_played_equivalent),
        lastMatchAt: row.last_match_at || "",
        updatedAt: row.updated_at,
      },
    ]),
  );
}

function ensureSubset(memberIds: string[], playerIds: string[], label: string): string | null {
  const members = new Set(memberIds);
  const missing = playerIds.filter((playerId) => !members.has(playerId));
  if (missing.length > 0) {
    return `All selected players must belong to the selected ${label}.`;
  }
  return null;
}

export async function handleCreateMatch(
  request: ApiRequest<"createMatch", CreateMatchPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  try {
    const payload = request.payload;
    const matchType = payload.matchType;
    const formatType = payload.formatType;
    const pointsToWin = Number(payload.pointsToWin);
    const teamAPlayerIds = normalizePlayerIds(payload.teamAPlayerIds || []);
    const teamBPlayerIds = normalizePlayerIds(payload.teamBPlayerIds || []);
    const score = normalizeScore(payload.score || []);
    const winnerTeam = payload.winnerTeam;
    const playedAt = String(payload.playedAt || "");
    const requestedSeasonId = payload.seasonId || null;
    const tournamentId = payload.tournamentId || null;

    if (matchType !== "singles" && matchType !== "doubles") {
      return errorResponse(request.requestId, "VALIDATION_ERROR", "createMatch requires a valid match type.");
    }
    if (formatType !== "single_game" && formatType !== "best_of_3") {
      return errorResponse(request.requestId, "VALIDATION_ERROR", "createMatch requires a valid format.");
    }
    if (pointsToWin !== 11 && pointsToWin !== 21) {
      return errorResponse(request.requestId, "VALIDATION_ERROR", "createMatch pointsToWin must be 11 or 21.");
    }
    if (!playedAt || Number.isNaN(Date.parse(playedAt))) {
      return errorResponse(request.requestId, "VALIDATION_ERROR", "createMatch playedAt must be a valid ISO-8601 timestamp.");
    }

    const expectedTeamSize = matchType === "singles" ? 1 : 2;
    if (teamAPlayerIds.length !== expectedTeamSize || teamBPlayerIds.length !== expectedTeamSize) {
      return errorResponse(request.requestId, "VALIDATION_ERROR", "Team sizes do not match the selected match type.");
    }

    const allPlayerIds = [...teamAPlayerIds, ...teamBPlayerIds];
    if (new Set(allPlayerIds).size !== allPlayerIds.length) {
      return errorResponse(request.requestId, "VALIDATION_ERROR", "A player cannot appear on both teams.");
    }
    if (!allPlayerIds.includes(sessionUser.id)) {
      return errorResponse(
        request.requestId,
        "FORBIDDEN",
        "You can only create a match if you are one of the participants.",
      );
    }

    validateMatchScore(formatType, pointsToWin, score, winnerTeam);

    const tournament = tournamentId ? await getTournamentById(env, tournamentId) : null;
    if (tournament && !(await canAccessTournament(env, tournament, sessionUser.id))) {
      return errorResponse(request.requestId, "FORBIDDEN", "You do not have access to this tournament.");
    }
    if (tournament && (tournament.status === "completed" || (await isTournamentBracketCompleted(env, tournament.id)))) {
      return errorResponse(request.requestId, "CONFLICT", "This tournament is completed and no further matches can be added.");
    }
    if (requestedSeasonId && tournament?.season_id && tournament.season_id !== requestedSeasonId) {
      return errorResponse(request.requestId, "VALIDATION_ERROR", "Selected tournament does not belong to the selected season.");
    }

    const seasonId = tournament?.season_id ?? requestedSeasonId ?? null;
    const season = seasonId ? await getSeasonById(env, seasonId) : null;
    if (season && !canAccessSeason(season, sessionUser.id)) {
      return errorResponse(request.requestId, "FORBIDDEN", "You do not have access to this season.");
    }
    if (
      season &&
      (season.status === "completed" || (season.end_date && dateOnly(isoNow(env.runtime)) > season.end_date))
    ) {
      return errorResponse(request.requestId, "CONFLICT", "This season is completed and no further matches can be added.");
    }

    if (season) {
      const seasonParticipantIds = parseJsonArray<string>(season.participant_ids_json);
      const seasonMembershipError = ensureSubset(seasonParticipantIds, allPlayerIds, "season");
      if (seasonMembershipError) {
        return errorResponse(request.requestId, "VALIDATION_ERROR", seasonMembershipError);
      }
    }

    if (tournament) {
      const tournamentParticipantIds = await env.DB.prepare(
        `
          SELECT user_id
          FROM tournament_participants
          WHERE tournament_id = ?1
          ORDER BY user_id ASC
        `,
      )
        .bind(tournament.id)
        .all<{ user_id: string }>();
      const tournamentMembershipError = ensureSubset(
        tournamentParticipantIds.results.map((row) => row.user_id),
        allPlayerIds,
        "tournament",
      );
      if (tournamentMembershipError) {
        return errorResponse(request.requestId, "VALIDATION_ERROR", tournamentMembershipError);
      }
    }

    const usersById = await validatePlayers(env, allPlayerIds);
    const nowIso = isoNow(env.runtime);
    const globalDelta = computeEloDeltaForTeams(
      teamAPlayerIds,
      teamBPlayerIds,
      usersById,
      winnerTeam,
      matchType,
    );
    const segmentDelta: Record<string, Record<string, number>> = {};
    if (seasonId) {
      segmentDelta[seasonId] = {};
    }
    if (tournamentId) {
      const segmentUsers = await loadTournamentRatings(env, tournamentId, allPlayerIds);
      allPlayerIds.forEach((playerId) => {
        segmentUsers[playerId] ??= createBlankRatingState(nowIso);
      });
      segmentDelta[tournamentId] = computeEloDeltaForTeams(
        teamAPlayerIds,
        teamBPlayerIds,
        segmentUsers,
        winnerTeam,
        matchType,
      );
    }

    const matchId = randomId("match", env.runtime);
    await env.DB.batch([
      env.DB.prepare(
        `
          INSERT INTO matches (
            id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
            score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at, season_id,
            tournament_id, created_by_user_id, status, deactivated_at, deactivated_by_user_id,
            deactivation_reason, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 'active', NULL, NULL, NULL, ?15)
        `,
      ).bind(
        matchId,
        matchType,
        formatType,
        pointsToWin,
        JSON.stringify(teamAPlayerIds),
        JSON.stringify(teamBPlayerIds),
        JSON.stringify(score),
        winnerTeam,
        JSON.stringify(globalDelta),
        JSON.stringify(segmentDelta),
        playedAt,
        seasonId,
        tournamentId,
        sessionUser.id,
        nowIso,
      ),
      ...teamAPlayerIds.map((playerId) =>
        env.DB.prepare(
          `
            INSERT INTO match_players (match_id, user_id, team)
            VALUES (?1, ?2, 'A')
          `,
        ).bind(matchId, playerId),
      ),
      ...teamBPlayerIds.map((playerId) =>
        env.DB.prepare(
          `
            INSERT INTO match_players (match_id, user_id, team)
            VALUES (?1, ?2, 'B')
          `,
        ).bind(matchId, playerId),
      ),
      env.DB.prepare(
        `
          INSERT INTO request_dedup (action, request_id, target_id, created_at)
          VALUES ('createMatch', ?1, ?2, ?3)
          ON CONFLICT(action, request_id) DO NOTHING
        `,
      ).bind(request.requestId, matchId, nowIso),
      env.DB.prepare(
        `
          INSERT INTO audit_log (id, action, actor_user_id, target_id, payload_json, created_at)
          VALUES (?1, 'createMatch', ?2, ?3, ?4, ?5)
        `,
      ).bind(randomId("audit", env.runtime), sessionUser.id, matchId, JSON.stringify(payload), nowIso),
      createEnqueueAchievementTriggerStatement(
        env,
        {
          type: "match_created",
          userIds: allPlayerIds,
          actorUserId: sessionUser.id,
          matchId,
          nowIso,
          matchType,
          seasonId,
          tournamentId,
        },
        nowIso,
      ),
      createEnqueueAchievementTriggerStatement(
        env,
        {
          type: "rankings_recomputed",
          userIds: allPlayerIds,
          nowIso,
        },
        nowIso,
      ),
    ]);

    if (tournamentId && payload.tournamentBracketMatchId) {
      const rounds = await getBracketRounds(env, tournamentId);
      const winnerPlayerId = winnerTeam === "A" ? teamAPlayerIds[0] : teamBPlayerIds[0];
      const nextRounds = applyBracketResult(rounds, payload.tournamentBracketMatchId, matchId, winnerPlayerId);
      const participantIds = parseJsonArray<string>(
        (
          await env.DB.prepare(
            `
              SELECT participant_ids_json
              FROM tournament_plans
              WHERE tournament_id = ?1
            `,
          )
            .bind(tournamentId)
            .first<{ participant_ids_json: string }>()
        )?.participant_ids_json,
      );
      await saveTournamentBracket(env, tournamentId, participantIds, nextRounds, sessionUser.id, nowIso);
    }

    await recomputeAllRankings(env);

    return successResponse(request.requestId, {
      match: {
        id: matchId,
        matchType,
        formatType,
        pointsToWin: pointsToWin as 11 | 21,
        teamAPlayerIds,
        teamBPlayerIds,
        score,
        winnerTeam,
        playedAt,
        seasonId,
        tournamentId,
        createdByUserId: sessionUser.id,
        status: "active",
        createdAt: nowIso,
      },
    });
  } catch (error) {
    return errorResponse(
      request.requestId,
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Failed to create match.",
    );
  }
}
