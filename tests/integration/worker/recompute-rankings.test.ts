import { recomputeAllRankings } from "../../../worker/src/services/elo";
import { createWorkerTestContext } from "../../helpers/worker/test-context";

describe("worker integration: recomputeAllRankings segment upsert", () => {
  it("does not violate the elo_segments unique key when a tournament's season is already completed", async () => {
    const context = await createWorkerTestContext();
    try {
      const now = "2026-05-01T00:00:00.000Z";
      const { env } = context;

      for (const [id, name] of [
        ["user_a", "Alice"],
        ["user_b", "Bob"],
      ] as const) {
        await env.DB.prepare(
          `INSERT INTO users (id, provider, provider_user_id, email, display_name, avatar_url,
             global_elo, highest_global_elo, wins, losses, streak, best_win_streak, created_at, updated_at)
           VALUES (?1,'google',?2,?3,?4,NULL,1200,1200,0,0,0,0,?5,?5)`,
        )
          .bind(id, `test:${id}`, `${id}@example.test`, name, now)
          .run();
      }

      // A completed season (so the recompute's DELETE intentionally leaves it alone) ...
      await env.DB.prepare(
        `INSERT INTO seasons (id,name,start_date,end_date,is_active,status,base_elo_mode,
           participant_ids_json,created_by_user_id,created_at,completed_at,is_public)
         VALUES ('season_done','Done Season','2026-01-01','2026-03-31',0,'completed','carry_over',
           '["user_a","user_b"]','user_a',?1,?1,1)`,
      )
        .bind(now)
        .run();

      // ... with a tournament attached to it, and a match that carries tournament segment deltas.
      await env.DB.prepare(
        `INSERT INTO tournaments (id,name,date,season_id,status,created_by_user_id,created_at)
         VALUES ('tour_done','Done Cup','2026-01-15','season_done','completed','user_a',?1)`,
      )
        .bind(now)
        .run();

      await env.DB.prepare(
        `INSERT INTO matches (id,match_type,format_type,points_to_win,team_a_player_ids_json,
           team_b_player_ids_json,score_json,winner_team,global_elo_delta_json,segment_elo_delta_json,
           played_at,season_id,tournament_id,created_by_user_id,status,created_at,delete_locked_at,has_active_dispute)
         VALUES ('match_done','singles','single_game',11,'["user_a"]','["user_b"]',
           '[{"teamA":11,"teamB":5}]','A','{"user_a":16,"user_b":-16}','{"tour_done":{"user_a":16,"user_b":-16}}',
           '2026-02-01T10:00:00.000Z','season_done','tour_done','user_a','active',?1,'2026-02-02T00:00:00.000Z',0)`,
      )
        .bind(now)
        .run();

      await env.DB.prepare(
        `INSERT INTO match_players (match_id,user_id,team) VALUES ('match_done','user_a','A'),('match_done','user_b','B')`,
      ).run();

      // A first recompute creates the segment rows for the completed season/tournament.
      await recomputeAllRankings(env);
      // A second recompute runs the same INSERTs again; this is what used to throw
      // UNIQUE constraint failed: elo_segments.segment_type, segment_id, user_id.
      await recomputeAllRankings(env);

      const rows = await env.DB.prepare(
        `SELECT segment_type, segment_id, user_id FROM elo_segments ORDER BY segment_type, segment_id, user_id`,
      ).all<{ segment_type: string; segment_id: string; user_id: string }>();

      const tournamentRows = rows.results.filter((row) => row.segment_type === "tournament");
      expect(tournamentRows).toHaveLength(2);

      const duplicates = await env.DB.prepare(
        `SELECT segment_type, segment_id, user_id, COUNT(*) AS n
           FROM elo_segments
          GROUP BY segment_type, segment_id, user_id
         HAVING n > 1`,
      ).all<{ n: number }>();
      expect(duplicates.results).toHaveLength(0);
    } finally {
      await context.cleanup();
    }
  }, 30000);
});
