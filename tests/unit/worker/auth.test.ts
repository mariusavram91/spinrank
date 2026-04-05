import { isTestAuthEnabled, requireSessionUser, sha256Hex, signSessionToken } from "../../../worker/src/auth";
import { makeTestEnv } from "../../helpers/worker/make-test-env";

interface UserRowResult {
  id: string;
  display_name: string;
}

const makeDb = (user: UserRowResult | null) =>
  ({
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => user),
      })),
    })),
    batch: vi.fn(),
  }) as unknown as D1Database;

describe("worker auth helpers", () => {
  it("hashes strings deterministically with sha256", async () => {
    await expect(sha256Hex("spinrank")).resolves.toBe(
      "4836346b1c8097569513394ee061a0bb79529e715ec72b9267a68fbdf8c83b7b",
    );
  });

  it("signs session tokens using the injected runtime clock", async () => {
    const env = makeTestEnv({
      APP_SESSION_SECRET: "signing-secret",
      runtime: {
        now: () => Date.parse("2026-04-04T12:00:00.000Z"),
        nowIso: () => "2026-04-04T12:00:00.000Z",
        randomUUID: () => "unused",
      },
    });

    const { token, expiresAt } = await signSessionToken("user_123", env);

    expect(token.split(".")).toHaveLength(3);
    expect(expiresAt).toBe("2026-04-05T12:00:00.000Z");
  });

  it("detects whether test auth should be enabled", () => {
    expect(isTestAuthEnabled(makeTestEnv({ APP_ENV: "test", TEST_AUTH_SECRET: "secret" }))).toBe(true);
    expect(isTestAuthEnabled(makeTestEnv({ APP_ENV: "dev", TEST_AUTH_SECRET: "secret" }))).toBe(false);
    expect(isTestAuthEnabled(makeTestEnv({ APP_ENV: "test", TEST_AUTH_SECRET: "" }))).toBe(false);
  });

  it("returns an unauthorized error when the session token is missing", async () => {
    const response = await requireSessionUser("req_missing", undefined, makeTestEnv());

    expect(response).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Missing session token." },
    });
  });

  it("returns an unauthorized error when the token is invalid", async () => {
    const response = await requireSessionUser("req_invalid", "bad-token", makeTestEnv());

    expect(response).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Session token is invalid or expired." },
    });
  });

  it("returns an unauthorized error when the session user no longer exists", async () => {
    const env = makeTestEnv({
      DB: makeDb(null),
      APP_SESSION_SECRET: "session-secret",
    });
    const { token } = await signSessionToken("missing_user", env);

    const response = await requireSessionUser("req_not_found", token, env);

    expect(response).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Session user not found." },
    });
  });

  it("returns the session user when the token is valid", async () => {
    const user = { id: "user_1", display_name: "Ada" };
    const env = makeTestEnv({
      DB: makeDb(user),
      APP_SESSION_SECRET: "session-secret",
    });
    const { token } = await signSessionToken("user_1", env);

    const response = await requireSessionUser("req_ok", token, env);

    expect("ok" in response).toBe(false);
    expect(response).toMatchObject(user);
  });
});
