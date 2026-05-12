import type { SegmentGameScoreChart } from "../../../api/contract";
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
    renderCharts: (seasonName: string, charts: SegmentGameScoreChart[]): void => {
      title.textContent = `${seasonName} • ${t("seasonStatsModalTitle")}`;
      status.hidden = true;
      content.replaceChildren(...charts.map((chart) => createChartSection(chart, t)));
      overlay.hidden = false;
      overlay.focus();
    },
  };
};
