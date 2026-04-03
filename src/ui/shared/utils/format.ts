export const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));

export const formatCount = (value: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.max(0, value));

export const getTodayDateValue = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
