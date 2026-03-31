import type { AppSession } from "../api/contract";

const STORAGE_KEY = "spinrank.session";

const isSessionShape = (value: unknown): value is AppSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<AppSession>;
  return (
    typeof session.sessionToken === "string" &&
    typeof session.expiresAt === "string" &&
    !!session.user &&
    typeof session.user.id === "string" &&
    typeof session.user.displayName === "string" &&
    typeof session.user.provider === "string"
  );
};

export const isExpiredSession = (session: AppSession): boolean =>
  Date.parse(session.expiresAt) <= Date.now();

export const loadSession = (): AppSession | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isSessionShape(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (isExpiredSession(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const saveSession = (session: AppSession): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearSession = (): void => {
  window.localStorage.removeItem(STORAGE_KEY);
};
