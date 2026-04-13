import type { AppSession } from "../../../src/api/contract";
import type { DashboardState, ViewState } from "../../../src/ui/shared/types/app";

const session: AppSession = {
  sessionToken: "session_token",
  expiresAt: "2026-04-07T00:00:00.000Z",
  user: {
    id: "user_1",
    provider: "google",
    displayName: "Ada",
    email: "ada@example.com",
    avatarUrl: null,
    locale: "en",
  },
};

const importSessionActions = async (postActionImpl: ReturnType<typeof vi.fn>) => {
  vi.resetModules();
  vi.doMock("../../../src/api/client", () => ({
    postAction: postActionImpl,
  }));

  return import("../../../src/ui/features/app/sessionActions");
};

describe("session actions", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("returns the correct idle state depending on backend availability", async () => {
    const postActionImpl = vi.fn();
    const { createSessionActions } = await importSessionActions(postActionImpl);

    const state = { current: { status: "loading", message: "Loading" } as ViewState };
    const dashboardState = { screen: "createMatch", error: "Boom", loading: true } as DashboardState;
    const syncAuthState = vi.fn();
    const syncDashboardState = vi.fn();

    createSessionActions({
      state,
      dashboardState,
      hasBackendConfig: true,
      clearSession: vi.fn(),
      saveSession: vi.fn(),
      syncAuthState,
      syncDashboardState,
      initAuthenticatedDashboard: vi.fn(),
      buildSessionFromBootstrap: vi.fn(),
      isAuthedState: (
        current: ViewState,
      ): current is Extract<ViewState, { status: "authenticated" }> => current.status === "authenticated",
    }).setIdleState();

    expect(state.current).toEqual({
      status: "idle",
      message: "Sign in with Google to open the leaderboard.",
    });
    expect(dashboardState.screen).toBe("dashboard");
    expect(dashboardState.error).toBe("");
    expect(dashboardState.loading).toBe(false);
    expect(syncAuthState).toHaveBeenCalled();
    expect(syncDashboardState).toHaveBeenCalled();
  });

  it("runs authed actions and expires the session on unauthorized responses", async () => {
    const postActionImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: { seasons: [] }, error: null })
      .mockResolvedValueOnce({
        ok: false,
        data: null,
        error: { code: "UNAUTHORIZED", message: "Expired session." },
      });
    const { createSessionActions } = await importSessionActions(postActionImpl);

    const state = {
      current: { status: "authenticated", message: "Signed in", session } as ViewState,
    };
    const clearSession = vi.fn();
    const syncAuthState = vi.fn();

    const actions = createSessionActions({
      state,
      dashboardState: { screen: "dashboard" } as DashboardState,
      hasBackendConfig: true,
      clearSession,
      saveSession: vi.fn(),
      syncAuthState,
      syncDashboardState: vi.fn(),
      initAuthenticatedDashboard: vi.fn(),
      buildSessionFromBootstrap: vi.fn(),
      isAuthedState: (
        current: ViewState,
      ): current is Extract<ViewState, { status: "authenticated" }> => current.status === "authenticated",
    });

    await expect(actions.runAuthedAction("getSeasons", {})).resolves.toEqual({ seasons: [] });
    await expect(actions.runAuthedAction("getSeasons", {})).rejects.toThrow("Expired session.");
    expect(clearSession).toHaveBeenCalled();
    expect(state.current).toEqual({
      status: "error",
      message: "Your session expired. Sign in again.",
    });
    expect(syncAuthState).toHaveBeenCalled();
  });

  it("bootstraps a session and initializes the authenticated dashboard", async () => {
    const bootstrapData = {
      sessionToken: "bootstrap",
      expiresAt: "2026-04-07T00:00:00.000Z",
      user: session.user,
    };
    const postActionImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: bootstrapData, error: null })
      .mockResolvedValueOnce({
        ok: false,
        data: null,
        error: { message: "Backend failed." },
      });
    const { createSessionActions } = await importSessionActions(postActionImpl);

    const saveSession = vi.fn();
    const initAuthenticatedDashboard = vi.fn().mockResolvedValue(undefined);
    const buildSessionFromBootstrap = vi.fn().mockReturnValue(session);
    const state = { current: { status: "idle", message: "Idle" } as ViewState };
    const syncAuthState = vi.fn();

    const actions = createSessionActions({
      state,
      dashboardState: { screen: "dashboard" } as DashboardState,
      hasBackendConfig: true,
      clearSession: vi.fn(),
      saveSession,
      syncAuthState,
      syncDashboardState: vi.fn(),
      initAuthenticatedDashboard,
      buildSessionFromBootstrap,
      isAuthedState: (
        current: ViewState,
      ): current is Extract<ViewState, { status: "authenticated" }> => current.status === "authenticated",
    });

    await actions.handleBootstrap({
      provider: "google",
      idToken: "id_token",
      nonce: "nonce_1",
      profile: { displayName: "Ada" },
    });

    expect(buildSessionFromBootstrap).toHaveBeenCalledWith(bootstrapData);
    expect(saveSession).toHaveBeenCalledWith(session);
    expect(initAuthenticatedDashboard).toHaveBeenCalled();
    expect(state.current).toEqual({
      status: "authenticated",
      message: "Signed in",
      session,
    });

    await actions.handleBootstrap({
      provider: "google",
      idToken: "id_token",
      nonce: "nonce_2",
    });
    expect(state.current).toEqual({
      status: "error",
      message: "Backend failed.",
    });
  });
});
