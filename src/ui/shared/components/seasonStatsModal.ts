import type { SegmentGameScoreChart, SegmentMatchupChart } from "../../../api/contract";
import type { TextKey } from "../i18n/translations";

type TranslationFn = (key: TextKey) => string;

function formatChartTitle(chart: SegmentGameScoreChart, t: TranslationFn): string {
  const matchTypeLabel = chart.matchType === "singles" ? t("matchTypeSingles") : t("matchTypeDoubles");
  return `${matchTypeLabel} • ${chart.pointsToWin}`;
}

function createBarColumn(bar: SegmentGameScoreChart["bars"][number], maxGames: number): HTMLElement {
  const column = document.createElement("div");
  column.className = "season-stats-chart__column";

  const value = document.createElement("span");
  value.className = "season-stats-chart__value";
  value.textContent = String(bar.gamesPlayed);

  const barTrack = document.createElement("div");
  barTrack.className = "season-stats-chart__bar-track";

  const barNode = document.createElement("div");
  barNode.className = "season-stats-chart__bar";
  barNode.style.height = `${maxGames > 0 ? Math.max(8, (bar.gamesPlayed / maxGames) * 100) : 8}%`;
  barNode.setAttribute("aria-hidden", "true");
  barTrack.append(barNode);

  const score = document.createElement("span");
  score.className = "season-stats-chart__label";
  score.textContent = bar.scoreLabel;

  column.title = `${bar.scoreLabel}: ${bar.gamesPlayed}`;
  column.append(value, barTrack, score);
  return column;
}

function createChartSection(chart: SegmentGameScoreChart, t: TranslationFn): HTMLElement {
  const section = document.createElement("section");
  section.className = "season-stats-chart";

  const header = document.createElement("div");
  header.className = "season-stats-chart__header";

  const title = document.createElement("h4");
  title.className = "season-stats-chart__title";
  title.textContent = formatChartTitle(chart, t);

  const meta = document.createElement("p");
  meta.className = "season-stats-chart__meta";
  meta.textContent = `${t("seasonStatsTotalGames")} ${chart.totalGames}`;

  header.append(title, meta);

  const plot = document.createElement("div");
  plot.className = "season-stats-chart__plot";
  const maxGames = chart.bars.reduce((max, bar) => Math.max(max, bar.gamesPlayed), 0);
  plot.append(...chart.bars.map((bar) => createBarColumn(bar, maxGames)));

  section.append(header, plot);
  return section;
}

function createMatchupRow(bar: SegmentMatchupChart["bars"][number], maxMatches: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "season-stats-matchup__row";

  const label = document.createElement("span");
  label.className = "season-stats-matchup__label";
  label.textContent = bar.label;

  const barTrack = document.createElement("div");
  barTrack.className = "season-stats-matchup__bar-track";

  const barNode = document.createElement("div");
  barNode.className = "season-stats-matchup__bar";
  barNode.style.width = `${maxMatches > 0 ? Math.max(4, (bar.matchesPlayed / maxMatches) * 100) : 4}%`;
  barTrack.append(barNode);

  const value = document.createElement("span");
  value.className = "season-stats-matchup__value";
  value.textContent = String(bar.matchesPlayed);

  row.title = `${bar.label}: ${bar.matchesPlayed}`;
  row.append(label, barTrack, value);
  return row;
}

function createMatchupChartSection(chart: SegmentMatchupChart, t: TranslationFn): HTMLElement {
  const section = document.createElement("section");
  section.className = "season-stats-chart";

  const header = document.createElement("div");
  header.className = "season-stats-chart__header";

  const title = document.createElement("h4");
  title.className = "season-stats-chart__title";
  title.textContent =
    chart.matchType === "singles" ? t("seasonStatsSinglesMatchups") : t("seasonStatsDoublesMatchups");

  const meta = document.createElement("p");
  meta.className = "season-stats-chart__meta";
  meta.textContent = `${t("seasonStatsTotalMatches")} ${chart.totalMatches}`;

  header.append(title, meta);

  const list = document.createElement("div");
  list.className = "season-stats-matchup";
  const maxMatches = chart.bars.reduce((max, bar) => Math.max(max, bar.matchesPlayed), 0);
  list.append(...chart.bars.map((bar) => createMatchupRow(bar, maxMatches)));

  section.append(header, list);
  return section;
}

function createAttendanceRow(bar: {
  label: string;
  attendedWeeks: number;
  totalWeeks: number;
  attendanceRate: number;
}): HTMLElement {
  const row = document.createElement("div");
  row.className = "season-stats-matchup__row";

  const label = document.createElement("span");
  label.className = "season-stats-matchup__label";
  label.textContent = bar.label;

  const barTrack = document.createElement("div");
  barTrack.className = "season-stats-matchup__bar-track";

  const barNode = document.createElement("div");
  barNode.className = "season-stats-attendance__bar";
  barNode.style.width = `${Math.max(4, bar.attendanceRate * 100)}%`;
  barTrack.append(barNode);

  const value = document.createElement("span");
  value.className = "season-stats-matchup__value";
  value.textContent = `${bar.attendedWeeks}/${bar.totalWeeks}`;

  row.title = `${bar.label}: ${bar.attendedWeeks}/${bar.totalWeeks}`;
  row.append(label, barTrack, value);
  return row;
}

function createAttendanceSection(
  attendanceBars: Array<{
    label: string;
    attendedWeeks: number;
    totalWeeks: number;
    attendanceRate: number;
  }>,
  t: TranslationFn,
): HTMLElement | null {
  if (attendanceBars.length === 0) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "season-stats-chart";

  const header = document.createElement("div");
  header.className = "season-stats-chart__header";

  const title = document.createElement("h4");
  title.className = "season-stats-chart__title";
  title.textContent = t("seasonStatsAttendance");

  const maxWeeks = attendanceBars.reduce((max, bar) => Math.max(max, bar.totalWeeks), 0);
  const meta = document.createElement("p");
  meta.className = "season-stats-chart__meta";
  meta.textContent = `${t("seasonStatsTotalWeeks")} ${maxWeeks}`;

  header.append(title, meta);

  const list = document.createElement("div");
  list.className = "season-stats-matchup";
  list.append(...attendanceBars.map((bar) => createAttendanceRow(bar)));

  section.append(header, list);
  return section;
}

function createWeeklyActivitySection(
  weeklyActivityBars: Array<{
    label: string;
    matchesPlayed: number;
  }>,
  t: TranslationFn,
): HTMLElement | null {
  if (weeklyActivityBars.length === 0) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "season-stats-chart";

  const header = document.createElement("div");
  header.className = "season-stats-chart__header";

  const title = document.createElement("h4");
  title.className = "season-stats-chart__title";
  title.textContent = t("seasonStatsWeeklyActivity");

  const meta = document.createElement("p");
  meta.className = "season-stats-chart__meta";
  meta.textContent = `${t("seasonStatsPeakWeek")} ${Math.max(...weeklyActivityBars.map((bar) => bar.matchesPlayed), 0)}`;

  header.append(title, meta);

  const chart = document.createElement("div");
  chart.className = "season-stats-line";

  const maxMatches = Math.max(...weeklyActivityBars.map((bar) => bar.matchesPlayed), 0);
  const points = weeklyActivityBars.map((bar, index) => {
    const x = ((index + 0.5) / weeklyActivityBars.length) * 100;
    const y = maxMatches === 0 ? 100 : 100 - (bar.matchesPlayed / maxMatches) * 100;
    return { ...bar, x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.classList.add("season-stats-line__svg");

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "path");
  polyline.setAttribute("d", path);
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("vector-effect", "non-scaling-stroke");
  polyline.classList.add("season-stats-line__path");
  svg.append(polyline);

  const pointsRow = document.createElement("div");
  pointsRow.className = "season-stats-line__points";
  pointsRow.append(
    ...points.map((point) => {
      const item = document.createElement("div");
      item.className = "season-stats-line__point";
      item.style.left = `${point.x}%`;
      item.style.top = `${point.y}%`;
      item.title = `${point.label}: ${point.matchesPlayed}`;

      const dot = document.createElement("span");
      dot.className = "season-stats-line__dot";

      const value = document.createElement("span");
      value.className = "season-stats-line__value";
      value.textContent = String(point.matchesPlayed);

      item.append(dot, value);
      return item;
    }),
  );

  const labels = document.createElement("div");
  labels.className = "season-stats-line__labels";
  labels.append(
    ...weeklyActivityBars.map((bar) => {
      const label = document.createElement("span");
      label.className = "season-stats-line__label";
      label.textContent = bar.label;
      return label;
    }),
  );

  chart.append(svg, pointsRow, labels);
  section.append(header, chart);
  return section;
}

function createMatchTypeSplitSection(
  bars: Array<{
    matchType: "singles" | "doubles";
    label: string;
    matchesPlayed: number;
    share: number;
  }>,
  t: TranslationFn,
): HTMLElement | null {
  if (bars.length === 0) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "season-stats-chart";

  const header = document.createElement("div");
  header.className = "season-stats-chart__header";

  const title = document.createElement("h4");
  title.className = "season-stats-chart__title";
  title.textContent = t("seasonStatsMatchTypeSplit");

  const meta = document.createElement("p");
  meta.className = "season-stats-chart__meta";
  meta.textContent = `${t("seasonStatsTotalMatches")} ${bars.reduce((sum, bar) => sum + bar.matchesPlayed, 0)}`;

  header.append(title, meta);

  const body = document.createElement("div");
  body.className = "season-stats-pie";

  const pie = document.createElement("div");
  pie.className = "season-stats-pie__chart";
  const singlesShare = bars.find((bar) => bar.matchType === "singles")?.share ?? 0;
  const singlesAngle = singlesShare * 360;
  pie.style.background = `conic-gradient(
    rgba(46, 123, 160, 0.95) 0deg ${singlesAngle}deg,
    rgba(99, 154, 24, 0.92) ${singlesAngle}deg 360deg
  )`;
  pie.setAttribute("aria-hidden", "true");

  const legend = document.createElement("div");
  legend.className = "season-stats-pie__legend";
  legend.append(
    ...bars.map((bar) => {
      const item = document.createElement("div");
      item.className = "season-stats-pie__legend-item";

      const swatch = document.createElement("span");
      swatch.className = "season-stats-pie__swatch";
      swatch.dataset.matchType = bar.matchType;

      const label = document.createElement("span");
      label.className = "season-stats-pie__legend-label";
      label.textContent = bar.matchType === "singles" ? t("matchTypeSingles") : t("matchTypeDoubles");

      const value = document.createElement("span");
      value.className = "season-stats-pie__legend-value";
      value.textContent = `${bar.matchesPlayed} • ${(bar.share * 100).toFixed(0)}%`;

      item.append(swatch, label, value);
      return item;
    }),
  );

  body.append(pie, legend);

  section.append(header, body);
  return section;
}

export const buildSeasonStatsModal = (t: TranslationFn) => {
  const overlay = document.createElement("div");
  overlay.className = "delete-warning-overlay";
  overlay.hidden = true;
  overlay.tabIndex = -1;

  const modal = document.createElement("div");
  modal.className = "delete-warning-modal season-stats-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const header = document.createElement("div");
  header.className = "season-stats-modal__header";

  const heading = document.createElement("div");
  heading.className = "season-stats-modal__heading";

  const title = document.createElement("h3");
  title.className = "delete-warning__title";

  const description = document.createElement("p");
  description.className = "delete-warning__description";
  description.textContent = t("seasonStatsModalDescription");

  heading.append(title, description);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "icon-button season-stats-modal__close";
  closeButton.textContent = "✕";
  closeButton.setAttribute("aria-label", t("close"));

  header.append(heading, closeButton);

  const status = document.createElement("p");
  status.className = "season-stats-modal__status";
  status.hidden = true;

  const content = document.createElement("div");
  content.className = "season-stats-modal__content";

  const close = (): void => {
    overlay.hidden = true;
    overlay.remove();
  };

  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });

  modal.append(header, status, content);
  overlay.append(modal);

  return {
    overlay,
    showLoading: (seasonName: string): void => {
      title.textContent = `${seasonName} • ${t("seasonStatsModalTitle")}`;
      status.hidden = false;
      status.textContent = t("loadingOverlay");
      content.replaceChildren();
      overlay.hidden = false;
      overlay.focus();
    },
    showError: (seasonName: string, message: string): void => {
      title.textContent = `${seasonName} • ${t("seasonStatsModalTitle")}`;
      status.hidden = false;
      status.textContent = message;
      content.replaceChildren();
      overlay.hidden = false;
      overlay.focus();
    },
    renderCharts: (
      seasonName: string,
      charts: SegmentGameScoreChart[],
      matchupCharts: SegmentMatchupChart[],
      weeklyActivityBars: Array<{
        label: string;
        matchesPlayed: number;
      }>,
      matchTypeSplitBars: Array<{
        matchType: "singles" | "doubles";
        label: string;
        matchesPlayed: number;
        share: number;
      }>,
      attendanceBars: Array<{
        label: string;
        attendedWeeks: number;
        totalWeeks: number;
        attendanceRate: number;
      }>,
    ): void => {
      title.textContent = `${seasonName} • ${t("seasonStatsModalTitle")}`;
      status.hidden = true;
      const attendanceSection = createAttendanceSection(attendanceBars, t);
      const weeklyActivitySection = createWeeklyActivitySection(weeklyActivityBars, t);
      const matchTypeSplitSection = createMatchTypeSplitSection(matchTypeSplitBars, t);
      content.replaceChildren(
        ...(attendanceSection ? [attendanceSection] : []),
        ...(weeklyActivitySection ? [weeklyActivitySection] : []),
        ...(matchTypeSplitSection ? [matchTypeSplitSection] : []),
        ...matchupCharts.map((chart) => createMatchupChartSection(chart, t)),
        ...charts.map((chart) => createChartSection(chart, t)),
      );
      overlay.hidden = false;
      overlay.focus();
    },
  };
};
