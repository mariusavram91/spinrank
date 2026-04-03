import type { GetUserProgressData } from "../../../api/contract";
import type { ProgressGeometry } from "../../shared/types/app";
import { formatDate } from "../../shared/utils/format";

export const MAX_PROGRESS_DISPLAY_POINTS = 10;

export const createInitialProgressPoint = (
  reference?: GetUserProgressData["points"][number],
): GetUserProgressData["points"][number] => {
  const baseTime = reference ? new Date(reference.playedAt).getTime() - 1 : Date.now();
  return {
    playedAt: new Date(baseTime).toISOString(),
    elo: 1200,
    delta: 0,
    label: "Initial Elo",
    rank: null,
  };
};

export const sampleProgressPoints = <T>(points: T[], maxPoints: number): T[] => {
  if (points.length <= maxPoints || maxPoints <= 0) {
    return [...points];
  }
  const clampedPoints = Math.min(points.length, Math.max(2, maxPoints));
  const stride = (points.length - 1) / (clampedPoints - 1);
  const sampled: T[] = [];
  for (let i = 0; i < clampedPoints - 1; i += 1) {
    const index = Math.floor(i * stride);
    sampled.push(points[index]);
  }
  sampled.push(points[points.length - 1]);
  return sampled;
};

export const buildProgressGeometry = (
  points: Array<{ elo: number }>,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
  minOverride?: number,
  maxOverride?: number,
): ProgressGeometry => {
  if (points.length === 0) {
    const centerX = width / 2 + offsetX;
    const centerY = height / 2 + offsetY;
    return {
      path: "",
      coordinates: [{ x: centerX, y: centerY }],
      min: 0,
      max: 0,
    };
  }

  const rawMin = Math.min(...points.map((point) => point.elo));
  const rawMax = Math.max(...points.map((point) => point.elo));
  const minElo = minOverride ?? rawMin;
  const maxElo = maxOverride ?? rawMax;
  const range = Math.max(maxElo - minElo, 1);

  const coordinates = points.map((point, index) => {
    const x = (points.length === 1 ? width / 2 : (index / (points.length - 1)) * width) + offsetX;
    const y = height - ((point.elo - minElo) / range) * height + offsetY;
    return { x, y };
  });

  const path =
    coordinates.length === 1
      ? `M${coordinates[0].x.toFixed(1)} ${coordinates[0].y.toFixed(1)}`
      : coordinates.length === 2
        ? `M${coordinates[0].x.toFixed(1)} ${coordinates[0].y.toFixed(1)} L${coordinates[1].x.toFixed(
            1,
          )} ${coordinates[1].y.toFixed(1)}`
        : (() => {
            const segments = [`M${coordinates[0].x.toFixed(1)} ${coordinates[0].y.toFixed(1)}`];
            for (let index = 0; index < coordinates.length - 1; index += 1) {
              const previousPoint = coordinates[index - 1] ?? coordinates[index];
              const currentPoint = coordinates[index];
              const nextPoint = coordinates[index + 1];
              const followingPoint = coordinates[index + 2] ?? nextPoint;
              const controlPoint1X = currentPoint.x + (nextPoint.x - previousPoint.x) / 6;
              const controlPoint1Y = currentPoint.y + (nextPoint.y - previousPoint.y) / 6;
              const controlPoint2X = nextPoint.x - (followingPoint.x - currentPoint.x) / 6;
              const controlPoint2Y = nextPoint.y - (followingPoint.y - currentPoint.y) / 6;
              segments.push(
                `C${controlPoint1X.toFixed(1)} ${controlPoint1Y.toFixed(1)} ${controlPoint2X.toFixed(
                  1,
                )} ${controlPoint2Y.toFixed(1)} ${nextPoint.x.toFixed(1)} ${nextPoint.y.toFixed(1)}`,
              );
            }
            return segments.join(" ");
          })();

  return {
    path,
    coordinates,
    min: minElo,
    max: maxElo,
  };
};

export const formatProgressPointTooltip = (point: GetUserProgressData["points"][number]): string => {
  const rankLabel = point.rank ? ` • Ranked #${point.rank}` : "";
  const deltaLabel = point.delta === 0 ? "" : ` • ${point.delta > 0 ? "+" : ""}${point.delta} Elo`;
  return `${formatDate(point.playedAt)} • Elo ${point.elo}${deltaLabel}${rankLabel}`;
};
