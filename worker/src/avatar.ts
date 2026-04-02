import { applySecurityHeaders, getCorsOrigin } from "./responses";
import type { Env } from "./types";

const AVATAR_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const buildAvatarHeaders = (env: Env, contentType: string | null, requestOrigin?: string | null): Headers => {
  const headers = new Headers();
  headers.set("access-control-allow-origin", getCorsOrigin(env, requestOrigin));
  headers.set("cache-control", `public, max-age=${AVATAR_CACHE_TTL_SECONDS}, stale-while-revalidate=86400`);
  headers.set("cross-origin-resource-policy", "cross-origin");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  applySecurityHeaders(headers);
  return headers;
};

export async function handleAvatarRequest(request: Request, env: Env, userId: string): Promise<Response> {
  const requestOrigin = request.headers.get("origin");
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const user = await env.DB.prepare(
    `
      SELECT avatar_url
      FROM users
      WHERE id = ?1
    `,
  )
    .bind(userId)
    .first<{ avatar_url: string | null }>();

  if (!user?.avatar_url) {
      return new Response("Avatar not found.", {
        status: 404,
        headers: buildAvatarHeaders(env, "text/plain;charset=utf-8", requestOrigin),
      });
    }

  let avatarUrl: URL;
  try {
    avatarUrl = new URL(user.avatar_url);
  } catch {
    return new Response("Avatar URL is invalid.", {
        status: 400,
        headers: buildAvatarHeaders(env, "text/plain;charset=utf-8", requestOrigin),
      });
    }

  if (avatarUrl.protocol !== "https:") {
    return new Response("Avatar URL protocol is not supported.", {
        status: 400,
        headers: buildAvatarHeaders(env, "text/plain;charset=utf-8", requestOrigin),
      });
    }

  const upstream = await fetch(avatarUrl.toString(), {
    headers: { accept: "image/*" },
    cf: {
      cacheEverything: true,
      cacheTtl: AVATAR_CACHE_TTL_SECONDS,
    },
  });

  if (!upstream.ok) {
    return new Response("Avatar upstream request failed.", {
        status: upstream.status === 404 ? 404 : 502,
        headers: buildAvatarHeaders(env, "text/plain;charset=utf-8", requestOrigin),
      });
    }

  const response = new Response(upstream.body, {
      status: 200,
    headers: buildAvatarHeaders(env, upstream.headers.get("content-type"), requestOrigin),
    });

  await cache.put(request, response.clone());
  return response;
}
