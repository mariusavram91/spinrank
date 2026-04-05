import { createHelpNavigation } from "../../../src/ui/features/app/navigation";
import type { DashboardState } from "../../../src/ui/shared/types/app";

describe("help navigation", () => {
  it("opens and closes FAQ while restoring the previous screen", () => {
    const dashboardState = { screen: "createMatch" } as DashboardState;
    const authMenuStates: boolean[] = [];
    const createMenuStates: boolean[] = [];
    const syncAuthState = vi.fn();
    const syncDashboardState = vi.fn();

    const navigation = createHelpNavigation({
      dashboardState,
      setAuthMenuOpen: (value) => authMenuStates.push(value),
      setCreateMenuOpen: (value) => createMenuStates.push(value),
      syncAuthState,
      syncDashboardState,
    });

    navigation.openFaqScreen();
    expect(dashboardState.screen).toBe("faq");
    expect(authMenuStates.at(-1)).toBe(false);
    expect(createMenuStates.at(-1)).toBe(false);

    navigation.closeFaqScreen();
    expect(dashboardState.screen).toBe("createMatch");
    expect(syncAuthState).toHaveBeenCalledTimes(2);
    expect(syncDashboardState).toHaveBeenCalledTimes(2);
  });

  it("tracks privacy navigation independently from faq navigation", () => {
    const dashboardState = { screen: "dashboard" } as DashboardState;
    const navigation = createHelpNavigation({
      dashboardState,
      setAuthMenuOpen: vi.fn(),
      setCreateMenuOpen: vi.fn(),
      syncAuthState: vi.fn(),
      syncDashboardState: vi.fn(),
    });

    navigation.openFaqScreen();
    navigation.closeFaqScreen();
    navigation.openPrivacyScreen();
    expect(dashboardState.screen).toBe("privacy");

    navigation.closePrivacyScreen();
    expect(dashboardState.screen).toBe("dashboard");
  });
});
