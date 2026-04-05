import type { ApiResponse, Env, ErrorCode } from "./types";

const normalizeOrigin = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
};

const SECURITY_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "interest-cohort=()",
  "content-security-policy": "default-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests;",
};

export function getCorsOrigin(env: Env, requestOrigin?: string | null): string {
  const normalizedAppOrigin = normalizeOrigin(env.APP_ORIGIN);
  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);

  if (env.APP_ENV !== "prod" && normalizedRequestOrigin) {
    return normalizedRequestOrigin;
  }

  if (normalizedAppOrigin) {
    return normalizedAppOrigin;
  }

  if (normalizedRequestOrigin) {
    return normalizedRequestOrigin;
  }

  return "*";
}

export function successResponse<T>(requestId: string, data: T): ApiResponse<T> {
  return { ok: true, data, error: null, requestId };
}

export function errorResponse(
  requestId: string,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ApiResponse<null> {
  return {
    ok: false,
    data: null,
    error: { code, message, details },
    requestId,
  };
}

export function cors(env: Env, requestOrigin?: string | null): HeadersInit {
  return {
    ...SECURITY_HEADERS,
    "access-control-allow-origin": getCorsOrigin(env, requestOrigin),
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}

export function json(
  env: Env,
  body: unknown,
  status = 200,
  requestOrigin?: string | null,
  extraHeaders?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...cors(env, requestOrigin),
      "content-type": "application/json",
      ...extraHeaders,
    },
  });
}

export function applySecurityHeaders(target: Headers): void {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (!target.has(key)) {
      target.set(key, value);
    }
  });
}
