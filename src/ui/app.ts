import type { AppSession, BootstrapUserData } from "../api/contract";
import { postAction } from "../api/client";
import { env, hasBackendConfig } from "../config/env";
import { isProviderConfigured, renderGoogleButton } from "../auth/providers";
import { clearSession, isExpiredSession, loadSession, saveSession } from "../auth/session";

type ViewState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "error"; message: string }
  | { status: "authenticated"; message: string; session: AppSession };

const formatExpiry = (expiresAt: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(expiresAt));

const buildSessionFromBootstrap = (data: BootstrapUserData): AppSession => ({
  sessionToken: data.sessionToken,
  expiresAt: data.expiresAt,
  user: data.user,
});

export const buildApp = (): HTMLElement => {
  const container = document.createElement("main");
  container.className = "shell";

  const card = document.createElement("section");
  card.className = "panel";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `Milestone 1 authentication • ${env.appEnv}`;

  const title = document.createElement("h1");
  title.textContent = env.appName;

  const description = document.createElement("p");
  description.className = "lede";
  description.textContent =
    "Sign in with Google, exchange the ID token for a short-lived app session, and keep the app locked behind authentication.";

  const authCard = document.createElement("div");
  authCard.className = "auth-card";

  const statusLabel = document.createElement("p");
  statusLabel.className = "status-label";
  statusLabel.textContent = "Session state";

  const statusMessage = document.createElement("p");
  statusMessage.className = "status-message";

  const detailMessage = document.createElement("p");
  detailMessage.className = "detail-message";

  const providerStack = document.createElement("div");
  providerStack.className = "provider-stack";

  const googleSlot = document.createElement("div");
  googleSlot.className = "google-slot";

  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.className = "secondary-button";
  logoutButton.textContent = "Log out";

  const configList = document.createElement("dl");
  configList.className = "config-list";

  const state: { current: ViewState } = {
    current: (() => {
      const existing = loadSession();
      return existing
        ? { status: "authenticated", message: "Signed in", session: existing }
        : hasBackendConfig
          ? { status: "idle", message: "Sign in with Google to start a session." }
          : { status: "error", message: "Configure the backend URL before testing login." };
    })(),
  };

  const syncState = (): void => {
    statusMessage.textContent = state.current.message;
    statusMessage.dataset.status = state.current.status;

    if (state.current.status === "authenticated") {
      detailMessage.textContent = `${state.current.session.user.displayName} • Session expires ${formatExpiry(
        state.current.session.expiresAt,
      )}`;
      providerStack.replaceChildren(logoutButton);
      logoutButton.hidden = false;
      return;
    }

    detailMessage.textContent = env.backendUrl
      ? `Backend: ${env.backendUrl}`
      : "Backend: VITE_API_BASE_URL is not set";
    providerStack.replaceChildren(googleSlot);
    logoutButton.hidden = true;
  };

  const setIdleState = (): void => {
    state.current = hasBackendConfig
      ? { status: "idle", message: "Sign in with Google to start a session." }
      : { status: "error", message: "Configure the backend URL before testing login." };
    syncState();
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
    state.current = { status: "loading", message: `Signing in with ${result.provider}...` };
    syncState();

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

      const session = buildSessionFromBootstrap(response.data);
      saveSession(session);
      state.current = {
        status: "authenticated",
        message: "Signed in",
        session,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      state.current = { status: "error", message };
    }

    syncState();
  };

  logoutButton.addEventListener("click", () => {
    clearSession();
    setIdleState();
  });

  const sessionTicker = window.setInterval(() => {
    if (state.current.status !== "authenticated") {
      return;
    }

    if (isExpiredSession(state.current.session)) {
      clearSession();
      state.current = { status: "error", message: "Your session expired. Sign in again." };
      syncState();
      return;
    }

    syncState();
  }, 30_000);

  window.addEventListener("beforeunload", () => {
    window.clearInterval(sessionTicker);
  });

  const checklist = document.createElement("ul");
  checklist.className = "checklist";

  [
    "Google Sign-In button rendered with Google Identity Services",
    "Backend-issued session token persisted in local storage",
    "Session expiry check that forces a relogin on timeout",
    "Apps Script bootstrap endpoint wired for Google token verification",
    "Apple sign-in explicitly deferred until Apple Developer enrollment",
  ].forEach((item) => {
    const row = document.createElement("li");
    row.textContent = item;
    checklist.append(row);
  });

  [
    ["Backend", env.backendUrl || "Not configured"],
    ["Google Client ID", env.googleClientId || "Not configured"],
  ].forEach(([term, detail]) => {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = detail;
    configList.append(dt, dd);
  });

  authCard.append(statusLabel, statusMessage, detailMessage, providerStack);
  card.append(eyebrow, title, description, authCard, configList, checklist);
  container.append(card);

  googleSlot.classList.toggle("provider-disabled", !isProviderConfigured());

  if (hasBackendConfig && isProviderConfigured()) {
    void renderGoogleButton(googleSlot, handleBootstrap).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Google sign in failed to initialize.";
      state.current = { status: "error", message };
      syncState();
    });
  } else {
    googleSlot.textContent = hasBackendConfig
      ? "Configure VITE_GOOGLE_CLIENT_ID to enable Google sign in."
      : "Configure VITE_API_BASE_URL to enable sign in.";
  }

  syncState();

  return container;
};
