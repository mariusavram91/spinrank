import type { DashboardState } from "../../shared/types/app";

export const createScreenScrollReset = (
  getScreen: () => DashboardState["screen"],
): (() => void) => {
  let previousScreen = getScreen();

  return (): void => {
    const nextScreen = getScreen();
    if (nextScreen === previousScreen || typeof window === "undefined") {
      previousScreen = nextScreen;
      return;
    }
    previousScreen = nextScreen;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };
};
