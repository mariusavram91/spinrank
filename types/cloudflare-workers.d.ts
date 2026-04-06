interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
  toSql(): string;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: readonly D1PreparedStatement[]): Promise<D1Result<unknown>[]>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface CacheStorage {
  default: Cache;
}

interface CfProperties {
  cacheEverything?: boolean;
  cacheTtl?: number;
}

interface RequestInit {
  cf?: CfProperties;
}
