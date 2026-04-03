import type {
  ApiAction,
  ApiActionMap,
  BootstrapUserData,
} from "../../../api/contract";
import { postAction } from "../../../api/client";
import type { DashboardState, ViewState } from "../../shared/types/app";
import type { AppSession } from "../../../api/contract";

export const createSessionActions = (args: {
  state: { current: ViewState };
  dashboardState: DashboardState;
  hasBackendConfig: boolean;
  clearSession: () => void;
  saveSession: (session: AppSession) => void;
  syncAuthState: () => void;
  syncDashboardState: () => void;
  initAuthenticatedDashboard: () => Promise<void>;
  buildSessionFromBootstrap: (data: BootstrapUserData) => AppSession;
  isAuthedState: (state: ViewState) => state is Extract<ViewState, { status: "authenticated" }>;
}) => {
  const setIdleState = (): void => {
    args.state.current = args.hasBackendConfig
      ? { status: "idle", message: "Sign in with Google to open the leaderboard." }
      : { status: "error", message: "Configure the backend URL before testing login." };
    args.dashboardState.screen = "dashboard";
    args.dashboardState.error = "";
    args.dashboardState.loading = false;
    args.syncAuthState();
    args.syncDashboardState();
  };

  const runAuthedAction = async <TAction extends ApiAction>(
    action: TAction,
    payload: ApiActionMap[TAction]["payload"],
    requestId?: string,
  ): Promise<ApiActionMap[TAction]["data"]> => {
    if (!args.isAuthedState(args.state.current)) {
      throw new Error("You must be signed in.");
    }

    const response = await postAction(action, payload, args.state.current.session.sessionToken, requestId);
    if (!response.ok || !response.data) {
      if (response.error?.code === "UNAUTHORIZED") {
        args.clearSession();
        args.state.current = { status: "error", message: "Your session expired. Sign in again." };
        args.syncAuthState();
      }

      throw new Error(response.error?.message || `Failed to run ${action}.`);
    }

    return response.data;
  };

  const handleBootstrap = async (result: {
    provider: "google";
    idToken: string;
    nonce: string;
    profile?: {
      displayName?: string | null;
      email?: string | null;
      avatarUrl?: string | null;
    };
  }): Promise<void> => {
    args.state.current = { status: "loading", message: `Signing in with ${result.provider}...` };
    args.syncAuthState();

    try {
      const response = await postAction("bootstrapUser", {
        provider: result.provider,
        idToken: result.idToken,
        nonce: result.nonce,
        profile: result.profile,
      });

      if (!response.ok || !response.data) {
        throw new Error(response.error?.message || "Backend did not return a session.");
      }

      const session = args.buildSessionFromBootstrap(response.data);
      args.saveSession(session);
      args.state.current = {
        status: "authenticated",
        message: "Signed in",
        session,
      };
      args.syncAuthState();
      await args.initAuthenticatedDashboard();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      args.state.current = { status: "error", message };
    }

    args.syncAuthState();
  };

  return {
    setIdleState,
    runAuthedAction,
    handleBootstrap,
  };
};
