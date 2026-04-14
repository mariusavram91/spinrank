import type { ActivityHeatmapData } from "../../../api/contract";
import type { TextKey } from "../../shared/i18n/translations";

type TranslationFn = (key: TextKey) => string;

type HeatmapDay = {
  date: string;
  matches: number;
  wins: number;
  losses: number;
};

const CELL_LEVELS = [0, 1, 2, 3, 4] as const;

const createEmptyState = (message: string): HTMLParagraphElement => {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
};

const toUtcDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const addUtcDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getDayLevel = (matches: number, minMatches: number, maxMatches: number): number => {
  if (matches <= 0) {
    return 0;
  }

  if (minMatches === maxMatches) {
    return 4;
  }

  const ratio = (matches - minMatches) / (maxMatches - minMatches);
  return Math.min(4, Math.max(1, 1 + Math.floor(ratio * 3)));
};

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

export const renderActivityHeatmap = (args: {
  target: HTMLElement;
  data: ActivityHeatmapData | null;
  locale: string;
  t: TranslationFn;
}): void => {
  const previousController = (args.target as HTMLElement & { __activityHeatmapAbortController?: AbortController })
    .__activityHeatmapAbortController;
  previousController?.abort();

  if (!args.data) {
    args.target.replaceChildren(createEmptyState(args.t("profileStatsLoading")));
    return;
  }

  const controller = new AbortController();
  (args.target as HTMLElement & { __activityHeatmapAbortController?: AbortController }).__activityHeatmapAbortController =
    controller;

  const data = args.data;
  const numberFormatter = new Intl.NumberFormat(args.locale);
  const monthFormatter = new Intl.DateTimeFormat(args.locale, { month: "short", timeZone: "UTC" });
  const weekdayFormatter = new Intl.DateTimeFormat(args.locale, { weekday: "short", timeZone: "UTC" });
  const tooltipDateFormatter = new Intl.DateTimeFormat(args.locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const summary = document.createElement("div");
  summary.className = "activity-heatmap__summary";

  const heading = document.createElement("p");
  heading.className = "profile-section__subtitle";

  const stats = document.createElement("div");
  stats.className = "profile-segment-card__stats";
  summary.append(heading, stats);

  const map = new Map(data.days.map((day) => [day.date, day]));
  const firstDate = toUtcDate(data.startDate);
  const lastDate = toUtcDate(data.endDate);
  const days: HeatmapDay[] = [];
  for (let cursor = new Date(firstDate); cursor <= lastDate; cursor = addUtcDays(cursor, 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const entry = map.get(date);
    days.push(
      entry ?? {
        date,
        matches: 0,
        wins: 0,
        losses: 0,
      },
    );
  }

  const weeks: HeatmapDay[][] = [];
  days.forEach((day, index) => {
    const weekIndex = Math.floor(index / 7);
    const week = weeks[weekIndex] ?? [];
    week.push(day);
    weeks[weekIndex] = week;
  });
  const activeMatchCounts = data.days.map((day) => day.matches).filter((count) => count > 0);
  const minMatches = activeMatchCounts.length > 0 ? Math.min(...activeMatchCounts) : 0;
  const maxMatches = activeMatchCounts.length > 0 ? Math.max(...activeMatchCounts) : 0;

  const months = document.createElement("div");
  months.className = "activity-heatmap__months";
  months.style.setProperty("--activity-heatmap-weeks", String(weeks.length));
  weeks.forEach((week, index) => {
    const label = document.createElement("span");
    label.className = "activity-heatmap__month";
    const firstWeekDate = toUtcDate(week[0].date);
    const previousWeekDate = index > 0 ? toUtcDate(weeks[index - 1][0].date) : null;
    label.textContent =
      index === 0 || !previousWeekDate || previousWeekDate.getUTCMonth() !== firstWeekDate.getUTCMonth()
        ? monthFormatter.format(firstWeekDate)
        : "";
    months.append(label);
  });

  const weekdays = document.createElement("div");
  weekdays.className = "activity-heatmap__weekday-rail";
  const weekdaySpacer = document.createElement("span");
  weekdaySpacer.className = "activity-heatmap__weekday-spacer";
  weekdays.append(weekdaySpacer);
  const weekdayLabels = document.createElement("div");
  weekdayLabels.className = "activity-heatmap__weekdays";
  const weekdayLabelDays = [0, 1, 2, 3, 4, 5, 6].map((offset) => addUtcDays(firstDate, offset));
  weekdayLabelDays.forEach((date, index) => {
    const label = document.createElement("span");
    label.className = "activity-heatmap__weekday";
    label.textContent = index % 2 === 0 ? weekdayFormatter.format(date) : "";
    weekdayLabels.append(label);
  });
  weekdays.append(weekdayLabels);

  const grid = document.createElement("div");
  grid.className = "activity-heatmap__grid";
  grid.style.setProperty("--activity-heatmap-weeks", String(weeks.length));

  let selectedDate = "";
  const cellByDate = new Map<string, HTMLButtonElement>();

  const renderSummary = (selectedDay: HeatmapDay | null): void => {
    heading.textContent = selectedDay
      ? tooltipDateFormatter.format(toUtcDate(selectedDay.date))
      : args.t("activityHeatmapPeriodLabel");
    stats.replaceChildren();

    const entries = selectedDay
      ? [
          `${args.t("activityHeatmapMatchesLabel")} ${numberFormatter.format(selectedDay.matches)}`,
          `${args.t("activityHeatmapRecordLabel")} ${numberFormatter.format(selectedDay.wins)}-${numberFormatter.format(selectedDay.losses)}`,
          `${args.t("activityHeatmapWinRateLabel")} ${formatPercent(
            selectedDay.matches > 0 ? selectedDay.wins / selectedDay.matches : 0,
          )}`,
        ]
      : [
          `${args.t("activityHeatmapMatchesLabel")} ${numberFormatter.format(data.totalMatches)}`,
          `${args.t("activityHeatmapActiveDaysLabel")} ${numberFormatter.format(data.activeDays)}`,
          `${args.t("activityHeatmapWinRateLabel")} ${formatPercent(
            data.totalMatches > 0 ? data.totalWins / data.totalMatches : 0,
          )}`,
        ];

    entries.forEach((text) => {
      const chip = document.createElement("span");
      chip.className = "profile-stat-chip";
      chip.textContent = text;
      stats.append(chip);
    });
  };

  const syncSelectedCell = (): void => {
    cellByDate.forEach((cell, date) => {
      cell.setAttribute("aria-pressed", String(date === selectedDate));
    });
  };

  weeks.forEach((week) => {
    week.forEach((day) => {
      const cell = document.createElement("button");
      cell.type = "button";
      const level = getDayLevel(day.matches, minMatches, maxMatches);
      const cellDate = toUtcDate(day.date);
      const tooltip =
        day.matches > 0
          ? `${tooltipDateFormatter.format(cellDate)}: ${numberFormatter.format(day.matches)} ${args.t("activityHeatmapMatchesLabel")}, ${numberFormatter.format(day.wins)} ${args.t("leaderboardWins")}, ${numberFormatter.format(day.losses)} ${args.t("leaderboardLosses")}, ${formatPercent(day.wins / day.matches)} ${args.t("activityHeatmapWinRateLabel")}`
          : `${tooltipDateFormatter.format(cellDate)}: ${args.t("activityHeatmapNoMatches")}`;
      cell.className = `activity-heatmap__cell activity-heatmap__cell--level-${level}`;
      cell.title = tooltip;
      cell.setAttribute("aria-label", tooltip);
      cell.setAttribute("aria-pressed", "false");
      cell.dataset.date = day.date;
      cell.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();
          selectedDate = selectedDate === day.date ? "" : day.date;
          syncSelectedCell();
          renderSummary(selectedDate ? day : null);
        },
        { signal: controller.signal },
      );
      cellByDate.set(day.date, cell);
      grid.append(cell);
    });
  });

  renderSummary(null);

  const legend = document.createElement("div");
  legend.className = "activity-heatmap__legend";
  const less = document.createElement("span");
  less.textContent = args.t("activityHeatmapLegendLess");
  const more = document.createElement("span");
  more.textContent = args.t("activityHeatmapLegendMore");
  const levels = document.createElement("div");
  levels.className = "activity-heatmap__legend-scale";
  CELL_LEVELS.forEach((level) => {
    const swatch = document.createElement("span");
    swatch.className = `activity-heatmap__cell activity-heatmap__cell--level-${level}`;
    swatch.setAttribute("aria-hidden", "true");
    levels.append(swatch);
  });
  legend.append(less, levels, more);

  const body = document.createElement("div");
  body.className = "activity-heatmap__body";
  const bodyViewport = document.createElement("div");
  bodyViewport.className = "activity-heatmap__body-viewport";
  bodyViewport.append(months, grid);
  body.append(weekdays, bodyViewport);

  const scrollViewport = document.createElement("div");
  scrollViewport.className = "activity-heatmap__viewport";
  scrollViewport.append(body);

  const frame = document.createElement("div");
  frame.className = "activity-heatmap";
  frame.append(summary, scrollViewport, legend);
  if (data.totalMatches === 0) {
    const empty = document.createElement("p");
    empty.className = "profile-section__subtitle";
    empty.textContent = args.t("activityHeatmapEmpty");
    frame.append(empty);
  }

  args.target.replaceChildren(frame);
  requestAnimationFrame(() => {
    bodyViewport.scrollLeft = Math.max(0, bodyViewport.scrollWidth - bodyViewport.clientWidth);
  });
  document.addEventListener(
    "click",
    (event) => {
      if (!body.contains(event.target as Node)) {
        selectedDate = "";
        syncSelectedCell();
        renderSummary(null);
      }
    },
    { signal: controller.signal },
  );
};
