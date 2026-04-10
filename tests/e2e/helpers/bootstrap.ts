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

const TRANSIENT_WORKER_RESTART_MESSAGE = "Your worker restarted mid-request.";

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function bootstrapTestUser(
  request: APIRequestContext,
  payload: BootstrapUserPayload,
): Promise<AppSession> {
  const endpoint = `${WORKER_BASE_URL.replace(/\/$/, "")}/test/bootstrap-user`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
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
      const shouldRetry =
        rawBody.includes(TRANSIENT_WORKER_RESTART_MESSAGE) ||
        (response.status() >= 500 && attempt < 2);
      if (shouldRetry) {
        await wait(250 * (attempt + 1));
        continue;
      }
      throw new Error(
        `Failed to bootstrap test user. Expected JSON from ${endpoint}, received: ${rawBody.slice(0, 200)}`,
      );
    }

    if (body?.ok && body.data) {
      return body.data;
    }

    const shouldRetry =
      response.status() >= 500 ||
      body?.error?.message?.includes(TRANSIENT_WORKER_RESTART_MESSAGE) ||
      false;
    if (shouldRetry && attempt < 2) {
      await wait(250 * (attempt + 1));
      continue;
    }

    throw new Error(body?.error?.message || "Failed to bootstrap test user.");
  }
  throw new Error("Failed to bootstrap test user.");
}

export async function persistAppSession(page: Page, session: AppSession): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [SESSION_STORAGE_KEY, JSON.stringify(session)],
  );
}
