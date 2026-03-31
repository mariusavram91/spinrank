import { env } from "../config/env";
import type { ApiAction, ApiActionMap, ApiEnvelope, ApiResponse } from "./contract";

const createRequestId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}`;
};

export const postAction = async <TAction extends ApiAction>(
  action: TAction,
  payload: ApiActionMap[TAction]["payload"],
  sessionToken?: string,
): Promise<ApiResponse<ApiActionMap[TAction]["data"]>> => {
  if (!env.backendUrl) {
    throw new Error("VITE_API_BASE_URL is not configured.");
  }

  const requestBody: ApiEnvelope<TAction, ApiActionMap[TAction]["payload"]> = {
    action,
    payload,
    requestId: createRequestId(),
    ...(sessionToken ? { sessionToken } : {}),
  };

  const response = await fetch(env.backendUrl, {
    method: "POST",
    headers: {
      // Apps Script web apps are easier to call from the browser without a CORS preflight.
      "content-type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Backend request failed with status ${response.status}.`);
  }

  return (await response.json()) as ApiResponse<ApiActionMap[TAction]["data"]>;
};
