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

export function getCorsOrigin(env: Env, requestOrigin?: string | null): string {
  const normalizedAppOrigin = normalizeOrigin(env.APP_ORIGIN);
  if (normalizedAppOrigin) {
    return normalizedAppOrigin;
  }

  if (requestOrigin) {
    return requestOrigin;
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
    "access-control-allow-origin": getCorsOrigin(env, requestOrigin),
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}

export function json(env: Env, body: unknown, status = 200, requestOrigin?: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...cors(env, requestOrigin),
    },
  });
}
