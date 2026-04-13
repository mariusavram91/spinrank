import type { AppSession } from "../../../src/api/contract";
import {
  createSessionStore,
  isExpiredSession,
} from "../../../src/auth/session";

const createStorage = (initialValue?: string) => {
  const values = new Map<string, string>();
  if (initialValue) {
    values.set("spinrank.session", initialValue);
  }

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};

const buildSession = (expiresAt: string): AppSession => ({
  sessionToken: "token_123",
  expiresAt,
  user: {
    id: "user_1",
    displayName: "Ada",
    provider: "google",
    email: "ada@example.com",
    avatarUrl: null,
    locale: "en",
  },
});

describe("session store", () => {
  it("loads a valid session", () => {
    const storage = createStorage(JSON.stringify(buildSession("2099-01-01T00:00:00.000Z")));
    const store = createSessionStore({
      storage,
      now: () => Date.parse("2026-01-01T00:00:00.000Z"),
    });

    expect(store.loadSession()).toMatchObject({
      sessionToken: "token_123",
      user: { id: "user_1" },
    });
  });

  it("clears invalid persisted data", () => {
    const storage = createStorage("{not json");
    const store = createSessionStore({ storage });

    expect(store.loadSession()).toBeNull();
    expect(storage.getItem("spinrank.session")).toBeNull();
  });

  it("clears expired sessions", () => {
    const storage = createStorage(JSON.stringify(buildSession("2025-01-01T00:00:00.000Z")));
    const store = createSessionStore({
      storage,
      now: () => Date.parse("2026-01-01T00:00:00.000Z"),
    });

    expect(store.loadSession()).toBeNull();
    expect(storage.getItem("spinrank.session")).toBeNull();
  });

  it("saves and clears sessions through the injected storage", () => {
    const storage = createStorage();
    const store = createSessionStore({ storage });
    const session = buildSession("2099-01-01T00:00:00.000Z");

    store.saveSession(session);
    expect(storage.getItem("spinrank.session")).toBe(JSON.stringify(session));

    store.clearSession();
    expect(storage.getItem("spinrank.session")).toBeNull();
  });
});

describe("isExpiredSession", () => {
  it("flags sessions at or before now as expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00.000Z"));

    expect(isExpiredSession(buildSession("2026-04-04T11:59:59.000Z"))).toBe(true);
    expect(isExpiredSession(buildSession("2026-04-04T12:00:00.000Z"))).toBe(true);
    expect(isExpiredSession(buildSession("2026-04-04T12:00:01.000Z"))).toBe(false);

    vi.useRealTimers();
  });
});
