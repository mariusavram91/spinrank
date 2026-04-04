import type { Env, SeasonRow, TournamentRow } from "../../../worker/src/types";
import * as visibility from "../../../worker/src/services/visibility";

describe("visibility helpers", () => {
  it("computes a cutoff date two months in the past", () => {
    const cutoff = visibility.getRecentCompletionCutoffDate({ now: () => Date.parse("2026-04-05T00:00:00.000Z") });
    expect(cutoff).toBe("2026-02-05");
  });

  it("exposes the expected season SQL fragment", () => {
    const sql = visibility.buildVisibleSeasonsSql();
    expect(sql).toContain("LEFT JOIN season_participants sp");
    expect(sql).toContain("WHERE s.status != 'deleted'");
  });

  it("exposes the expected tournament SQL fragment", () => {
    const sql = visibility.buildVisibleTournamentsSql();
    expect(sql).toContain("LEFT JOIN tournament_participants tp");
    expect(sql).toContain("WHERE t.status != 'deleted'");
  });

  it("allows access to public or associated seasons only", () => {
    const template: SeasonRow = {
      id: "season_1",
      name: "Spring League",
      start_date: "2026-01-01",
      end_date: "2026-03-01",
      is_active: 1,
      status: "active",
      base_elo_mode: "carry_over",
      participant_ids_json: JSON.stringify(["user_main"]),
      created_by_user_id: "user_main",
      created_at: "2026-01-01T00:00:00.000Z",
      completed_at: null,
      is_public: 0,
    };

    expect(visibility.canAccessSeason(null, "user_main")).toBe(false);
    expect(visibility.canAccessSeason({ ...template, status: "deleted" }, "user_main")).toBe(false);
    expect(visibility.canAccessSeason({ ...template, is_public: 1 }, "random")).toBe(true);
    expect(visibility.canAccessSeason(template, "user_main")).toBe(true);

    const nonParticipant = { ...template, participant_ids_json: JSON.stringify(["other"]), created_by_user_id: "other" };
    expect(visibility.canAccessSeason(nonParticipant, "user_main")).toBe(false);
  });

  const makeEnv = (): Env => ({
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [{ user_id: "user_main" }] }),
        }),
      }),
    } as any,
    GOOGLE_CLIENT_ID: "test",
    APP_SESSION_SECRET: "secret",
    APP_ORIGIN: "https://example.test",
    runtime: undefined,
  });

  it("checks tournament access via participants or ownership", async () => {
    const env = makeEnv();
    const tournament: TournamentRow = {
      id: "tournament_1",
      name: "Cup",
      date: "2026-03-15",
      status: "active",
      season_id: "season_1",
      created_by_user_id: "user_main",
      created_at: "2026-01-01T00:00:00.000Z",
      completed_at: null,
    };

    expect(await visibility.canAccessTournament(env, null, "user_main")).toBe(false);
    expect(await visibility.canAccessTournament(env, { ...tournament, status: "deleted" }, "user_main")).toBe(false);

    const ownTournament = await visibility.canAccessTournament(env, tournament, "user_main");
    expect(ownTournament).toBe(true);

    const otherTournament = await visibility.canAccessTournament(env, { ...tournament, created_by_user_id: "other" }, "user_main");
    expect(otherTournament).toBe(true);
  });
});
