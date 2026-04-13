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

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SessionStoreDeps {
  storage: SessionStorageLike;
  now?: () => number;
  storageKey?: string;
}

const getBrowserStorage = (): SessionStorageLike => {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("Browser storage is not available in this environment.");
  }

  return window.localStorage;
};

export const createSessionStore = ({
  storage,
  now = Date.now,
  storageKey = STORAGE_KEY,
}: SessionStoreDeps) => {
  const loadSession = (): AppSession | null => {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isSessionShape(parsed)) {
        storage.removeItem(storageKey);
        return null;
      }

      if (Date.parse(parsed.expiresAt) <= now()) {
        storage.removeItem(storageKey);
        return null;
      }

      return {
        ...parsed,
        user: {
          ...parsed.user,
          locale: parsed.user.locale === "de" ? "de" : "en",
        },
      };
    } catch {
      storage.removeItem(storageKey);
      return null;
    }
  };

  const saveSession = (session: AppSession): void => {
    storage.setItem(storageKey, JSON.stringify(session));
  };

  const clearSession = (): void => {
    storage.removeItem(storageKey);
  };

  return {
    loadSession,
    saveSession,
    clearSession,
  };
};

export const loadSession = (): AppSession | null =>
  createSessionStore({
    storage: getBrowserStorage(),
  }).loadSession();

export const saveSession = (session: AppSession): void => {
  createSessionStore({
    storage: getBrowserStorage(),
  }).saveSession(session);
};

export const clearSession = (): void => {
  createSessionStore({
    storage: getBrowserStorage(),
  }).clearSession();
};
