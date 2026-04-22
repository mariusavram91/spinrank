import type { DashboardState, ViewState } from "../../../src/ui/shared/types/app";

const authState: ViewState = {
  status: "authenticated",
  message: "Signed in",
  session: {
    sessionToken: "token",
    expiresAt: "2026-04-06T00:00:00.000Z",
    user: {
      id: "user_1",
      provider: "google",
      displayName: "Ada",
      email: "ada@example.com",
      avatarUrl: "https://avatars.example.test/ada.png",
      locale: "en",
    },
  },
};

const createElements = () => ({
  authAvatarButton: document.createElement("button"),
  authAvatar: document.createElement("img"),
  authAvatarBadge: document.createElement("span"),
  authMenu: document.createElement("div"),
  createMenu: document.createElement("div"),
  authActions: document.createElement("div"),
  providerStack: document.createElement("div"),
  languageSwitch: document.createElement("div"),
  container: document.createElement("div"),
  authMenuButton: document.createElement("button"),
  createMenuButton: document.createElement("button"),
  openCreateMatchButton: document.createElement("button"),
  openCreateTournamentButton: document.createElement("button"),
  openCreateSeasonButton: document.createElement("button"),
  openScoreCardButton: document.createElement("button"),
  faqMenuButton: document.createElement("button"),
  authMenuSeparator: document.createElement("div"),
  logoutButton: document.createElement("button"),
  dashboard: document.createElement("section"),
  createMatchScreen: document.createElement("section"),
  createTournamentScreen: document.createElement("section"),
  createSeasonScreen: document.createElement("section"),
  profileScreen: document.createElement("section"),
  sharedUserProfileScreen: document.createElement("section"),
  faqScreen: document.createElement("section"),
  privacyScreen: document.createElement("section"),
  loginView: document.createElement("section"),
  welcomeText: document.createElement("p"),
  scoreCardOverlay: document.createElement("div"),
});

const importAuthSync = async () => {
  const setAvatarImage = vi.fn();

  vi.resetModules();
  vi.doMock("../../../src/ui/shared/utils/avatar", () => ({
    setAvatarImage,
  }));

  const module = await import("../../../src/ui/features/app/authSync");
  return { ...module, setAvatarImage };
};

describe("auth sync", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("renders the authenticated app chrome and selected screen", async () => {
    const { createAuthSync, setAvatarImage } = await importAuthSync();
    const elements = createElements();
    const dashboardState = { screen: "profile", hasNewAchievements: true } as DashboardState;

    const sync = createAuthSync({
      getViewState: () => authState,
      isAuthedState: (
        state: ViewState,
      ): state is Extract<ViewState, { status: "authenticated" }> => state.status === "authenticated",
      dashboardState,
      ...elements,
      assetsBaseUrl: "/",
      isScoreCardVisible: () => true,
      hideScoreCard: vi.fn(),
      getAuthMenuOpen: () => true,
      getCreateMenuOpen: () => false,
      setAuthMenuOpen: vi.fn(),
      setCreateMenuOpen: vi.fn(),
    });

    sync.syncAuthState();

    expect(setAvatarImage).toHaveBeenCalledWith(
      elements.authAvatar,
      "user_1",
      "https://avatars.example.test/ada.png",
      "/assets/logo.svg",
      "Signed-in user avatar",
    );
    expect(elements.authAvatarBadge.hidden).toBe(false);
    expect(elements.authAvatarButton.getAttribute("aria-label")).toContain("new achievements");
    expect(elements.authMenu.hidden).toBe(false);
    expect(elements.createMenu.hidden).toBe(true);
    expect(elements.authMenuButton.getAttribute("aria-expanded")).toBe("true");
    expect(elements.createMenuButton.getAttribute("aria-expanded")).toBe("false");
    expect(elements.providerStack.children).toHaveLength(2);
    expect(elements.providerStack.firstElementChild).toBe(elements.languageSwitch);
    expect(elements.authActions.children).toHaveLength(3);
    expect(elements.authActions.children[0]).toBe(elements.authMenuButton);
    expect(elements.authActions.children[1]).toBe(elements.authAvatarButton);
    expect(elements.authActions.children[2]).toBe(elements.authMenu);
    expect(elements.container.contains(elements.createMenuButton)).toBe(true);
    expect(elements.container.contains(elements.createMenu)).toBe(true);
    expect(elements.profileScreen.hidden).toBe(false);
    expect(elements.sharedUserProfileScreen.hidden).toBe(true);
    expect(elements.dashboard.hidden).toBe(true);
    expect(elements.loginView.hidden).toBe(true);
    expect(elements.welcomeText.textContent).toBe("");
    expect(elements.scoreCardOverlay.hidden).toBe(false);
  });

  it("collapses to the login shell when the user is not authenticated", async () => {
    const { createAuthSync } = await importAuthSync();
    const elements = createElements();
    const hideScoreCard = vi.fn();
    let authMenuOpen = true;
    let createMenuOpen = true;

    elements.providerStack.append(elements.languageSwitch, document.createElement("div"));
    elements.container.append(elements.createMenuButton, elements.createMenu);

    const sync = createAuthSync({
      getViewState: () => ({ status: "idle", message: "Idle" }),
      isAuthedState: (
        state: ViewState,
      ): state is Extract<ViewState, { status: "authenticated" }> => state.status === "authenticated",
      dashboardState: { screen: "faq", hasNewAchievements: false } as DashboardState,
      ...elements,
      assetsBaseUrl: "/",
      isScoreCardVisible: () => false,
      hideScoreCard,
      getAuthMenuOpen: () => authMenuOpen,
      getCreateMenuOpen: () => createMenuOpen,
      setAuthMenuOpen: (value) => {
        authMenuOpen = value;
      },
      setCreateMenuOpen: (value) => {
        createMenuOpen = value;
      },
    });

    sync.syncAuthState();

    expect(elements.providerStack.children).toHaveLength(1);
    expect(elements.providerStack.firstElementChild).toBe(elements.languageSwitch);
    expect(elements.container.contains(elements.createMenuButton)).toBe(false);
    expect(elements.container.contains(elements.createMenu)).toBe(false);
    expect(authMenuOpen).toBe(false);
    expect(createMenuOpen).toBe(false);
    expect(elements.dashboard.hidden).toBe(true);
    expect(elements.faqScreen.hidden).toBe(false);
    expect(elements.loginView.hidden).toBe(true);
    expect(hideScoreCard).toHaveBeenCalled();
  });
});
