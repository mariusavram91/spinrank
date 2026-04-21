import { signSessionToken, sha256Hex, verifyGoogleIdToken } from "../auth";
import { isoNow, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import { enqueueAchievementTrigger } from "../services/achievements";
import type { ApiRequest, BootstrapUserPayload, Env, UserRow } from "../types";

export async function handleBootstrapUser(
  request: ApiRequest<"bootstrapUser", BootstrapUserPayload>,
  env: Env,
) {
  const { provider, idToken, nonce } = request.payload;
  if (provider !== "google") {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Unsupported auth provider.");
  }
  if (!env.GOOGLE_CLIENT_ID) {
    return errorResponse(request.requestId, "INTERNAL_ERROR", "GOOGLE_CLIENT_ID is not configured.");
  }

  try {
    const verified = await verifyGoogleIdToken(idToken, env);
    const claims = verified.payload;
    const tokenNonce = claims.nonce ? String(claims.nonce) : "";
    const hashedNonce = await sha256Hex(nonce);

    if (!tokenNonce || (tokenNonce !== nonce && tokenNonce !== hashedNonce)) {
      return errorResponse(request.requestId, "UNAUTHORIZED", "Google token nonce mismatch.");
    }

    const providerUserId = String(claims.sub);
    const email = claims.email ? String(claims.email) : null;
    const displayName = String(claims.name ?? claims.email ?? "Google user");
    const avatarUrl = claims.picture ? String(claims.picture) : null;
    const locale = request.payload.locale === "de" || request.payload.locale === "es" ? request.payload.locale : "en";
    const nowIso = isoNow(env.runtime);

    await env.DB.prepare(
      `
        INSERT INTO users (
          id, provider, provider_user_id, email, display_name, avatar_url, locale,
          global_elo, highest_global_elo, wins, losses, streak, best_win_streak, created_at, updated_at
        )
        VALUES (?1, 'google', ?2, ?3, ?4, ?5, ?6, 1200, 1200, 0, 0, 0, 0, ?7, ?7)
        ON CONFLICT(provider, provider_user_id) DO UPDATE SET
          email = excluded.email,
          avatar_url = excluded.avatar_url,
          updated_at = excluded.updated_at
      `,
    )
      .bind(randomId("user", env.runtime), providerUserId, email, displayName, avatarUrl, locale, nowIso)
      .run();

    const user = await env.DB.prepare(
      `
        SELECT *
        FROM users
        WHERE provider = 'google' AND provider_user_id = ?1
      `,
    )
      .bind(providerUserId)
      .first<UserRow>();

    if (!user) {
      return errorResponse(request.requestId, "INTERNAL_ERROR", "User upsert failed.");
    }

    await enqueueAchievementTrigger(env, {
      type: "bootstrap",
      userId: user.id,
      nowIso,
    }, nowIso);

    const session = await signSessionToken(user.id, env);
    return successResponse(request.requestId, {
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
    });
  } catch (error) {
    return errorResponse(
      request.requestId,
      "UNAUTHORIZED",
      error instanceof Error ? error.message : "Google rejected the supplied ID token.",
    );
  }
}
