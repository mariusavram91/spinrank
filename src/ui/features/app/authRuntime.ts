import { createAuthSync } from "./authSync";
import type { DashboardState, ViewState } from "../../shared/types/app";

export const createAppAuthRuntime = (args: Parameters<typeof createAuthSync>[0]) => {
  const authSync = createAuthSync(args);
  return {
    syncAuthState: (): void => authSync.syncAuthState(),
  };
};
