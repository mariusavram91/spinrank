import { env } from "../config/env";

export interface ProviderTokenResult {
  provider: "google";
  idToken: string;
  nonce: string;
  profile?: {
    displayName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce: string;
  ux_mode?: "popup";
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

interface GoogleButtonConfiguration {
  type?: "standard";
  theme?: "filled_black";
  text?: "continue_with";
  shape?: "pill";
  size?: "large";
  width?: number;
  logo_alignment?: "left";
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void;
          renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void;
        };
      };
    };
  }
}

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

const scriptLoads = new Map<string, Promise<void>>();

const loadScript = (src: string): Promise<void> => {
  const existing = scriptLoads.get(src);
  if (existing) {
    return existing;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const found = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (found?.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = found ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}.`));

    if (!found) {
      document.head.append(script);
    }
  });

  scriptLoads.set(src, promise);
  return promise;
};

const createNonce = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `nonce_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const isProviderConfigured = (): boolean => env.googleClientId.length > 0;

export const renderGoogleButton = async (
  host: HTMLElement,
  onSuccess: (result: ProviderTokenResult) => Promise<void>,
): Promise<void> => {
  if (!env.googleClientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID is not configured.");
  }

  await loadScript(GOOGLE_SCRIPT_SRC);

  if (!window.google?.accounts.id) {
    throw new Error("Google Identity Services did not initialize.");
  }

  const nonce = createNonce();
  host.replaceChildren();

  window.google.accounts.id.initialize({
    client_id: env.googleClientId,
    nonce,
    ux_mode: "popup",
    auto_select: false,
    cancel_on_tap_outside: true,
    callback: (response) => {
      if (!response.credential) {
        return;
      }

      void onSuccess({
        provider: "google",
        idToken: response.credential,
        nonce,
      });
    },
  });

  window.google.accounts.id.renderButton(host, {
    type: "standard",
    theme: "filled_black",
    text: "continue_with",
    shape: "pill",
    size: "large",
    width: 240,
    logo_alignment: "left",
  });
};
