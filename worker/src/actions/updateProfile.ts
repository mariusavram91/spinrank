import { isoNow } from "../db";
import { errorResponse, successResponse } from "../responses";
import type { ApiRequest, Env, LocaleCode, UpdateProfilePayload, UserRow } from "../types";

const MAX_DISPLAY_NAME_LENGTH = 80;
const SUPPORTED_LOCALES: LocaleCode[] = ["en", "de"];

export async function handleUpdateProfile(
  request: ApiRequest<"updateProfile", UpdateProfilePayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const displayName = request.payload.displayName.trim();
  const locale = request.payload.locale;

  if (!displayName) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Display name is required.");
  }

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return errorResponse(
      request.requestId,
      "VALIDATION_ERROR",
      `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`,
    );
  }

  if (!SUPPORTED_LOCALES.includes(locale)) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Unsupported locale.");
  }

  const nowIso = isoNow(env.runtime);

  await env.DB.prepare(
    `
      UPDATE users
      SET display_name = ?1,
          locale = ?2,
          updated_at = ?3
      WHERE id = ?4
    `,
  )
    .bind(displayName, locale, nowIso, sessionUser.id)
    .run();

  const updatedUser = await env.DB.prepare(
    `
      SELECT *
      FROM users
      WHERE id = ?1
    `,
  )
    .bind(sessionUser.id)
    .first<UserRow>();

  if (!updatedUser) {
    return errorResponse(request.requestId, "NOT_FOUND", "User not found.");
  }

  return successResponse(request.requestId, {
    user: {
      id: updatedUser.id,
      provider: updatedUser.provider,
      displayName: updatedUser.display_name,
      email: updatedUser.email,
      avatarUrl: updatedUser.avatar_url,
      locale: updatedUser.locale,
    },
  });
}
