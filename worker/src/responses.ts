import type { ApiResponse, Env, ErrorCode } from "./types";

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

export function cors(env: Env): HeadersInit {
  return {
    "access-control-allow-origin": env.APP_ORIGIN,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}

export function json(env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...cors(env),
    },
  });
}
