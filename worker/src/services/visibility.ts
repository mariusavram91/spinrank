import { parseJsonArray } from "../db";
import type { Env, SeasonRow, TournamentRow } from "../types";

export const getRecentCompletionCutoffDate = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  return date.toISOString().slice(0, 10);
};

export const buildVisibleSeasonsSql = (): string => `
  SELECT
    s.id,
    s.name,
    s.start_date,
    s.end_date,
    s.is_active,
    s.status,
    s.base_elo_mode,
    s.participant_ids_json,
    s.created_by_user_id,
    s.created_at,
    s.completed_at,
    s.is_public
  FROM seasons s
  LEFT JOIN season_participants sp
    ON sp.season_id = s.id AND sp.user_id = ?1
  WHERE s.status != 'deleted'
    AND (
      (
        s.status = 'completed'
        AND date(s.end_date) >= ?2
      )
      OR (
        s.status != 'completed'
        AND s.is_active = 1
      )
    )
    AND (
      s.created_by_user_id = ?1
      OR sp.user_id IS NOT NULL
    )
`;

export const buildVisibleTournamentsSql = (): string => `
  SELECT
    t.id,
    t.name,
    t.date,
    t.status,
    t.season_id,
    t.created_by_user_id,
    t.created_at,
    t.completed_at
  FROM tournaments t
  LEFT JOIN tournament_participants tp
    ON tp.tournament_id = t.id AND tp.user_id = ?1
  WHERE t.status != 'deleted'
    AND (
      t.created_by_user_id = ?1
      OR tp.user_id IS NOT NULL
    )
    AND (
      t.status != 'completed'
      OR date(COALESCE(t.completed_at, t.date)) >= ?2
    )
`;

export async function getSeasonById(env: Env, seasonId: string): Promise<SeasonRow | null> {
  return (
    (await env.DB.prepare(
      `
        SELECT *
        FROM seasons
        WHERE id = ?1
      `,
    )
      .bind(seasonId)
      .first<SeasonRow>()) ?? null
  );
}

export async function getTournamentById(env: Env, tournamentId: string): Promise<TournamentRow | null> {
  return (
    (await env.DB.prepare(
      `
        SELECT *
        FROM tournaments
        WHERE id = ?1
      `,
    )
      .bind(tournamentId)
      .first<TournamentRow>()) ?? null
  );
}

export async function getTournamentParticipantIds(env: Env, tournamentId: string): Promise<string[]> {
  const result = await env.DB.prepare(
    `
      SELECT user_id
      FROM tournament_participants
      WHERE tournament_id = ?1
      ORDER BY user_id ASC
    `,
  )
    .bind(tournamentId)
    .all<{ user_id: string }>();

  return result.results.map((row) => row.user_id);
}

export function canAccessSeason(season: SeasonRow | null, userId: string): boolean {
  if (!season || season.status === "deleted") {
    return false;
  }

  if (season.is_public) {
    return true;
  }

  if (season.created_by_user_id === userId) {
    return true;
  }

  return parseJsonArray<string>(season.participant_ids_json).includes(userId);
}

export async function canAccessTournament(
  env: Env,
  tournament: TournamentRow | null,
  userId: string,
): Promise<boolean> {
  if (!tournament || tournament.status === "deleted") {
    return false;
  }

  if (tournament.created_by_user_id === userId) {
    return true;
  }

  const participants = await getTournamentParticipantIds(env, tournament.id);
  return participants.includes(userId);
}
