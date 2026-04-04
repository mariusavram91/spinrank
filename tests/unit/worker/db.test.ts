import { decodeCursor, encodeCursor, isoNow, randomId } from "../../../worker/src/db";

describe("worker db helpers", () => {
  it("encodes and decodes cursors losslessly", () => {
    const cursor = {
      playedAt: "2026-04-04T12:00:00.000Z",
      createdAt: "2026-04-04T12:00:01.000Z",
      id: "match_1",
    };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("returns null for missing cursors", () => {
    expect(decodeCursor(undefined)).toBeNull();
  });

  it("uses the injected runtime for timestamps and ids", () => {
    const runtime = {
      now: () => Date.parse("2026-04-04T12:00:00.000Z"),
      nowIso: () => "2026-04-04T12:00:00.000Z",
      randomUUID: () => "fixed_uuid",
    };

    expect(isoNow(runtime)).toBe("2026-04-04T12:00:00.000Z");
    expect(randomId("season", runtime)).toBe("season_fixed_uuid");
  });
});
