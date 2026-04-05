import { handleAvatarRequest } from "../../../worker/src/avatar";
import { makeTestEnv } from "../../helpers/worker/make-test-env";

interface AvatarRow {
  avatar_url: string | null;
}

const makeDb = (avatarUrl: string | null) => ({
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      first: vi.fn(async () => ({ avatar_url: avatarUrl } satisfies AvatarRow)),
    })),
  })),
  batch: vi.fn(),
}) as unknown as D1Database;

describe("worker avatar requests", () => {
  const originalCaches = globalThis.caches;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    const cache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    };

    vi.stubGlobal("caches", { default: cache });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.caches = originalCaches;
    globalThis.fetch = originalFetch;
  });

  it("returns a cached avatar response before touching the database", async () => {
    const cached = new Response("cached-avatar", { status: 200 });
    const cache = {
      match: vi.fn().mockResolvedValue(cached),
      put: vi.fn(),
    };
    vi.stubGlobal("caches", { default: cache });
    const db = makeDb("https://avatars.example.test/user.png");

    const response = await handleAvatarRequest(
      new Request("https://example.test/avatar/user_1"),
      makeTestEnv({ DB: db }),
      "user_1",
    );

    expect(await response.text()).toBe("cached-avatar");
    expect(cache.match).toHaveBeenCalled();
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("rejects missing or invalid avatar urls", async () => {
    const notFound = await handleAvatarRequest(
      new Request("https://example.test/avatar/user_1"),
      makeTestEnv({ DB: makeDb(null) }),
      "user_1",
    );
    expect(notFound.status).toBe(404);
    expect(await notFound.text()).toContain("Avatar not found");

    const invalidUrl = await handleAvatarRequest(
      new Request("https://example.test/avatar/user_1"),
      makeTestEnv({ DB: makeDb("notaurl") }),
      "user_1",
    );
    expect(invalidUrl.status).toBe(400);
    expect(await invalidUrl.text()).toContain("invalid");

    const invalidProtocol = await handleAvatarRequest(
      new Request("https://example.test/avatar/user_1"),
      makeTestEnv({ DB: makeDb("http://avatars.example.test/user.png") }),
      "user_1",
    );
    expect(invalidProtocol.status).toBe(400);
    expect(await invalidProtocol.text()).toContain("protocol is not supported");
  });

  it("maps upstream fetch failures to avatar responses", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("missing", { status: 404 }));

    const missing = await handleAvatarRequest(
      new Request("https://example.test/avatar/user_1"),
      makeTestEnv({ DB: makeDb("https://avatars.example.test/user.png") }),
      "user_1",
    );
    expect(missing.status).toBe(404);

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("error", { status: 500 }));

    const failed = await handleAvatarRequest(
      new Request("https://example.test/avatar/user_2"),
      makeTestEnv({ DB: makeDb("https://avatars.example.test/user-2.png") }),
      "user_2",
    );
    expect(failed.status).toBe(502);
    expect(await failed.text()).toContain("upstream request failed");
  });

  it("proxies valid avatars and stores them in the cache", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("image-bytes", {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const response = await handleAvatarRequest(
      new Request("https://example.test/avatar/user_1", {
        headers: { origin: "https://preview.spinrank.test" },
      }),
      makeTestEnv({
        APP_ENV: "prod",
        APP_ORIGIN: "https://app.spinrank.test",
        DB: makeDb("https://avatars.example.test/user.png"),
      }),
      "user_1",
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("image-bytes");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.spinrank.test");
    expect(response.headers.get("cache-control")).toContain("max-age=604800");
    expect(globalThis.fetch).toHaveBeenCalledWith("https://avatars.example.test/user.png", {
      headers: { accept: "image/*" },
      cf: {
        cacheEverything: true,
        cacheTtl: 604800,
      },
    });
    expect(globalThis.caches.default.put).toHaveBeenCalledTimes(1);
  });
});
