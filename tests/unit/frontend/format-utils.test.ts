import {
  formatDate,
  formatDateTime,
  formatCount,
  getDateValueMonthsAgo,
  getTodayDateValue,
  isPastDateValue,
  toLocalDateTimeValue,
} from "../../../src/ui/shared/utils/format";
import { getCurrentLanguage, setLanguage } from "../../../src/ui/shared/i18n/runtime";

describe("format helpers", () => {
  const nowIso = "2026-04-05T00:00:00.000Z";

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(nowIso));
  });

  afterAll(() => {
    setLanguage("en");
    vi.useRealTimers();
  });

  it("includes the year in formatted date strings", () => {
    expect(formatDate("2026-01-02T00:00:00Z")).toContain("2026");
    expect(formatDateTime("2026-01-02T12:34:56Z")).toContain("2026");
  });

  it("formats dates using the active app language", () => {
    setLanguage("de");
    expect(getCurrentLanguage()).toBe("de");
    expect(formatDate("2026-01-02T00:00:00Z")).toBe(new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
    }).format(new Date("2026-01-02T00:00:00Z")));
    expect(formatCount(1234)).toContain(".");

    setLanguage("en");
    expect(getCurrentLanguage()).toBe("en");
    expect(formatDate("2026-01-02T00:00:00Z")).toBe(new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(new Date("2026-01-02T00:00:00Z")));
    expect(formatCount(1234)).toContain(",");
  });

  it("reports the current date value", () => {
    expect(getTodayDateValue()).toBe("2026-04-05");
  });

  it("calculates dates months in the past", () => {
    expect(getDateValueMonthsAgo(2, new Date("2026-04-05T00:00:00Z"))).toBe("2026-02-05");
  });

  it("detects past date values", () => {
    expect(isPastDateValue("2026-01-01", "2026-04-05")).toBe(true);
    expect(isPastDateValue("2026-04-05", "2026-04-05")).toBe(false);
  });

  it("formats local date-time values with the expected shape", () => {
    const formatted = toLocalDateTimeValue("2026-04-05T12:34:56Z");
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("treats negative counts as zero", () => {
    expect(formatCount(-5)).toBe("0");
    expect(formatCount(1234.5)).toMatch(/\d+/);
  });
});
