import type { UserProgressPoint } from "../../../api/contract";
import type { TextKey } from "../../shared/i18n/translations";
import {
  buildProgressGeometry,
  createInitialProgressPoint,
  MAX_PROGRESS_DISPLAY_POINTS,
  sampleProgressPointsByExtrema,
} from "../progress/utils";
import { formatDate } from "../../shared/utils/format";

type TranslationFn = (key: TextKey) => string;

type Series = {
  name: string;
  currentElo: number;
  points: UserProgressPoint[];
};

const CHART_OFFSET_X = 36;
const CHART_OFFSET_Y = 12;
const CHART_WIDTH = 272;
const CHART_HEIGHT = 100;

const toTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const filterPointsToToday = (points: UserProgressPoint[], nowMs: number): UserProgressPoint[] =>
  points.filter((point) => toTimestamp(point.playedAt) <= nowMs);

const buildSeriesPoints = (series: Series, nowMs: number): UserProgressPoint[] => {
  const sampled = sampleProgressPointsByExtrema(filterPointsToToday(series.points, nowMs), MAX_PROGRESS_DISPLAY_POINTS);
  if (sampled.length > 0) {
    return [createInitialProgressPoint(sampled[0]), ...sampled];
  }

  const now = new Date().toISOString();
  return [
    createInitialProgressPoint(),
    {
      playedAt: now,
      elo: series.currentElo,
      delta: 0,
      label: now,
      rank: null,
    },
  ];
};

const buildCacheKey = (current: Series, shared: Series): string => {
  const lastCurrent = current.points[current.points.length - 1];
  const lastShared = shared.points[shared.points.length - 1];
  return [
    current.name,
    current.currentElo,
    current.points.length,
    lastCurrent?.playedAt ?? "",
    lastCurrent?.elo ?? "",
    shared.name,
    shared.currentElo,
    shared.points.length,
    lastShared?.playedAt ?? "",
    lastShared?.elo ?? "",
  ].join("|");
};

const createLegendItem = (label: string, modifier: string): HTMLElement => {
  const item = document.createElement("span");
  item.className = "shared-progress-compare__legend-item";

  const swatch = document.createElement("span");
  swatch.className = `shared-progress-compare__legend-swatch ${modifier}`;

  const text = document.createElement("span");
  text.textContent = label;

  item.append(swatch, text);
  return item;
};

export const renderSharedProgressComparison = (args: {
  target: HTMLElement;
  currentUserName: string;
  currentUserElo: number;
  currentUserPoints: UserProgressPoint[];
  currentUserHasMatches: boolean;
  sharedUserName: string;
  sharedUserElo: number;
  sharedUserPoints: UserProgressPoint[];
  sharedUserHasMatches: boolean;
  t: TranslationFn;
}): void => {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const currentSeries: Series = {
    name: args.currentUserName,
    currentElo: args.currentUserElo,
    points: filterPointsToToday(args.currentUserPoints, nowMs),
  };
  const sharedSeries: Series = {
    name: args.sharedUserName,
    currentElo: args.sharedUserElo,
    points: filterPointsToToday(args.sharedUserPoints, nowMs),
  };

  const cacheKey = `${buildCacheKey(currentSeries, sharedSeries)}|${nowIso.slice(0, 10)}`;
  const previousCacheKey = (args.target as HTMLElement & { __progressComparisonCacheKey?: string }).__progressComparisonCacheKey;
  if (previousCacheKey === cacheKey) {
    return;
  }
  (args.target as HTMLElement & { __progressComparisonCacheKey?: string }).__progressComparisonCacheKey = cacheKey;

  const currentHasNoMatches = !args.currentUserHasMatches;
  const sharedHasNoMatches = !args.sharedUserHasMatches;
  const currentPoints = buildSeriesPoints(currentSeries, nowMs);
  const sharedPoints = buildSeriesPoints(sharedSeries, nowMs);
  const allPoints = [...currentPoints, ...sharedPoints];

  const eloValues = [...allPoints.map((point) => point.elo), args.currentUserElo, args.sharedUserElo, 1200];
  const actualMin = Math.min(...eloValues);
  const actualMax = Math.max(...eloValues);
  const axisHalfRange = Math.max(Math.max(Math.abs(actualMax - 1200), Math.abs(actualMin - 1200)), 40);
  const axisMin = 1200 - axisHalfRange;
  const axisMax = 1200 + axisHalfRange;

  const currentGeometry = buildProgressGeometry(
    currentPoints,
    CHART_WIDTH,
    CHART_HEIGHT,
    CHART_OFFSET_X,
    CHART_OFFSET_Y,
    axisMin,
    axisMax,
  );
  const sharedGeometry = buildProgressGeometry(
    sharedPoints,
    CHART_WIDTH,
    CHART_HEIGHT,
    CHART_OFFSET_X,
    CHART_OFFSET_Y,
    axisMin,
    axisMax,
  );

  const svgNamespace = "http://www.w3.org/2000/svg";
  const chart = document.createElementNS(svgNamespace, "svg");
  chart.setAttribute("viewBox", "0 0 320 140");
  chart.setAttribute("class", "progress-chart");

  const axis = document.createElementNS(svgNamespace, "path");
  axis.setAttribute("d", "M36 12 L36 112 L308 112");
  axis.setAttribute("class", "progress-axis");

  const baselineY = CHART_OFFSET_Y + CHART_HEIGHT / 2;

  const baseline = document.createElementNS(svgNamespace, "line");
  baseline.setAttribute("x1", "36");
  baseline.setAttribute("x2", "308");
  baseline.setAttribute("y1", baselineY.toFixed(1));
  baseline.setAttribute("y2", baselineY.toFixed(1));
  baseline.setAttribute("class", "progress-baseline");

  const baselineLabel = document.createElementNS(svgNamespace, "text");
  baselineLabel.setAttribute("x", "308");
  baselineLabel.setAttribute("y", (baselineY - 4).toFixed(1));
  baselineLabel.setAttribute("text-anchor", "end");
  baselineLabel.setAttribute("class", "progress-baseline-label");
  baselineLabel.textContent = "1200";

  const yTop = document.createElementNS(svgNamespace, "text");
  yTop.setAttribute("x", "0");
  yTop.setAttribute("y", "18");
  yTop.setAttribute("class", "progress-axis-label");
  yTop.textContent = `${Math.round(axisMax)}`;

  const yBottom = document.createElementNS(svgNamespace, "text");
  yBottom.setAttribute("x", "0");
  yBottom.setAttribute("y", "116");
  yBottom.setAttribute("class", "progress-axis-label");
  yBottom.textContent = `${Math.round(axisMin)}`;

  const yAxisLabel = document.createElementNS(svgNamespace, "text");
  yAxisLabel.setAttribute("x", "16");
  yAxisLabel.setAttribute("y", "70");
  yAxisLabel.setAttribute("text-anchor", "middle");
  yAxisLabel.setAttribute("transform", "rotate(-90 16 70)");
  yAxisLabel.setAttribute("class", "progress-axis-label progress-axis-label--y");
  yAxisLabel.textContent = args.t("progressChartYAxis");

  const currentPath = document.createElementNS(svgNamespace, "path");
  currentPath.setAttribute("d", currentGeometry.path);
  currentPath.setAttribute(
    "class",
    [
      "progress-line",
      "progress-line--self",
      currentHasNoMatches ? "progress-line--dotted" : "",
    ]
      .filter(Boolean)
      .join(" "),
  );

  const sharedPath = document.createElementNS(svgNamespace, "path");
  sharedPath.setAttribute("d", sharedGeometry.path);
  sharedPath.setAttribute(
    "class",
    [
      "progress-line",
      "progress-line--shared",
      sharedHasNoMatches ? "progress-line--dotted" : "",
    ]
      .filter(Boolean)
      .join(" "),
  );

  const currentStartPoint = currentSeries.points[0] ?? null;
  const sharedStartPoint = sharedSeries.points[0] ?? null;

  const xLeftSelf = document.createElementNS(svgNamespace, "text");
  xLeftSelf.setAttribute("x", "36");
  xLeftSelf.setAttribute("y", "126");
  xLeftSelf.setAttribute("class", "progress-axis-label progress-axis-label--self");
  xLeftSelf.textContent = formatDate(currentStartPoint?.playedAt ?? nowIso);

  const xLeftShared = document.createElementNS(svgNamespace, "text");
  xLeftShared.setAttribute("x", "36");
  xLeftShared.setAttribute("y", "136");
  xLeftShared.setAttribute("class", "progress-axis-label progress-axis-label--shared");
  xLeftShared.textContent = formatDate(sharedStartPoint?.playedAt ?? nowIso);

  const xRight = document.createElementNS(svgNamespace, "text");
  xRight.setAttribute("x", "308");
  xRight.setAttribute("y", "134");
  xRight.setAttribute("text-anchor", "end");
  xRight.setAttribute("class", "progress-axis-label");
  xRight.textContent = formatDate(nowIso);

  chart.append(axis, yAxisLabel, baseline, baselineLabel, currentPath, sharedPath, yTop, yBottom, xLeftSelf, xLeftShared, xRight);

  const chartPanel = document.createElement("div");
  chartPanel.className = "progress-chart-panel";

  const chartWrapper = document.createElement("div");
  chartWrapper.className = "progress-chart-wrapper";
  chartWrapper.append(chart);

  const legend = document.createElement("div");
  legend.className = "shared-progress-compare__legend";
  legend.append(
    createLegendItem(`${args.currentUserName}: ${args.t("progressElo")} ${args.currentUserElo}`, "shared-progress-compare__legend-swatch--self"),
    createLegendItem(`${args.sharedUserName}: ${args.t("progressElo")} ${args.sharedUserElo}`, "shared-progress-compare__legend-swatch--shared"),
  );

  chartPanel.append(chartWrapper, legend);
  args.target.replaceChildren(chartPanel);
};
