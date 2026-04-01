import { dateOnly, isoNow, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import { normalizeRounds, saveTournamentBracket } from "../services/brackets";
import { getSeasonById, getTournamentById } from "../services/visibility";
import type { ApiRequest, CreateTournamentPayload, Env, TournamentRecord, TournamentStatus, UserRow } from "../types";

function getBracketStatus(rounds: CreateTournamentPayload["rounds"]): TournamentRecord["bracketStatus"] {
  if (rounds.some((round) => round.matches.some((match) => match.isFinal && match.winnerPlayerId))) {
    return "completed";
  }
  if (rounds.some((round) => round.matches.some((match) => match.createdMatchId || match.winnerPlayerId))) {
    return "in_progress";
  }
  return "draft";
}

async function validatePlayers(env: Env, playerIds: string[]): Promise<boolean> {
  const placeholders = playerIds.map((_, index) => `?${index + 1}`).join(",");
  const result = await env.DB.prepare(
    `
      SELECT COUNT(*) AS count
      FROM users
      WHERE id IN (${placeholders})
    `,
  )
    .bind(...playerIds)
    .first<{ count: number }>();

  return Number(result?.count || 0) === playerIds.length;
}

export async function handleCreateTournament(
  request: ApiRequest<"createTournament", CreateTournamentPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const payload = request.payload;
  const name = String(payload.name || "").trim();
  const participantIds = [...new Set((payload.participantIds || []).map((value) => String(value || "").trim()).filter(Boolean))];
  const rounds = normalizeRounds(payload.rounds || []);

  if (!name) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "createTournament requires a name.");
  }
  if (participantIds.length < 2) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "A tournament needs at least 2 participants.");
  }
  if (!(await validatePlayers(env, participantIds))) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Tournament participants must all exist.");
  }

  const season = payload.seasonId ? await getSeasonById(env, payload.seasonId) : null;
  if (season && season.status !== "active") {
    return errorResponse(request.requestId, "CONFLICT", "The selected season can no longer be used.");
  }

  const existing = payload.tournamentId ? await getTournamentById(env, payload.tournamentId) : null;
  if (existing && existing.created_by_user_id !== sessionUser.id) {
    return errorResponse(request.requestId, "FORBIDDEN", "Only the creator can edit this tournament.");
  }
  if (existing?.status === "completed" || existing?.status === "deleted") {
    return errorResponse(request.requestId, "CONFLICT", "This tournament can no longer be edited.");
  }

  const nowIso = isoNow();
  const tournamentId = existing?.id ?? payload.tournamentId ?? randomId("tournament");
  const date = payload.date || existing?.date || dateOnly(nowIso);
  const bracketStatus = getBracketStatus(rounds);
  const status: TournamentStatus = bracketStatus === "completed" ? "completed" : existing?.status ?? "active";
  const completedAt = status === "completed" ? existing?.completed_at || nowIso : existing?.completed_at || "";

  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO tournaments (
          id, name, date, status, season_id, created_by_user_id, created_at, completed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          date = excluded.date,
          status = excluded.status,
          season_id = excluded.season_id,
          completed_at = excluded.completed_at
      `,
    ).bind(
      tournamentId,
      name,
      date,
      status,
      payload.seasonId || null,
      existing?.created_by_user_id ?? sessionUser.id,
      existing?.created_at ?? nowIso,
      completedAt,
    ),
    env.DB.prepare(`DELETE FROM tournament_participants WHERE tournament_id = ?1`).bind(tournamentId),
    ...participantIds.map((participantId) =>
      env.DB.prepare(
        `
          INSERT INTO tournament_participants (tournament_id, user_id)
          VALUES (?1, ?2)
        `,
      ).bind(tournamentId, participantId),
    ),
    env.DB.prepare(
      `
        INSERT INTO audit_log (id, action, actor_user_id, target_id, payload_json, created_at)
        VALUES (?1, 'createTournament', ?2, ?3, ?4, ?5)
      `,
    ).bind(randomId("audit"), sessionUser.id, tournamentId, JSON.stringify(payload), nowIso),
  ]);

  await saveTournamentBracket(env, tournamentId, participantIds, rounds, sessionUser.id, nowIso);

  return successResponse(request.requestId, {
    tournament: {
      id: tournamentId,
      name,
      date,
      seasonId: payload.seasonId || null,
      seasonName: season?.name ?? null,
      status,
      createdByUserId: existing?.created_by_user_id ?? sessionUser.id,
      createdAt: existing?.created_at ?? nowIso,
      completedAt: completedAt || null,
      participantCount: participantIds.length,
      bracketStatus,
    },
    rounds,
  });
}
