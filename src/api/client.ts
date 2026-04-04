import { env } from "../config/env";
import type { ApiAction, ApiActionMap, ApiEnvelope, ApiResponse } from "./contract";

export const createRequestId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}`;
};

export interface ApiClientDeps {
  backendUrl: string;
  fetchImpl?: typeof fetch;
  createRequestId?: () => string;
}

const parseEnvelope = <TData>(text: string): ApiResponse<TData> | null => {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as ApiResponse<TData>;
  } catch {
    return null;
  }
};

export const createApiClient = ({
  backendUrl,
  fetchImpl = fetch,
  createRequestId: createRequestIdImpl = createRequestId,
}: ApiClientDeps) => {
  const postAction = async <TAction extends ApiAction>(
    action: TAction,
    payload: ApiActionMap[TAction]["payload"],
    sessionToken?: string,
    requestId = createRequestIdImpl(),
  ): Promise<ApiResponse<ApiActionMap[TAction]["data"]>> => {
    if (!backendUrl) {
      throw new Error("VITE_API_BASE_URL is not configured.");
    }

    const requestBody: ApiEnvelope<TAction, ApiActionMap[TAction]["payload"]> = {
      action,
      payload,
      requestId,
      ...(sessionToken ? { sessionToken } : {}),
    };

    const response = await fetchImpl(backendUrl, {
      method: "POST",
      headers: {
        // The Worker keeps accepting the raw action envelope body.
        "content-type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    const envelope = parseEnvelope<ApiActionMap[TAction]["data"]>(responseText);

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

  return {
    postAction,
  };
};

const defaultApiClient = createApiClient({
  backendUrl: env.backendUrl,
});

export const postAction = defaultApiClient.postAction;
