import type { Page, Route } from "@playwright/test";

export interface MockParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  elo?: number;
  isSuggested?: boolean;
}

export interface MockParticipantSearchOptions {
  participants: MockParticipant[];
  segmentType?: "season" | "tournament" | "match";
  requestId?: string;
}

const isParticipantSearchRequest = (
  route: Route,
  options: MockParticipantSearchOptions,
): boolean => {
  const request = route.request();
  if (request.method() !== "POST") {
    return false;
  }

  const body = request.postDataJSON?.();
  if (body?.action !== "searchParticipants") {
    return false;
  }

  if (!options.segmentType) {
    return true;
  }

  return body?.payload?.segmentType === options.segmentType;
};

export async function mockParticipantSearch(
  page: Page,
  options: MockParticipantSearchOptions,
): Promise<void> {
  await page.route("**/api", async (route) => {
    if (!isParticipantSearchRequest(route, options)) {
      await route.continue();
      return;
    }

    const body = route.request().postDataJSON?.();
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
        data: {
          participants: options.participants.map((participant) => ({
            userId: participant.userId,
            displayName: participant.displayName,
            avatarUrl: participant.avatarUrl ?? null,
            elo: participant.elo ?? 1200,
            isSuggested: participant.isSuggested ?? true,
          })),
        },
        error: null,
        requestId: options.requestId ?? body?.requestId ?? "participant-search",
      }),
    });
  });
}
