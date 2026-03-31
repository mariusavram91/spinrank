const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const appEnv = import.meta.env.VITE_APP_ENV?.trim() || "dev";
const backendUrlRaw = import.meta.env.VITE_API_BASE_URL?.trim() || "";
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";

export const env = {
  appEnv,
  backendUrl: backendUrlRaw ? trimTrailingSlash(backendUrlRaw) : "",
  googleClientId,
  appName: "SpinRank",
} as const;

export const hasBackendConfig = env.backendUrl.length > 0;
