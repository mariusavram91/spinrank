import { env } from "../../../config/env";

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

export const setAvatarImage = (
  image: HTMLImageElement,
  userId: string | null | undefined,
  avatarUrl: string | null | undefined,
  fallbackSrc: string,
  alt: string,
): void => {
  image.alt = alt;
  image.onerror = () => {
    image.onerror = null;
    image.src = fallbackSrc;
  };
  image.src = getAvatarSrc(userId, avatarUrl) || fallbackSrc;
};
