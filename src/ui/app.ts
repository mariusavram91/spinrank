import { hasBackendConfig, env } from "../config/env";
import { postAction } from "../api/client";
import type { HealthData } from "../api/contract";

type HealthState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string; data: HealthData }
  | { status: "error"; message: string };

const renderHealthMessage = (state: HealthState): string => {
  switch (state.status) {
    case "idle":
    case "loading":
    case "error":
      return state.message;
    case "success":
      return `${state.message} (${state.data.environment} at ${state.data.timestamp})`;
  }
};

export const buildApp = (): HTMLElement => {
  const container = document.createElement("main");
  container.className = "shell";

  const card = document.createElement("section");
  card.className = "panel";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `Milestone 0 foundation • ${env.appEnv}`;

  const title = document.createElement("h1");
  title.textContent = env.appName;

  const description = document.createElement("p");
  description.className = "lede";
  description.textContent =
    "Static frontend scaffold for GitHub Pages with typed API contracts and a backend health check.";

  const statusCard = document.createElement("div");
  statusCard.className = "status-card";

  const statusLabel = document.createElement("p");
  statusLabel.className = "status-label";
  statusLabel.textContent = "Backend health";

  const statusMessage = document.createElement("p");
  statusMessage.className = "status-message";

  const endpoint = document.createElement("code");
  endpoint.className = "endpoint";
  endpoint.textContent = env.backendUrl || "VITE_API_BASE_URL is not set";

  const actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.textContent = hasBackendConfig ? "Check backend" : "Backend URL required";
  actionButton.disabled = !hasBackendConfig;

  const state: { current: HealthState } = {
    current: hasBackendConfig
      ? { status: "idle", message: "Ready to call the configured Apps Script endpoint." }
      : { status: "error", message: "Configure VITE_API_BASE_URL to enable the health action." },
  };

  const syncState = (): void => {
    statusMessage.textContent = renderHealthMessage(state.current);
    statusMessage.dataset.status = state.current.status;
  };

  actionButton.addEventListener("click", async () => {
    state.current = { status: "loading", message: "Checking backend health..." };
    syncState();

    try {
      const response = await postAction("health", {});

      if (!response.ok || !response.data) {
        throw new Error(response.error?.message || "Health action returned an invalid response.");
      }

      state.current = {
        status: "success",
        message: "Backend reachable",
        data: response.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown backend error.";
      state.current = { status: "error", message };
    }

    syncState();
  });

  const checklist = document.createElement("ul");
  checklist.className = "checklist";

  [
    "Vite + TypeScript scaffold for the static frontend",
    "Environment-aware API base URL for dev and prod",
    "Typed request and response DTOs for milestone actions",
    "Apps Script backend stub with a POST health action",
    "GitHub Actions Pages deployment workflow",
  ].forEach((item) => {
    const row = document.createElement("li");
    row.textContent = item;
    checklist.append(row);
  });

  statusCard.append(statusLabel, statusMessage, endpoint, actionButton);
  card.append(eyebrow, title, description, statusCard, checklist);
  container.append(card);

  syncState();

  return container;
};
