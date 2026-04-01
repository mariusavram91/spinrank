import { parseJsonArray, parseJsonObject, randomId } from "../db";
import type { Env, TournamentBracketRound } from "../types";

interface BracketRow {
  id: string;
  tournament_id: string;
  round_index: number;
  round_title: string;
  match_index: number;
  left_player_id: string | null;
  right_player_id: string | null;
  created_match_id: string | null;
  winner_player_id: string | null;
  locked: number;
  is_final: number;
}

export function normalizeRounds(rounds: TournamentBracketRound[]): TournamentBracketRound[] {
  if (!Array.isArray(rounds) || rounds.length === 0) {
    throw new Error("createTournament requires at least one round.");
  }

  return rounds.map((round) => ({
    title: String(round.title || "").trim() || "Round",
    matches: (round.matches || []).map((match) => ({
      id: String(match.id || randomId("tbm")),
      leftPlayerId: match.leftPlayerId || null,
      rightPlayerId: match.rightPlayerId || null,
      createdMatchId: match.createdMatchId || null,
      winnerPlayerId: match.winnerPlayerId || null,
      locked: Boolean(match.locked),
      isFinal: Boolean(match.isFinal),
    })),
  }));
}

export function flattenBracketRows(
  tournamentId: string,
  rounds: TournamentBracketRound[],
): Array<Omit<BracketRow, "tournament_id"> & { tournament_id: string }> {
  return rounds.flatMap((round, roundIndex) =>
    round.matches.map((match, matchIndex) => ({
      id: match.id,
      tournament_id: tournamentId,
      round_index: roundIndex,
      round_title: round.title,
      match_index: matchIndex,
      left_player_id: match.leftPlayerId,
      right_player_id: match.rightPlayerId,
      created_match_id: match.createdMatchId,
      winner_player_id: match.winnerPlayerId,
      locked: match.locked ? 1 : 0,
      is_final: match.isFinal ? 1 : 0,
    })),
  );
}

export function groupBracketRows(rows: BracketRow[]): TournamentBracketRound[] {
  const byRound = new Map<number, TournamentBracketRound>();
  rows
    .slice()
    .sort((left, right) => left.round_index - right.round_index || left.match_index - right.match_index)
    .forEach((row) => {
      const current = byRound.get(row.round_index) ?? {
        title: row.round_title,
        matches: [],
      };
      current.matches.push({
        id: row.id,
        leftPlayerId: row.left_player_id,
        rightPlayerId: row.right_player_id,
        createdMatchId: row.created_match_id,
        winnerPlayerId: row.winner_player_id,
        locked: Boolean(row.locked),
        isFinal: Boolean(row.is_final),
      });
      byRound.set(row.round_index, current);
    });

  return [...byRound.entries()]
    .sort((left, right) => left[0] - right[0])
    .map((entry) => entry[1]);
}

export function applyBracketResult(
  rounds: TournamentBracketRound[],
  bracketMatchId: string,
  createdMatchId: string | null,
  winnerPlayerId: string | null,
): TournamentBracketRound[] {
  return rounds.map((round, roundIndex) => ({
    title: round.title,
    matches: round.matches.map((match, matchIndex) => {
      if (match.id === bracketMatchId) {
        return {
          ...match,
          createdMatchId,
          winnerPlayerId,
          locked: true,
        };
      }

      const previousRound = rounds[roundIndex - 1];
      if (!previousRound) {
        return match;
      }

      const previousLeft = previousRound.matches[matchIndex * 2];
      const previousRight = previousRound.matches[matchIndex * 2 + 1];
      return {
        ...match,
        leftPlayerId: previousLeft?.winnerPlayerId ?? previousLeft?.leftPlayerId ?? previousLeft?.rightPlayerId ?? null,
        rightPlayerId: previousRight?.winnerPlayerId ?? previousRight?.leftPlayerId ?? previousRight?.rightPlayerId ?? null,
      };
    }),
  }));
}

export async function getBracketRows(env: Env, tournamentId: string): Promise<BracketRow[]> {
  const result = await env.DB.prepare(
    `
      SELECT *
      FROM tournament_bracket_matches
      WHERE tournament_id = ?1
      ORDER BY round_index ASC, match_index ASC
    `,
  )
    .bind(tournamentId)
    .all<BracketRow>();

  return result.results;
}

export async function getBracketRounds(env: Env, tournamentId: string): Promise<TournamentBracketRound[]> {
  const rows = await getBracketRows(env, tournamentId);
  if (rows.length > 0) {
    return groupBracketRows(rows);
  }

  const plan = await env.DB.prepare(
    `
      SELECT bracket_json
      FROM tournament_plans
      WHERE tournament_id = ?1
    `,
  )
    .bind(tournamentId)
    .first<{ bracket_json: string }>();

  return plan ? normalizeRounds(parseJsonObject(plan.bracket_json, [] as TournamentBracketRound[])) : [];
}

export async function getPlanParticipantIds(env: Env, tournamentId: string): Promise<string[]> {
  const plan = await env.DB.prepare(
    `
      SELECT participant_ids_json
      FROM tournament_plans
      WHERE tournament_id = ?1
    `,
  )
    .bind(tournamentId)
    .first<{ participant_ids_json: string }>();

  return plan ? parseJsonArray<string>(plan.participant_ids_json) : [];
}

export async function saveTournamentBracket(
  env: Env,
  tournamentId: string,
  participantIds: string[],
  rounds: TournamentBracketRound[],
  createdByUserId: string,
  nowIso: string,
): Promise<void> {
  const normalized = normalizeRounds(rounds);
  const rows = flattenBracketRows(tournamentId, normalized);
  const existingPlan = await env.DB.prepare(
    `
      SELECT id, created_at, created_by_user_id
      FROM tournament_plans
      WHERE tournament_id = ?1
    `,
  )
    .bind(tournamentId)
    .first<{ id: string; created_at: string; created_by_user_id: string }>();

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM tournament_bracket_matches WHERE tournament_id = ?1`).bind(tournamentId),
    env.DB.prepare(
      `
        INSERT INTO tournament_plans (
          id, tournament_id, participant_ids_json, bracket_json, created_by_user_id, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(tournament_id) DO UPDATE SET
          participant_ids_json = excluded.participant_ids_json,
          bracket_json = excluded.bracket_json,
          updated_at = excluded.updated_at
      `,
    ).bind(
      existingPlan?.id ?? randomId("plan"),
      tournamentId,
      JSON.stringify(participantIds),
      JSON.stringify(normalized),
      existingPlan?.created_by_user_id ?? createdByUserId,
      existingPlan?.created_at ?? nowIso,
      nowIso,
    ),
    ...rows.map((row) =>
      env.DB.prepare(
        `
          INSERT INTO tournament_bracket_matches (
            id, tournament_id, round_index, round_title, match_index,
            left_player_id, right_player_id, created_match_id, winner_player_id, locked, is_final
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        `,
      ).bind(
        row.id,
        row.tournament_id,
        row.round_index,
        row.round_title,
        row.match_index,
        row.left_player_id,
        row.right_player_id,
        row.created_match_id,
        row.winner_player_id,
        row.locked,
        row.is_final,
      ),
    ),
  ]);
}

export async function rebuildTournamentBracket(env: Env, tournamentId: string): Promise<void> {
  const rounds = await getBracketRounds(env, tournamentId);
  if (rounds.length === 0) {
    return;
  }

  const replayable = rounds.flatMap((round) =>
    round.matches
      .filter((match) => match.createdMatchId || match.winnerPlayerId)
      .map((match) => ({ ...match })),
  );

  const resetRounds = rounds.map((round, roundIndex) => ({
    title: round.title,
    matches: round.matches.map((match) => ({
      ...match,
      createdMatchId: null,
      winnerPlayerId: null,
      locked: roundIndex === 0 ? Boolean(match.locked && !match.leftPlayerId !== !match.rightPlayerId) : false,
      leftPlayerId: roundIndex === 0 ? match.leftPlayerId : null,
      rightPlayerId: roundIndex === 0 ? match.rightPlayerId : null,
    })),
  }));

  const rebuilt = replayable.reduce((current, match) => {
    if (!match.winnerPlayerId) {
      return current;
    }

    return applyBracketResult(current, match.id, match.createdMatchId, match.winnerPlayerId);
  }, resetRounds);

  const participants = await getPlanParticipantIds(env, tournamentId);
  const owner = await env.DB.prepare(
    `
      SELECT created_by_user_id
      FROM tournaments
      WHERE id = ?1
    `,
  )
    .bind(tournamentId)
    .first<{ created_by_user_id: string | null }>();

  await saveTournamentBracket(
    env,
    tournamentId,
    participants,
    rebuilt,
    owner?.created_by_user_id ?? "",
    new Date().toISOString(),
  );
}
