import { getCurrentLanguage } from "../i18n/runtime";

const getIntlLocale = (): string => {
  switch (getCurrentLanguage()) {
    case "de":
      return "de-DE";
    case "en":
    default:
      return "en-US";
  }
};

export const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat(getIntlLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(getIntlLocale(), {
    dateStyle: "medium",
  }).format(new Date(value));

export const formatCount = (value: number): string =>
  new Intl.NumberFormat(getIntlLocale(), { maximumFractionDigits: 0 }).format(Math.max(0, value));

export const getTodayDateValue = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getDateValueMonthsAgo = (months: number, from = new Date()): string => {
  const date = new Date(from);
  date.setMonth(date.getMonth() - months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isPastDateValue = (value: string, todayValue = getTodayDateValue()): boolean =>
  Boolean(value) && value < todayValue;

export const toLocalDateTimeValue = (value: string): string => {
  const date = new Date(value);
  const parts = [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ];
  const time = [
    date.getHours().toString().padStart(2, "0"),
    date.getMinutes().toString().padStart(2, "0"),
  ];

  return `${parts.join("-")}T${time.join(":")}`;
};
