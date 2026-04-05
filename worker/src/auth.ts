import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import { resolveWorkerRuntime } from "./runtime";
import { errorResponse } from "./responses";
import type { Env, SessionClaims, UserRow } from "./types";

const googleJWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function verifyGoogleIdToken(idToken: string, env: Env) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  return jwtVerify(idToken, googleJWKS, {
    audience: env.GOOGLE_CLIENT_ID,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

export async function signSessionToken(userId: string, env: Env): Promise<{ token: string; expiresAt: string }> {
  const runtime = resolveWorkerRuntime(env.runtime);
  const now = Math.floor(runtime.now() / 1000);
  const exp = now + 60 * 60 * 24;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(env.APP_SESSION_SECRET));

  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function isTestAuthEnabled(env: Env): boolean {
  return env.APP_ENV === "test" && Boolean(env.TEST_AUTH_SECRET);
}

export async function requireSessionUser(
  requestId: string,
  sessionToken: string | undefined,
  env: Env,
): Promise<UserRow | ReturnType<typeof errorResponse>> {
  if (!sessionToken) {
    return errorResponse(requestId, "UNAUTHORIZED", "Missing session token.");
  }

  try {
    const runtime = resolveWorkerRuntime(env.runtime);
    const verified = await jwtVerify<SessionClaims>(
      sessionToken,
      new TextEncoder().encode(env.APP_SESSION_SECRET),
      { currentDate: new Date(runtime.now()) },
    );

    const userId = String(verified.payload.sub);
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
      return errorResponse(requestId, "UNAUTHORIZED", "Session user not found.");
    }

    return user;
  } catch {
    return errorResponse(requestId, "UNAUTHORIZED", "Session token is invalid or expired.");
  }
}
