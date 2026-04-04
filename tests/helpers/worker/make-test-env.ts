export interface TestWorkerRuntime {
  now: () => number;
  nowIso: () => string;
  randomUUID: () => string;
}

export interface TestWorkerEnv {
  DB: {
    prepare: (sql: string) => unknown;
    batch: (statements: readonly unknown[]) => Promise<unknown>;
  };
  GOOGLE_CLIENT_ID: string;
  APP_SESSION_SECRET: string;
  APP_ORIGIN: string;
  APP_ENV?: string;
  TEST_AUTH_SECRET?: string;
  runtime: TestWorkerRuntime;
}

const createThrowingDb = (): TestWorkerEnv["DB"] => ({
  prepare: () => {
    throw new Error("Test DB not configured.");
  },
  batch: async () => {
    throw new Error("Test DB not configured.");
  },
});

export const createFixedRuntime = (
  nowIso = "2026-04-04T12:00:00.000Z",
  uuids: string[] = ["uuid_1"],
): TestWorkerRuntime => {
  const nowMs = Date.parse(nowIso);
  let uuidIndex = 0;

  return {
    now: () => nowMs,
    nowIso: () => nowIso,
    randomUUID: () => {
      const nextUuid =
        uuids[uuidIndex] ?? `uuid_${Math.max(uuidIndex + 1, uuids.length + 1)}`;
      uuidIndex += 1;
      return nextUuid;
    },
  };
};

export const makeTestEnv = (overrides: Partial<TestWorkerEnv> = {}): TestWorkerEnv => ({
  DB: overrides.DB ?? createThrowingDb(),
  GOOGLE_CLIENT_ID: overrides.GOOGLE_CLIENT_ID ?? "test-google-client-id",
  APP_SESSION_SECRET: overrides.APP_SESSION_SECRET ?? "test-session-secret",
  APP_ORIGIN: overrides.APP_ORIGIN ?? "http://localhost:5173",
  APP_ENV: overrides.APP_ENV ?? "test",
  TEST_AUTH_SECRET: overrides.TEST_AUTH_SECRET ?? "test-auth-secret",
  runtime: overrides.runtime ?? createFixedRuntime(),
});
