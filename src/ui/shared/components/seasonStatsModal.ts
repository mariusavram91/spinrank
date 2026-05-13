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
      content.replaceChildren(
        ...(attendanceSection ? [attendanceSection] : []),
        ...matchupCharts.map((chart) => createMatchupChartSection(chart, t)),
        ...charts.map((chart) => createChartSection(chart, t)),
      );
      overlay.hidden = false;
      overlay.focus();
    },
  };
};
