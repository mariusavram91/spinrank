import type { DashboardState, ViewState } from "../../shared/types/app";
import { setAvatarImage } from "../../shared/utils/avatar";

type AuthSyncArgs = {
  getViewState: () => ViewState;
  isAuthedState: (state: ViewState) => state is Extract<ViewState, { status: "authenticated" }>;
  dashboardState: DashboardState;
  authAvatar: HTMLImageElement;
  authMenu: HTMLElement;
  createMenu: HTMLElement;
  authActions: HTMLElement;
  providerStack: HTMLElement;
  languageSwitch: HTMLElement;
  container: HTMLElement;
  authMenuButton: HTMLButtonElement;
  createMenuButton: HTMLButtonElement;
  openCreateMatchButton: HTMLButtonElement;
  openCreateTournamentButton: HTMLButtonElement;
  openCreateSeasonButton: HTMLButtonElement;
  openScoreCardButton: HTMLButtonElement;
  faqMenuButton: HTMLButtonElement;
  logoutButton: HTMLButtonElement;
  dashboard: HTMLElement;
  createMatchScreen: HTMLElement;
  createTournamentScreen: HTMLElement;
  createSeasonScreen: HTMLElement;
  faqScreen: HTMLElement;
  privacyScreen: HTMLElement;
  loginView: HTMLElement;
  welcomeText: HTMLElement;
  scoreCardOverlay: HTMLElement;
  assetsBaseUrl: string;
  isScoreCardVisible: () => boolean;
  hideScoreCard: () => void;
  getAuthMenuOpen: () => boolean;
  getCreateMenuOpen: () => boolean;
  setAuthMenuOpen: (value: boolean) => void;
  setCreateMenuOpen: (value: boolean) => void;
};

export const createAuthSync = (args: AuthSyncArgs) => ({
  syncAuthState: (): void => {
    const currentState = args.getViewState();

    if (args.isAuthedState(currentState)) {
      setAvatarImage(
        args.authAvatar,
        currentState.session.user.id,
        currentState.session.user.avatarUrl,
        `${args.assetsBaseUrl}assets/logo.png`,
        "Signed-in user avatar",
      );

      if (args.authMenu.children.length === 0) {
        args.authMenu.replaceChildren(args.faqMenuButton, args.logoutButton);
      }
      if (args.createMenu.children.length === 0) {
        args.createMenu.replaceChildren(
          args.openCreateMatchButton,
          args.openCreateTournamentButton,
          args.openCreateSeasonButton,
          args.openScoreCardButton,
        );
      }

      const authMenuOpen = args.getAuthMenuOpen();
      const createMenuOpen = args.getCreateMenuOpen();
      args.authMenu.hidden = !authMenuOpen;
      args.createMenu.hidden = !createMenuOpen;
      args.authMenuButton.setAttribute("aria-expanded", authMenuOpen ? "true" : "false");
      args.createMenuButton.setAttribute("aria-expanded", createMenuOpen ? "true" : "false");

      args.authActions.replaceChildren(args.authAvatar, args.authMenuButton, args.authMenu);
      args.providerStack.replaceChildren(args.languageSwitch, args.authActions);

      if (args.createMenuButton.parentElement !== args.container) {
        args.container.append(args.createMenuButton, args.createMenu);
      }

      const screen = args.dashboardState.screen;
      args.dashboard.hidden = screen !== "dashboard";
      args.createMatchScreen.hidden = screen !== "createMatch";
      args.createTournamentScreen.hidden = screen !== "createTournament";
      args.createSeasonScreen.hidden = screen !== "createSeason";
      args.faqScreen.hidden = screen !== "faq";
      args.privacyScreen.hidden = screen !== "privacy";
      args.loginView.hidden = true;
      args.welcomeText.textContent = "";
      args.scoreCardOverlay.hidden = !args.isScoreCardVisible();
      return;
    }

    args.providerStack.replaceChildren(args.languageSwitch);
    if (args.createMenuButton.parentElement) {
      args.createMenuButton.remove();
    }
    if (args.createMenu.parentElement) {
      args.createMenu.remove();
    }
    args.setAuthMenuOpen(false);
    args.setCreateMenuOpen(false);
    args.dashboard.hidden = true;
    args.createMatchScreen.hidden = true;
    args.createTournamentScreen.hidden = true;
    args.createSeasonScreen.hidden = true;
    args.faqScreen.hidden = args.dashboardState.screen !== "faq";
    args.privacyScreen.hidden = args.dashboardState.screen !== "privacy";
    args.loginView.hidden = args.dashboardState.screen === "faq" || args.dashboardState.screen === "privacy";
    args.hideScoreCard();
  },
});
