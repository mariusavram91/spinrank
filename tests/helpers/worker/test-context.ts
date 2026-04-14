import { createTestDatabase } from "../d1/create-test-db";
import { makeTestEnv, type TestWorkerEnv } from "./make-test-env";

export interface SeedUserInput {
  id: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  providerUserId?: string;
}

export interface WorkerTestContext {
  env: TestWorkerEnv;
  cleanup: () => Promise<void>;
}

export const createWorkerTestContext = async (
  overrides: Partial<TestWorkerEnv> = {},
): Promise<WorkerTestContext> => {
  const database = await createTestDatabase();
  return {
    env: makeTestEnv({
      ...overrides,
      DB: overrides.DB ?? database.DB,
    }),
    cleanup: database.cleanup,
  };
};

export const seedUser = async (
  env: TestWorkerEnv,
  input: SeedUserInput,
): Promise<void> => {
  const nowIso = env.runtime.nowIso();

  await env.DB.prepare(
    `
      INSERT INTO users (
        id, provider, provider_user_id, email, display_name, avatar_url,
        global_elo, wins, losses, streak, best_win_streak, created_at, updated_at
      )
      VALUES (?1, 'google', ?2, ?3, ?4, ?5, 1200, 0, 0, 0, 0, ?6, ?6)
    `,
  )
    .bind(
      input.id,
      input.providerUserId ?? `test:${input.id}`,
      input.email ?? `${input.id}@test.spinrank.local`,
      input.displayName,
      input.avatarUrl ?? null,
      nowIso,
    )
    .run();
};
