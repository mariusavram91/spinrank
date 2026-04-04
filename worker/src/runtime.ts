export interface WorkerRuntimeDeps {
  now: () => number;
  nowIso: () => string;
  randomUUID: () => string;
}

const defaultRuntime: WorkerRuntimeDeps = {
  now: () => Date.now(),
  nowIso: () => new Date().toISOString(),
  randomUUID: () => crypto.randomUUID(),
};

export const resolveWorkerRuntime = (
  overrides?: Partial<WorkerRuntimeDeps>,
): WorkerRuntimeDeps => ({
  ...defaultRuntime,
  ...overrides,
});
