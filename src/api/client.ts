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
  requestId = createRequestId(),
): Promise<ApiResponse<ApiActionMap[TAction]["data"]>> => {
  if (!env.backendUrl) {
    throw new Error("VITE_API_BASE_URL is not configured.");
  }

  const requestBody: ApiEnvelope<TAction, ApiActionMap[TAction]["payload"]> = {
    action,
    payload,
    requestId,
    ...(sessionToken ? { sessionToken } : {}),
  };

  const response = await fetch(env.backendUrl, {
    method: "POST",
    headers: {
      // The Worker keeps accepting the raw action envelope body.
      "content-type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  const parseEnvelope = (text: string): ApiResponse<ApiActionMap[TAction]["data"]> | null => {
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text) as ApiResponse<ApiActionMap[TAction]["data"]>;
    } catch {
      return null;
    }
  };

  const envelope = parseEnvelope(responseText);

  if (!response.ok) {
    const backendMessage =
      envelope?.error?.message || envelope?.error?.code || response.statusText;
    const errorMessage =
      backendMessage && backendMessage !== "OK"
        ? `${backendMessage} (status ${response.status})`
        : `Backend request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  if (!envelope) {
    throw new Error("Backend returned an unexpected response.");
  }

  return envelope;
};
