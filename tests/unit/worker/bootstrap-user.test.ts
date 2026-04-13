import { handleBootstrapUser } from "../../../worker/src/actions/bootstrapUser";
import { createFixedRuntime } from "../../helpers/worker/make-test-env";
import { createWorkerTestContext } from "../../helpers/worker/test-context";

vi.mock("../../../worker/src/auth", async () => {
  const actual = await vi.importActual<typeof import("../../../worker/src/auth")>("../../../worker/src/auth");
  return {
    ...actual,
    verifyGoogleIdToken: vi.fn(),
    sha256Hex: vi.fn(),
    signSessionToken: vi.fn(),
  };
});

const authModule = await import("../../../worker/src/auth");

describe("worker bootstrapUser action", () => {
  it("rejects unsupported providers before token verification", async () => {
    const context = await createWorkerTestContext();
    try {
      const response = await handleBootstrapUser(
        {
          action: "bootstrapUser",
          requestId: "req_invalid_provider",
          payload: {
            provider: "github" as never,
            idToken: "token",
            nonce: "nonce_1",
          },
        },
        context.env,
      );

      expect(response.ok).toBe(false);
      expect(response.error?.message).toContain("Unsupported auth provider");
      expect(authModule.verifyGoogleIdToken).not.toHaveBeenCalled();
    } finally {
      await context.cleanup();
    }
  });

  it("rejects requests when GOOGLE_CLIENT_ID is missing", async () => {
    const context = await createWorkerTestContext({
      GOOGLE_CLIENT_ID: "",
    });
    try {
      const response = await handleBootstrapUser(
        {
          action: "bootstrapUser",
          requestId: "req_missing_google_client_id",
          payload: {
            provider: "google",
            idToken: "token",
            nonce: "nonce_1",
          },
        },
        context.env,
      );

      expect(response.ok).toBe(false);
      expect(response.error?.message).toContain("GOOGLE_CLIENT_ID is not configured");
    } finally {
      await context.cleanup();
    }
  });

  it("rejects requests when the verified nonce does not match", async () => {
    const context = await createWorkerTestContext();
    vi.mocked(authModule.verifyGoogleIdToken).mockResolvedValue({
      payload: {
        sub: "google-user-1",
        email: "alice@example.com",
        name: "Alice",
        picture: "https://example.com/alice.png",
        nonce: "different_nonce",
      },
    } as never);
    vi.mocked(authModule.sha256Hex).mockResolvedValue("hashed_nonce");

    try {
      const response = await handleBootstrapUser(
        {
          action: "bootstrapUser",
          requestId: "req_nonce_mismatch",
          payload: {
            provider: "google",
            idToken: "token",
            nonce: "nonce_1",
          },
        },
        context.env,
      );

      expect(response.ok).toBe(false);
      expect(response.error?.message).toContain("nonce mismatch");
    } finally {
      await context.cleanup();
    }
  });

  it("rejects requests when the verified token omits a nonce", async () => {
    const context = await createWorkerTestContext();
    vi.mocked(authModule.verifyGoogleIdToken).mockResolvedValue({
      payload: {
        sub: "google-user-1",
        email: "alice@example.com",
        name: "Alice",
        picture: "https://example.com/alice.png",
      },
    } as never);
    vi.mocked(authModule.sha256Hex).mockResolvedValue("hashed_nonce");

    try {
      const response = await handleBootstrapUser(
        {
          action: "bootstrapUser",
          requestId: "req_nonce_missing",
          payload: {
            provider: "google",
            idToken: "token",
            nonce: "nonce_1",
          },
        },
        context.env,
      );

      expect(response.ok).toBe(false);
      expect(response.error?.code).toBe("UNAUTHORIZED");
      expect(response.error?.message).toContain("nonce mismatch");
    } finally {
      await context.cleanup();
    }
  });

  it("upserts the google user and returns a signed app session", async () => {
    const context = await createWorkerTestContext({
      runtime: createFixedRuntime("2026-04-05T12:00:00.000Z", ["uuid_1", "uuid_2"]),
    });
    vi.mocked(authModule.sha256Hex).mockResolvedValue("hashed_nonce");
    vi.mocked(authModule.signSessionToken).mockResolvedValue({
      token: "app_session_token",
      expiresAt: "2026-04-06T12:00:00.000Z",
    });

    try {
      vi.mocked(authModule.verifyGoogleIdToken).mockResolvedValue({
        payload: {
          sub: "google-user-1",
          email: "alice@example.com",
          name: "Alice",
          picture: "https://example.com/alice.png",
          nonce: "nonce_1",
        },
      } as never);

      const firstResponse = await handleBootstrapUser(
        {
          action: "bootstrapUser",
          requestId: "req_bootstrap_first",
          payload: {
            provider: "google",
            idToken: "token_a",
            nonce: "nonce_1",
          },
        },
        context.env,
      );

      expect(firstResponse.ok).toBe(true);
      expect(firstResponse.data?.user).toMatchObject({
        id: "user_uuid_1",
        displayName: "Alice",
        email: "alice@example.com",
        avatarUrl: "https://example.com/alice.png",
      });
      expect(firstResponse.data?.sessionToken).toBe("app_session_token");

      vi.mocked(authModule.verifyGoogleIdToken).mockResolvedValue({
        payload: {
          sub: "google-user-1",
          email: "alice.updated@example.com",
          name: "Alice Updated",
          picture: "https://example.com/alice-updated.png",
          nonce: "hashed_nonce",
        },
      } as never);

      const secondResponse = await handleBootstrapUser(
        {
          action: "bootstrapUser",
          requestId: "req_bootstrap_second",
          payload: {
            provider: "google",
            idToken: "token_b",
            nonce: "nonce_1",
          },
        },
        context.env,
      );

      expect(secondResponse.ok).toBe(true);
      expect(secondResponse.data?.user).toMatchObject({
        id: "user_uuid_1",
        displayName: "Alice",
        email: "alice.updated@example.com",
        avatarUrl: "https://example.com/alice-updated.png",
      });

      const persistedUsers = await context.env.DB.prepare(
        `
          SELECT id, email, display_name, avatar_url
          FROM users
          WHERE provider_user_id = ?1
        `,
      )
        .bind("google-user-1")
        .all<{
          id: string;
          email: string;
          display_name: string;
          avatar_url: string;
        }>();

      expect(persistedUsers.results).toEqual([
        {
          id: "user_uuid_1",
          email: "alice.updated@example.com",
          display_name: "Alice",
          avatar_url: "https://example.com/alice-updated.png",
        },
      ]);
      expect(authModule.signSessionToken).toHaveBeenCalledWith("user_uuid_1", context.env);
    } finally {
      await context.cleanup();
    }
  });
});
