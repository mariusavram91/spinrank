import {
  buildProgressGeometry,
  createInitialProgressPoint,
  sampleProgressPoints,
} from "../../../src/ui/features/progress/utils";

describe("progress utils", () => {
  it("creates the initial progress point just before the first result", () => {
    const point = createInitialProgressPoint({
      playedAt: "2026-04-04T12:00:00.000Z",
      elo: 1234,
      delta: 24,
      label: "Win",
      rank: 2,
    });

    expect(point).toMatchObject({
      elo: 1200,
      delta: 0,
      label: "Initial Elo",
    });
    expect(point.playedAt).toBe("2026-04-04T11:59:59.999Z");
  });

  it("samples the first and last points while reducing the series", () => {
    expect(sampleProgressPoints([1, 2, 3, 4, 5, 6], 4)).toEqual([1, 2, 4, 6]);
  });

  it("builds a centered fallback geometry when no points are present", () => {
    expect(buildProgressGeometry([], 200, 100, 10, 20)).toEqual({
      path: "",
      coordinates: [{ x: 110, y: 70 }],
      min: 0,
      max: 0,
    });
  });

  it("builds a cubic path for three or more points", () => {
    const geometry = buildProgressGeometry(
      [{ elo: 1200 }, { elo: 1240 }, { elo: 1220 }],
      200,
      100,
    );

    expect(geometry.min).toBe(1200);
    expect(geometry.max).toBe(1240);
    expect(geometry.coordinates).toHaveLength(3);
    expect(geometry.path).toContain("C");
  });
});
