import { handleAvatarRequest } from "./avatar";
import { isoNow } from "./db";
import { cors, errorResponse, json } from "./responses";
import { parseApiRequest, routeApiRequest } from "./router";
import { resolveWorkerRuntime } from "./runtime";
import { handleTestBootstrapRequest, isTestBootstrapRequest } from "./testAuth";
import type { Env } from "./types";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const getClientAddress = (request: Request): string =>
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-forwarded-for") ??
  request.headers.get("x-real-ip") ??
  request.headers.get("host") ??
  "unknown";

const enforceRateLimit = (key: string, env: Env): number | null => {
  const now = resolveWorkerRuntime(env.runtime).now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  }
  bucket.count += 1;
  return null;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestOrigin = request.headers.get("origin");

    if (isTestBootstrapRequest(request)) {
      return handleTestBootstrapRequest(request, env);
    }

    if (!env.APP_SESSION_SECRET) {
      return json(
        env,
        errorResponse(
          "unknown",
          "INTERNAL_ERROR",
          "Required environment variable APP_SESSION_SECRET is missing. If running locally, add it to worker/.dev.vars",
        ),
        500,
        requestOrigin,
      );
    }

    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors(env, requestOrigin) });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json(
        env,
        {
          ok: true,
          data: {
            status: "ok",
            environment: env.APP_ENV || "dev",
            timestamp: isoNow(env.runtime),
            version: "cloudflare-worker",
          },
          error: null,
          requestId: "health",
        },
        undefined,
        requestOrigin,
      );
    }

    if (request.method === "GET" && url.pathname.startsWith("/avatar/")) {
      const userId = decodeURIComponent(url.pathname.slice("/avatar/".length));
      if (!userId) {
        return json(env, errorResponse("unknown", "BAD_REQUEST", "Missing avatar user id."), 400, requestOrigin);
      }

      return handleAvatarRequest(request, env, userId);
    }

    if (request.method !== "POST" || url.pathname !== "/api") {
      return json(env, errorResponse("unknown", "NOT_FOUND", "Not found."), 404, requestOrigin);
    }

    try {
      const apiRequest = await parseApiRequest(request);
      const retryAfterSeconds = enforceRateLimit(getClientAddress(request), env);
      if (retryAfterSeconds) {
        return json(
          env,
          errorResponse(apiRequest.requestId, "RATE_LIMITED", "Rate limit exceeded. Please try again later."),
          429,
          requestOrigin,
          { "Retry-After": retryAfterSeconds.toString() },
        );
      }
      if (apiRequest.action === "health") {
        return json(
          env,
          {
            ok: true,
            data: {
              status: "ok",
              environment: env.APP_ENV || "dev",
              timestamp: isoNow(env.runtime),
              version: "cloudflare-worker",
            },
            error: null,
            requestId: apiRequest.requestId,
          },
          undefined,
          requestOrigin,
        );
      }
      const response = await routeApiRequest(apiRequest, env);
      return json(env, response, response.ok ? 200 : 400, requestOrigin);
    } catch (error) {
      return json(
        env,
        errorResponse("unknown", "BAD_REQUEST", error instanceof Error ? error.message : "Unexpected error."),
        400,
        requestOrigin,
      );
    }
  },
};
