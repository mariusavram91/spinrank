import type { TournamentBracketRound } from "../../../worker/src/types";
import {
  applyBracketResult,
  flattenBracketRows,
  groupBracketRows,
  normalizeRounds,
} from "../../../worker/src/services/brackets";

describe("bracket helpers", () => {
  const runtime = { randomUUID: () => "fixed" } as const;
  const baseRounds: TournamentBracketRound[] = [
    {
      title: "  ",
      matches: [
        {
          leftPlayerId: "player_1",
          rightPlayerId: "player_2",
          createdMatchId: null,
          winnerPlayerId: "player_1",
          locked: false,
          isFinal: false,
          id: "semifinal-1",
        },
      ],
    },
    {
      title: "Final",
      matches: [
        {
          id: "final-match",
          leftPlayerId: null,
          rightPlayerId: null,
          createdMatchId: null,
          winnerPlayerId: null,
          locked: false,
          isFinal: true,
        },
      ],
    },
  ];

  it("normalizes rounds with defaults and preserves provided ids", () => {
    const normalized = normalizeRounds(baseRounds, runtime);

    expect(normalized[0].title).toBe("Round");
    expect(normalized[0].matches[0].id).toBe("semifinal-1");
    expect(normalized[0].matches[0].locked).toBe(false);
    expect(normalized[1].matches[0].locked).toBe(false);
  });

  it("flattens rounds into database-friendly rows", () => {
    const normalized = normalizeRounds(baseRounds, runtime);
    const rows = flattenBracketRows("tournament_1", normalized);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ round_index: 0, match_index: 0, tournament_id: "tournament_1" });
  });

  it("groups rows back into rounds ordered by index", () => {
    const normalized = normalizeRounds(baseRounds, runtime);
    const rows = flattenBracketRows("tournament_1", normalized).reverse();
    const grouped = groupBracketRows(rows);

    expect(grouped).toEqual(normalized);
  });

  it("applies bracket results and propagates winners", () => {
    const rounds: TournamentBracketRound[] = [
      {
        title: "Semi",
        matches: [
          {
            id: "match_1",
            leftPlayerId: "player_1",
            rightPlayerId: "player_2",
            createdMatchId: null,
            winnerPlayerId: "player_1",
            locked: false,
            isFinal: false,
          },
          {
            id: "match_2",
            leftPlayerId: "player_3",
            rightPlayerId: "player_4",
            createdMatchId: null,
            winnerPlayerId: "player_3",
            locked: false,
            isFinal: false,
          },
        ],
      },
      {
        title: "Final",
        matches: [
          {
            id: "final-match",
            leftPlayerId: null,
            rightPlayerId: null,
            createdMatchId: null,
            winnerPlayerId: null,
            locked: false,
            isFinal: true,
          },
        ],
      },
    ];

    const updated = applyBracketResult(rounds, "match_1", "created_match", "player_1");
    const finalMatch = updated[1].matches[0];
    const updatedMatch = updated[0].matches[0];

    expect(updatedMatch.locked).toBe(true);
    expect(updatedMatch.createdMatchId).toBe("created_match");
    expect(updatedMatch.winnerPlayerId).toBe("player_1");
    expect(finalMatch.leftPlayerId).toBe("player_1");
    expect(finalMatch.rightPlayerId).toBe("player_3");
    expect(finalMatch.locked).toBe(false);
  });
});
