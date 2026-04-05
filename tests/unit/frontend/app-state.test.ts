import type { AppSession } from "../../../src/api/contract";

const session: AppSession = {
  sessionToken: "session_token",
  expiresAt: "2026-04-06T00:00:00.000Z",
  user: {
    id: "user_a",
    provider: "google",
    displayName: "Alice",
    email: "alice@example.com",
    avatarUrl: null,
  },
};

const importStateModule = async (options?: {
  loadSession?: AppSession | null;
  hasBackendConfig?: boolean;
}) => {
  vi.resetModules();
  vi.doMock("../../../src/auth/session", () => ({
    loadSession: () => options?.loadSession ?? null,
  }));
  vi.doMock("../../../src/config/env", () => ({
    hasBackendConfig: options?.hasBackendConfig ?? true,
  }));

  return import("../../../src/ui/features/app/state");
};

describe("app state", () => {
  afterEach(() => {
    vi.resetModules();
    window.history.replaceState(null, "", "/");
  });

  it("starts authenticated when a session already exists", async () => {
    const { createViewState } = await importStateModule({ loadSession: session });

    expect(createViewState().current).toEqual({
      status: "authenticated",
      message: "Signed in",
      session,
    });
  });

  it("starts idle when no session exists but the backend is configured", async () => {
    const { createViewState } = await importStateModule({
      loadSession: null,
      hasBackendConfig: true,
    });

    expect(createViewState().current).toEqual({
      status: "idle",
      message: "Sign in with Google to open the leaderboard.",
    });
  });

  it("starts in error when login is unavailable locally", async () => {
    const { createViewState } = await importStateModule({
      loadSession: null,
      hasBackendConfig: false,
    });

    expect(createViewState().current).toEqual({
      status: "error",
      message: "Configure the backend URL before testing login.",
    });
  });

  it("captures a share token from the URL and removes it from the address bar", async () => {
    const { captureShareTokenFromUrl, createDashboardState } = await importStateModule();
    const dashboardState = createDashboardState();

    window.history.replaceState(
      null,
      "",
      "/dashboard?foo=bar&shareToken=share_123#section",
    );

    captureShareTokenFromUrl(dashboardState);

    expect(dashboardState.pendingShareToken).toBe("share_123");
    expect(window.location.pathname).toBe("/dashboard");
    expect(window.location.search).toBe("?foo=bar");
    expect(window.location.hash).toBe("#section");
  });
});
