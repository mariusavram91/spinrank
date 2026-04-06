import { createScreenScrollReset } from "../../../src/ui/features/app/scroll";
import type { DashboardState } from "../../../src/ui/shared/types/app";

describe("screen scroll reset", () => {
  it("scrolls to the top when the active screen changes", () => {
    const dashboardState = { screen: "dashboard" } as DashboardState;
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    const resetForScreenChange = createScreenScrollReset(() => dashboardState.screen);

    resetForScreenChange();
    expect(scrollTo).not.toHaveBeenCalled();

    dashboardState.screen = "createMatch";
    resetForScreenChange();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("does not scroll during same-screen rerenders", () => {
    const dashboardState = { screen: "dashboard" } as DashboardState;
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    const resetForScreenChange = createScreenScrollReset(() => dashboardState.screen);

    resetForScreenChange();
    resetForScreenChange();
    dashboardState.screen = "profile";
    resetForScreenChange();
    resetForScreenChange();

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
