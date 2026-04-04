import type { WorkerRuntimeDeps } from "./runtime";
import { resolveWorkerRuntime } from "./runtime";

export function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return JSON.parse(value) as T[];
}

export function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

export function encodeCursor(input: { playedAt: string; createdAt: string; id: string }): string {
  return btoa(JSON.stringify(input));
}

export function decodeCursor(
  cursor: string | undefined,
): { playedAt: string; createdAt: string; id: string } | null {
  if (!cursor) {
    return null;
  }

  return JSON.parse(atob(cursor)) as { playedAt: string; createdAt: string; id: string };
}

export function isoNow(runtime?: Partial<WorkerRuntimeDeps>): string {
  return resolveWorkerRuntime(runtime).nowIso();
}

export function dateOnly(value: string): string {
  return value.slice(0, 10);
}

export function randomId(prefix: string, runtime?: Partial<WorkerRuntimeDeps>): string {
  return `${prefix}_${resolveWorkerRuntime(runtime).randomUUID()}`;
}
