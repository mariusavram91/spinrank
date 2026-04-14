import { isTestAuthEnabled, signSessionToken } from "./auth";
import { isoNow, randomId } from "./db";
import { errorResponse, json, successResponse } from "./responses";
import type { Env, UserRow } from "./types";

interface TestBootstrapPayload {
  userId?: string;
  displayName?: string;
  email?: string | null;
  avatarUrl?: string | null;
}

const TEST_AUTH_ROUTE = "/test/bootstrap-user";

export const isTestBootstrapRequest = (request: Request): boolean => {
  const url = new URL(request.url);
  return request.method === "POST" && url.pathname === TEST_AUTH_ROUTE;
};

export async function handleTestBootstrapRequest(request: Request, env: Env): Promise<Response> {
  const requestOrigin = request.headers.get("origin");

  if (!isTestAuthEnabled(env)) {
    return json(env, errorResponse("test-auth", "NOT_FOUND", "Not found."), 404, requestOrigin);
  }

  const suppliedSecret = request.headers.get("x-test-auth-secret");
  if (!suppliedSecret || suppliedSecret !== env.TEST_AUTH_SECRET) {
    return json(
      env,
      errorResponse("test-auth", "UNAUTHORIZED", "Missing or invalid test auth secret."),
      401,
      requestOrigin,
    );
  }

  if (!env.APP_SESSION_SECRET) {
    return json(
      env,
      errorResponse("test-auth", "INTERNAL_ERROR", "APP_SESSION_SECRET is not configured."),
      500,
      requestOrigin,
    );
  }

  const rawBody = await request.text();
  let payload: TestBootstrapPayload = {};
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as TestBootstrapPayload;
    } catch {
      return json(
        env,
        errorResponse("test-auth", "BAD_REQUEST", "Request body contains invalid JSON."),
        400,
        requestOrigin,
      );
    }
  }

  const nowIso = isoNow(env.runtime);
  const userId = String(payload.userId || "").trim() || randomId("user", env.runtime);
  const displayName = String(payload.displayName || "").trim() || "Test User";
  const email = payload.email ? String(payload.email).trim() : `${userId}@test.spinrank.local`;
  const avatarUrl = payload.avatarUrl ? String(payload.avatarUrl).trim() : null;
  const providerUserId = `test:${userId}`;

  await env.DB.prepare(
    `
      INSERT INTO users (
        id, provider, provider_user_id, email, display_name, avatar_url,
        global_elo, wins, losses, streak, best_win_streak, created_at, updated_at
      )
      VALUES (?1, 'google', ?2, ?3, ?4, ?5, 1200, 0, 0, 0, 0, ?6, ?6)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = excluded.updated_at
    `,
  )
    .bind(userId, providerUserId, email, displayName, avatarUrl, nowIso)
    .run();

  const user = await env.DB.prepare(
    `
      SELECT *
      FROM users
      WHERE id = ?1
    `,
  )
    .bind(userId)
    .first<UserRow>();

  if (!user) {
    return json(
      env,
      errorResponse("test-auth", "INTERNAL_ERROR", "Test user bootstrap failed."),
      500,
      requestOrigin,
    );
  }

  const session = await signSessionToken(user.id, env);
  return json(
    env,
    successResponse("test-auth", {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        provider: user.provider,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        locale: user.locale,
      },
    }),
    200,
    requestOrigin,
  );
}
