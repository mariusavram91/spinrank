import type { APIRequestContext, Page } from "@playwright/test";
import type { AppSession } from "../../../src/api/contract";

export const WORKER_BASE_URL = process.env.WORKER_BASE_URL ?? "http://127.0.0.1:8787";
export const TEST_AUTH_SECRET = process.env.TEST_AUTH_SECRET ?? "test-auth-secret";
export const SESSION_STORAGE_KEY = "spinrank.session";

export interface BootstrapUserPayload {
  userId?: string;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  providerUserId?: string;
}

interface BootstrapUserResponse {
  ok: boolean;
  data: AppSession | null;
  error: { message: string } | null;
}

export async function bootstrapTestUser(
  request: APIRequestContext,
  payload: BootstrapUserPayload,
): Promise<AppSession> {
  const endpoint = `${WORKER_BASE_URL.replace(/\/$/, "")}/test/bootstrap-user`;
  const response = await request.post(endpoint, {
    headers: {
      "content-type": "application/json",
      "x-test-auth-secret": TEST_AUTH_SECRET,
    },
    data: payload,
  });

  const rawBody = await response.text();
  let body: BootstrapUserResponse | null = null;
  try {
    body = rawBody ? (JSON.parse(rawBody) as BootstrapUserResponse) : null;
  } catch {
    throw new Error(
      `Failed to bootstrap test user. Expected JSON from ${endpoint}, received: ${rawBody.slice(0, 200)}`,
    );
  }

  if (!body || !body.ok || !body.data) {
    throw new Error(body?.error?.message || "Failed to bootstrap test user.");
  }

  return body.data;
}

export async function persistAppSession(page: Page, session: AppSession): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [SESSION_STORAGE_KEY, JSON.stringify(session)],
  );
}
