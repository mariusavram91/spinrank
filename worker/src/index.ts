import { handleAvatarRequest } from "./avatar";
import { cors, errorResponse, json } from "./responses";
import { parseApiRequest, routeApiRequest } from "./router";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestOrigin = request.headers.get("origin");

    if (!env.APP_SESSION_SECRET || !env.GOOGLE_CLIENT_ID) {
      return json(
        env,
        errorResponse(
          "unknown",
          "INTERNAL_ERROR",
          "Required environment variables (APP_SESSION_SECRET, GOOGLE_CLIENT_ID) are missing. If running locally, add them to worker/.dev.vars",
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
            timestamp: new Date().toISOString(),
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
      if (apiRequest.action === "health") {
        return json(
          env,
          {
            ok: true,
            data: {
              status: "ok",
              environment: env.APP_ENV || "dev",
              timestamp: new Date().toISOString(),
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
