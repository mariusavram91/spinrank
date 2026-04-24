import type { DashboardState } from "../../shared/types/app";

export const createHelpNavigation = (args: {
  dashboardState: DashboardState;
  setAuthMenuOpen: (value: boolean) => void;
  setCreateMenuOpen: (value: boolean) => void;
  syncAuthState: () => void;
  syncDashboardState: () => void;
}) => {
  let screenBeforeFeatures: DashboardState["screen"] = "dashboard";
  let screenBeforeFaq: DashboardState["screen"] = "dashboard";
  let screenBeforePrivacy: DashboardState["screen"] = "dashboard";

  const openFeaturesScreen = (): void => {
    if (args.dashboardState.screen !== "features") {
      screenBeforeFeatures = args.dashboardState.screen;
    }
    args.dashboardState.screen = "features";
    args.setAuthMenuOpen(false);
    args.setCreateMenuOpen(false);
    args.syncAuthState();
    args.syncDashboardState();
  };

  const closeFeaturesScreen = (): void => {
    args.dashboardState.screen = screenBeforeFeatures;
    screenBeforeFeatures = "dashboard";
    args.syncAuthState();
    args.syncDashboardState();
  };

  const openFaqScreen = (): void => {
    if (args.dashboardState.screen !== "faq") {
      screenBeforeFaq = args.dashboardState.screen;
    }
    args.dashboardState.screen = "faq";
    args.setAuthMenuOpen(false);
    args.setCreateMenuOpen(false);
    args.syncAuthState();
    args.syncDashboardState();
  };

  const closeFaqScreen = (): void => {
    args.dashboardState.screen = screenBeforeFaq;
    screenBeforeFaq = "dashboard";
    args.syncAuthState();
    args.syncDashboardState();
  };

  const openPrivacyScreen = (): void => {
    if (args.dashboardState.screen !== "privacy") {
      screenBeforePrivacy = args.dashboardState.screen;
    }
    args.dashboardState.screen = "privacy";
    args.setAuthMenuOpen(false);
    args.setCreateMenuOpen(false);
    args.syncAuthState();
    args.syncDashboardState();
  };

  const closePrivacyScreen = (): void => {
    args.dashboardState.screen = screenBeforePrivacy;
    screenBeforePrivacy = "dashboard";
    args.syncAuthState();
    args.syncDashboardState();
  };

  return {
    openFeaturesScreen,
    closeFeaturesScreen,
    openFaqScreen,
    closeFaqScreen,
    openPrivacyScreen,
    closePrivacyScreen,
  };
};
