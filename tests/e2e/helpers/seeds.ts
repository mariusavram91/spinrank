import type { APIRequestContext } from "@playwright/test";
import { TEST_AUTH_SECRET, WORKER_BASE_URL } from "./bootstrap";

export type DashboardSeedScenario =
  | "scope-fixtures"
  | "inactive"
  | "low-volume"
  | "global-rank-gt11";

export interface SeedDashboardResponse {
  seasonId?: string;
  tournamentId?: string;
  emptyTournamentId?: string;
  rivalId?: string;
}

interface SeedResponseEnvelope {
  ok: boolean;
  data: SeedDashboardResponse | null;
  error: { message: string } | null;
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
  const response = await request.post(endpoint, {
    headers: {
      "content-type": "application/json",
      "x-test-auth-secret": TEST_AUTH_SECRET,
    },
    data: payload,
  });

  const body = (await response.json()) as SeedResponseEnvelope;
  if (!body.ok || !body.data) {
    throw new Error(body.error?.message || `Failed to seed dashboard state for ${payload.scenario}.`);
  }

  return body.data;
}
