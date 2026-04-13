import type { APIRequestContext, APIResponse } from "@playwright/test";
import { TEST_AUTH_SECRET, WORKER_BASE_URL } from "./bootstrap";

export type DashboardSeedScenario =
  | "scope-fixtures"
  | "inactive"
  | "low-volume"
  | "global-rank-gt11";

export type MatchLockSeedScenario =
  | "completed-season"
  | "completed-tournament"
  | "no-eligible-bracket"
  | "locked-bracket";

export interface SeedDashboardResponse {
  seasonId?: string;
  tournamentId?: string;
  emptyTournamentId?: string;
  rivalId?: string;
}

export interface SeedProfileResponse {
  seasonId: string;
  seasonName: string;
  rivalId: string;
  rivalDisplayName: string;
}

export interface SeedMatchLocksResponse {
  seasonId?: string;
  tournamentId?: string;
}

interface SeedResponseEnvelope {
  ok: boolean;
  data: SeedDashboardResponse | SeedProfileResponse | SeedMatchLocksResponse | Record<string, never> | null;
  error: { message: string } | null;
}

const TRANSIENT_WORKER_RESTART_MESSAGE = "Your worker restarted mid-request.";

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function parseSeedResponse(
  response: APIResponse,
  endpoint: string,
  failureMessage: string,
): Promise<SeedResponseEnvelope | null> {
  const rawBody = await response.text();
  try {
    return rawBody ? (JSON.parse(rawBody) as SeedResponseEnvelope) : null;
  } catch {
    throw new Error(
      `${failureMessage} Expected JSON from ${endpoint} (${response.status()} ${response.statusText()}), received: ${rawBody.slice(0, 200)}`,
    );
  }
}

async function postSeedWithRetry(
  request: APIRequestContext,
  endpoint: string,
  payload: unknown,
  failureMessage: string,
): Promise<SeedResponseEnvelope | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await request.post(endpoint, {
      headers: {
        "content-type": "application/json",
        "x-test-auth-secret": TEST_AUTH_SECRET,
      },
      data: payload,
    });

    const body = await parseSeedResponse(response, endpoint, failureMessage);
    const shouldRetry =
      response.status() >= 500 ||
      body?.error?.message?.includes(TRANSIENT_WORKER_RESTART_MESSAGE) ||
      false;

    if (shouldRetry && attempt < 2) {
      await wait(250 * (attempt + 1));
      continue;
    }

    return body;
  }

  return null;
}

export async function seedDashboardState(
  request: APIRequestContext,
  payload: {
    ownerId: string;
    namespace: string;
    scenario: DashboardSeedScenario;
  },
): Promise<SeedDashboardResponse> {
  const endpoint = `${WORKER_BASE_URL.replace(/\/$/, "")}/test/seed-dashboard`;
  const body = await postSeedWithRetry(request, endpoint, payload, `Failed to seed dashboard state for ${payload.scenario}.`);
  if (!body || !body.ok || !body.data) {
    throw new Error(body?.error?.message || `Failed to seed dashboard state for ${payload.scenario}.`);
  }

  return body.data;
}

export async function seedProfileState(
  request: APIRequestContext,
  payload: {
    ownerId: string;
    namespace: string;
  },
): Promise<SeedProfileResponse> {
  const endpoint = `${WORKER_BASE_URL.replace(/\/$/, "")}/test/seed-profile`;
  const body = await postSeedWithRetry(request, endpoint, payload, "Failed to seed profile state.");
  if (!body || !body.ok || !body.data) {
    throw new Error(body?.error?.message || "Failed to seed profile state.");
  }

  return body.data as SeedProfileResponse;
}

export async function seedAchievementsState(
  request: APIRequestContext,
  payload: {
    ownerId: string;
    namespace?: string;
  },
): Promise<void> {
  const endpoint = `${WORKER_BASE_URL.replace(/\/$/, "")}/test/seed-achievements`;
  const body = await postSeedWithRetry(request, endpoint, payload, "Failed to seed achievements state.");
  if (!body || !body.ok) {
    throw new Error(body?.error?.message || "Failed to seed achievements state.");
  }
}

export async function seedMatchLockState(
  request: APIRequestContext,
  payload: {
    ownerId: string;
    namespace: string;
    scenario: MatchLockSeedScenario;
  },
): Promise<SeedMatchLocksResponse> {
  const endpoint = `${WORKER_BASE_URL.replace(/\/$/, "")}/test/seed-match-locks`;
  const body = await postSeedWithRetry(request, endpoint, payload, `Failed to seed match lock state for ${payload.scenario}.`);
  if (!body || !body.ok || !body.data) {
    throw new Error(body?.error?.message || `Failed to seed match lock state for ${payload.scenario}.`);
  }

  return body.data as SeedMatchLocksResponse;
}
