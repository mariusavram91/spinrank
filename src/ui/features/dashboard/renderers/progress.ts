import type { DashboardState } from "../../../shared/types/app";
import type { TextKey } from "../../../shared/i18n/translations";
import {
  buildProgressGeometry,
  createInitialProgressPoint,
  MAX_PROGRESS_DISPLAY_POINTS,
  sampleProgressPointsByExtrema,
} from "../../progress/utils";
import { formatDate } from "../../../shared/utils/format";

type TranslationFn = (key: TextKey) => string;

const createProgressSummaryItem = (text: string): HTMLSpanElement => {
  const item = document.createElement("span");
  item.className = "progress-summary__item";
  item.textContent = text;
  return item;
};

export const createProgressRenderer = (args: {
  dashboardState: DashboardState;
  progressSummary: HTMLElement;
  progressSubtitleRankLabel: HTMLElement;
  progressSubtitleRankValue: HTMLElement;
  progressSubtitleElo: HTMLElement;
  progressBody: HTMLElement;
  t: TranslationFn;
}): { render: () => void } => ({
  render: () => {
    if (!args.dashboardState.userProgress) {
      args.progressSummary.hidden = true;
      args.progressSummary.replaceChildren();
      args.progressSubtitleRankLabel.textContent = "";
      args.progressSubtitleRankValue.textContent = "";
      args.progressSubtitleRankValue.classList.add("progress-subtitle__rank-value--hidden");
      args.progressSubtitleElo.textContent = "";
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = args.t("progressEmpty");
      args.progressBody.replaceChildren(empty);
      return;
    }

    const progress = args.dashboardState.userProgress;
    const totalMatches = progress.wins + progress.losses;
    const singlesMatches = progress.singles.matches;

    const rankLabelText =
      progress.currentRank === null ? args.t("progressUnranked") : args.t("progressRanked");
    args.progressSummary.hidden = false;
    args.progressSummary.replaceChildren(
      createProgressSummaryItem(`${args.t("progressBestElo")}: ${progress.bestElo}`),
      createProgressSummaryItem(`${args.t("progressBestStreak")}: ${progress.bestStreak}`),
    );
    args.progressSubtitleRankLabel.textContent = rankLabelText;
    if (progress.currentRank !== null) {
      args.progressSubtitleRankValue.textContent = `#${progress.currentRank}`;
      args.progressSubtitleRankValue.classList.remove("progress-subtitle__rank-value--hidden");
    } else {
      args.progressSubtitleRankValue.textContent = "";
      args.progressSubtitleRankValue.classList.add("progress-subtitle__rank-value--hidden");
    }
    args.progressSubtitleElo.textContent = `${args.t("progressElo")} ${progress.currentElo}`;

    const svgNamespace = "http://www.w3.org/2000/svg";
    const initialPoint = createInitialProgressPoint(progress.points[0]);
    const basePoints = [initialPoint, ...progress.points];
    const displayPoints = sampleProgressPointsByExtrema(basePoints, MAX_PROGRESS_DISPLAY_POINTS);

    const eloValues = [
      ...(progress.points.length > 0 ? progress.points.map((point) => point.elo) : [progress.currentElo]),
      progress.currentElo,
      progress.bestElo,
    ];
    const actualMin = Math.min(...eloValues);
    const actualMax = Math.max(...eloValues);
    const axisHalfRange = Math.max(
      Math.max(Math.abs(actualMax - 1200), Math.abs(actualMin - 1200)),
      40,
    );
    const axisMin = 1200 - axisHalfRange;
    const axisMax = 1200 + axisHalfRange;
    const geometry = buildProgressGeometry(
      displayPoints,
      272,
      100,
      36,
      12,
      axisMin,
      axisMax,
    );
    const chart = document.createElementNS(svgNamespace, "svg");
    chart.setAttribute("viewBox", "0 0 320 140");
    chart.setAttribute("class", "progress-chart");

    const axis = document.createElementNS(svgNamespace, "path");
    axis.setAttribute("d", "M36 12 L36 112 L308 112");
    axis.setAttribute("class", "progress-axis");

    const baselineY = 12 + 100 / 2;

    const yAxisLabel = document.createElementNS(svgNamespace, "text");
    yAxisLabel.setAttribute("x", "16");
    yAxisLabel.setAttribute("y", "70");
    yAxisLabel.setAttribute("text-anchor", "middle");
    yAxisLabel.setAttribute("transform", "rotate(-90 16 70)");
    yAxisLabel.setAttribute("class", "progress-axis-label progress-axis-label--y");
    yAxisLabel.textContent = args.t("progressChartYAxis");

    const baselineLine = document.createElementNS(svgNamespace, "line");
    baselineLine.setAttribute("x1", "36");
    baselineLine.setAttribute("x2", "308");
    baselineLine.setAttribute("y1", baselineY.toFixed(1));
    baselineLine.setAttribute("y2", baselineY.toFixed(1));
    baselineLine.setAttribute("class", "progress-baseline");

    const baselineLabel = document.createElementNS(svgNamespace, "text");
    baselineLabel.setAttribute("x", "308");
    baselineLabel.setAttribute("y", (baselineY - 4).toFixed(1));
    baselineLabel.setAttribute("text-anchor", "end");
    baselineLabel.setAttribute("class", "progress-baseline-label");
    baselineLabel.textContent = "1200";

    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("d", geometry.path);
    path.setAttribute("class", "progress-line");

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

    const firstPoint = displayPoints[0];
    const lastPoint = displayPoints[displayPoints.length - 1];

    const xLeft = document.createElementNS(svgNamespace, "text");
    xLeft.setAttribute("x", "36");
    xLeft.setAttribute("y", "134");
    xLeft.setAttribute("class", "progress-axis-label");
    xLeft.textContent = formatDate(firstPoint.playedAt);

    const xRight = document.createElementNS(svgNamespace, "text");
    xRight.setAttribute("x", "308");
    xRight.setAttribute("y", "134");
    xRight.setAttribute("text-anchor", "end");
    xRight.setAttribute("class", "progress-axis-label");
    xRight.textContent = formatDate(lastPoint.playedAt);

    chart.append(axis, yAxisLabel, baselineLine, baselineLabel, path, yTop, yBottom, xLeft, xRight);

    const progressLayout = document.createElement("div");
    progressLayout.className = "progress-layout";

    const chartPanel = document.createElement("div");
    chartPanel.className = "progress-chart-panel";

    const chartWrapper = document.createElement("div");
    chartWrapper.className = "progress-chart-wrapper";
    chartWrapper.append(chart);
    chartPanel.append(chartWrapper);

    const donutPanel = document.createElement("div");
    donutPanel.className = "progress-donut-panel";

    const donutSize = 96;
    const donutRadius = 36;
    const donutCircumference = 2 * Math.PI * donutRadius;
    const winsRatio = totalMatches === 0 ? 0 : progress.wins / totalMatches;
    const successColor = winsRatio < 0.45 ? "#8fdc5b" : "var(--brand-rank)";

    const donutSvg = document.createElementNS(svgNamespace, "svg");
    donutSvg.setAttribute("viewBox", `0 0 ${donutSize} ${donutSize}`);
    donutSvg.setAttribute("class", "progress-donut-ring");

    const donutBg = document.createElementNS(svgNamespace, "circle");
    donutBg.setAttribute("cx", String(donutSize / 2));
    donutBg.setAttribute("cy", String(donutSize / 2));
    donutBg.setAttribute("r", String(donutRadius));
    donutBg.setAttribute("class", "progress-donut-ring-bg");

    const winsArc = document.createElementNS(svgNamespace, "circle");
    winsArc.setAttribute("cx", String(donutSize / 2));
    winsArc.setAttribute("cy", String(donutSize / 2));
    winsArc.setAttribute("r", String(donutRadius));
    winsArc.setAttribute("class", "progress-donut-ring-wins");
    winsArc.style.stroke = successColor;
    winsArc.setAttribute("stroke-dasharray", `${donutCircumference} ${donutCircumference}`);
    winsArc.setAttribute("stroke-dashoffset", (donutCircumference * (1 - winsRatio)).toFixed(2));
    winsArc.setAttribute("transform", `rotate(-90 ${donutSize / 2} ${donutSize / 2})`);

    donutSvg.append(donutBg, winsArc);

    const successPercent = Math.round(winsRatio * 100);
    const donutSvgWrapper = document.createElement("div");
    donutSvgWrapper.className = "progress-donut-svg";
    const successLabel = document.createElement("span");
    successLabel.className = "progress-donut-success";
    successLabel.textContent = `${successPercent}%`;
    successLabel.style.color = successColor;
    donutSvgWrapper.append(donutSvg, successLabel);

    const createStatRow = (
      label: string,
      value: string,
      indicatorModifier?: string,
    ): HTMLDivElement => {
      const row = document.createElement("div");
      row.className = "progress-donut-stat-row";

      const labelWrapper = document.createElement("div");
      labelWrapper.className = "progress-donut-stat-row-label";

      const indicator = document.createElement("span");
      indicator.className = "progress-donut-legend-indicator";
      if (indicatorModifier) {
        indicator.classList.add(indicatorModifier);
      } else {
        indicator.classList.add("progress-donut-legend-indicator--empty");
      }
      labelWrapper.append(indicator);

      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      labelWrapper.append(labelNode);

      const valueNode = document.createElement("span");
      valueNode.className = "progress-donut-stat-row-value";
      valueNode.textContent = value;

      row.append(labelWrapper, valueNode);
      return row;
    };

    const statsColumn = document.createElement("div");
    statsColumn.className = "progress-donut-stats";
    statsColumn.append(
      createStatRow(args.t("progressMatchesLabel"), `${totalMatches} (${singlesMatches})`),
      createStatRow(
        args.t("leaderboardWins"),
        `${progress.wins} (${progress.singles.wins})`,
        "progress-donut-legend-indicator--wins",
      ),
      createStatRow(
        args.t("leaderboardLosses"),
        `${progress.losses} (${progress.singles.losses})`,
        "progress-donut-legend-indicator--losses",
      ),
    );

    const donutRow = document.createElement("div");
    donutRow.className = "progress-donut-row";
    donutRow.append(donutSvgWrapper, statsColumn);

    donutPanel.append(donutRow);
    progressLayout.append(chartPanel, donutPanel);
    args.progressBody.replaceChildren(progressLayout);
  },
});
