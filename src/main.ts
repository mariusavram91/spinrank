import "./styles.css";
import { buildApp } from "./ui/app";

const syncViewportHeight = (): void => {
  const viewportHeight = globalThis.visualViewport?.height ?? globalThis.innerHeight;
  document.documentElement.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
};

syncViewportHeight();
globalThis.visualViewport?.addEventListener("resize", syncViewportHeight);
globalThis.visualViewport?.addEventListener("scroll", syncViewportHeight);
globalThis.addEventListener("resize", syncViewportHeight);

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root element was not found.");
}

root.append(buildApp());
