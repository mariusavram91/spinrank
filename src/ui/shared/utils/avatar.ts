import { env } from "../../../config/env";

const AVATAR_FALLBACK_COLORS = [
  "#1f3a8a",
  "#155e75",
  "#0f766e",
  "#166534",
  "#7c2d12",
  "#7f1d1d",
  "#6b21a8",
  "#1e3a8a",
  "#064e3b",
  "#14532d",
  "#365314",
  "#9a3412",
  "#c2410c",
  "#78350f",
  "#7a2e0e",
  "#831843",
  "#4a044e",
  "#27272a",
] as const;

const avatarFallbackCache = new Map<string, string>();

const getBackendOrigin = (): string => {
  if (!env.backendUrl) {
    return "";
  }

  try {
    return new URL(env.backendUrl).origin;
  } catch {
    return "";
  }
};

export const getAvatarSrc = (
  userId: string | null | undefined,
  avatarUrl: string | null | undefined,
): string | null => {
  if (!avatarUrl) {
    return null;
  }

  const backendOrigin = getBackendOrigin();
  if (!backendOrigin || !userId) {
    return avatarUrl;
  }

  return `${backendOrigin}/avatar/${encodeURIComponent(userId)}`;
};

const hashDisplayName = (displayName: string): number => {
  let hash = 0;
  for (let index = 0; index < displayName.length; index += 1) {
    hash = Math.imul(31, hash) + displayName.charCodeAt(index);
  }
  return hash >>> 0;
};

const getDisplayInitial = (displayName: string | null | undefined): string | null => {
  if (!displayName) {
    return null;
  }
  const trimmed = displayName.trim();
  if (!trimmed) {
    return null;
  }
  const [initial] = trimmed;
  return initial ? initial.toUpperCase() : null;
};

const getAvatarFallbackSrc = (
  displayName: string | null | undefined,
  fallbackSrc: string,
): string => {
  const initial = getDisplayInitial(displayName);
  if (!initial || !displayName) {
    return fallbackSrc;
  }
  const key = `${displayName.trim().toLocaleLowerCase()}::${initial}`;
  const cached = avatarFallbackCache.get(key);
  if (cached) {
    return cached;
  }
  const color = AVATAR_FALLBACK_COLORS[hashDisplayName(key) % AVATAR_FALLBACK_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${initial}"><rect width="64" height="64" rx="32" fill="${color}"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" font-weight="700">${initial}</text></svg>`;
  const source = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  avatarFallbackCache.set(key, source);
  return source;
};

export const setAvatarImage = (
  image: HTMLImageElement,
  userId: string | null | undefined,
  avatarUrl: string | null | undefined,
  fallbackSrc: string,
  alt: string,
  displayName?: string | null,
): void => {
  const resolvedFallbackSrc = getAvatarFallbackSrc(displayName, fallbackSrc);
  image.alt = alt;
  image.onerror = () => {
    image.onerror = null;
    image.src = resolvedFallbackSrc;
  };
  image.src = getAvatarSrc(userId, avatarUrl) || resolvedFallbackSrc;
};
