import type { APIRequestContext, Page } from "@playwright/test";
import type { AppSession } from "../../../src/api/contract";
import { bootstrapTestUser, persistAppSession } from "./bootstrap";

export type PersonaRole = "owner" | "rival" | "guest";

export interface PersonaSession {
  role: PersonaRole;
  session: AppSession;
}

export interface PersonaOverrides {
  userId?: string;
  displayName?: string;
  email?: string | null;
  avatarUrl?: string | null;
}

const defaultDisplayName: Record<PersonaRole, string> = {
  owner: "E2E Owner",
  rival: "E2E Rival",
  guest: "E2E Guest",
};

export const createTestToken = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function bootstrapPersona(
  request: APIRequestContext,
  role: PersonaRole,
  token: string,
  overrides: PersonaOverrides = {},
): Promise<PersonaSession> {
  const session = await bootstrapTestUser(request, {
    userId: overrides.userId ?? `${token}-${role}`,
    displayName: overrides.displayName ?? defaultDisplayName[role],
    email: overrides.email,
    avatarUrl: overrides.avatarUrl,
  });

  return { role, session };
}

export async function signInAsPersona(
  page: Page,
  request: APIRequestContext,
  role: PersonaRole,
  token: string,
  overrides: PersonaOverrides = {},
): Promise<PersonaSession> {
  const persona = await bootstrapPersona(request, role, token, overrides);
  await persistAppSession(page, persona.session);
  return persona;
}
