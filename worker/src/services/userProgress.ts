import { isoNow, parseJsonObject } from "../db";
import type { Env, MatchRecord, UserProgressPoint } from "../types";

export type VisibleUserProgressRow = {
  playedAt: string;
  delta: number;
  winnerTeam: MatchRecord["winnerTeam"];
  playerTeam: MatchRecord["winnerTeam"];
  matchType: MatchRecord["matchType"];
};

const MAX_SUMMARY_PROGRESS_POINTS = 120;

export function sampleProgressPointsByExtrema(points: UserProgressPoint[], maxPoints: number): UserProgressPoint[] {
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
}

export async function loadVisibleUserProgressRows(
  env: Env,
  viewerUserId: string,
  targetUserId: string,
): Promise<VisibleUserProgressRow[]> {
  const progressRows = await env.DB.prepare(
    `
      SELECT m.played_at, m.global_elo_delta_json, m.winner_team, mp.team AS player_team, m.match_type
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
      winner_team: MatchRecord["winnerTeam"];
      player_team: MatchRecord["winnerTeam"];
      match_type: MatchRecord["matchType"];
    }>();

  return progressRows.results.map((row) => {
    const deltaMap = parseJsonObject<Record<string, number>>(row.global_elo_delta_json, {});
    return {
      playedAt: row.played_at,
      delta: Number(deltaMap[targetUserId] || 0),
      winnerTeam: row.winner_team,
      playerTeam: row.player_team,
      matchType: row.match_type,
    };
  });
}

export function buildUserProgressPoints(args: {
  rows: VisibleUserProgressRow[];
  currentElo: number;
  mode: "summary" | "full";
  env: Env;
  resolvedRank?: number | null;
  emptyLabel?: string;
}): UserProgressPoint[] {
  let elo =
    args.mode === "summary"
      ? args.currentElo - args.rows.reduce((sum, row) => sum + row.delta, 0)
      : 1200;

  const progressPoints: UserProgressPoint[] = args.rows.map((row) => {
    elo += row.delta;
    return {
      playedAt: row.playedAt,
      elo,
      delta: row.delta,
      label: row.playedAt,
      rank: null,
    };
  });

  const finalPoints =
    progressPoints.length > 0
      ? progressPoints
      : [
          {
            playedAt: isoNow(args.env.runtime),
            elo: args.currentElo,
            delta: 0,
            label: args.emptyLabel ?? isoNow(args.env.runtime),
            rank: args.resolvedRank ?? null,
          },
        ];

  return args.mode === "summary" ? sampleProgressPointsByExtrema(finalPoints, MAX_SUMMARY_PROGRESS_POINTS) : finalPoints;
}
