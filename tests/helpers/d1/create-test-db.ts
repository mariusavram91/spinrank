import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { applyMigrations } from "./apply-migrations";

const execFileAsync = promisify(execFile);

export interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

const sqlLiteral = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot bind non-finite number: ${value}`);
    }
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
};

const bindSql = (sql: string, params: readonly unknown[]): string =>
  sql.replace(/\?(\d+)/g, (_match, indexText: string) => {
    const index = Number(indexText) - 1;
    if (index < 0 || index >= params.length) {
      throw new Error(`Missing bound value for placeholder ?${indexText}`);
    }
    return sqlLiteral(params[index]);
  });

export class TestD1PreparedStatement implements D1PreparedStatement {
  constructor(
    private readonly dbPath: string,
    private readonly sql: string,
    private readonly boundParams: readonly unknown[] = [],
  ) {}

  bind(...params: unknown[]): TestD1PreparedStatement {
    return new TestD1PreparedStatement(this.dbPath, this.sql, params);
  }

  async first<T>(): Promise<T | null> {
    const result = await this.all<T>();
    return result.results[0] ?? null;
  }

  async all<T>(): Promise<D1Result<T>> {
    const rows = await runSqlJson<T>(this.dbPath, bindSql(this.sql, this.boundParams));
    return {
      results: rows,
      success: true,
      meta: { rows_read: rows.length },
    };
  }

  async run(): Promise<D1Result<never>> {
    await runSql(this.dbPath, bindSql(this.sql, this.boundParams));
    return {
      results: [],
      success: true,
      meta: {},
    };
  }

  toSql(): string {
    return bindSql(this.sql, this.boundParams);
  }
}

const runSql = async (dbPath: string, sql: string): Promise<void> => {
  await execFileAsync("sqlite3", [
    "-cmd",
    ".timeout 5000",
    dbPath,
    `PRAGMA foreign_keys = ON;\n${sql}`,
  ]);
};

const runSqlJson = async <T>(dbPath: string, sql: string): Promise<T[]> => {
  const { stdout } = await execFileAsync("sqlite3", [
    "-json",
    "-cmd",
    ".timeout 5000",
    dbPath,
    `PRAGMA foreign_keys = ON;\n${sql}`,
  ]);
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }
  return JSON.parse(trimmed) as T[];
};

export class TestD1Database implements D1Database {
  constructor(private readonly dbPath: string) {}

  prepare(sql: string): TestD1PreparedStatement {
    return new TestD1PreparedStatement(this.dbPath, sql);
  }

  async batch(statements: readonly TestD1PreparedStatement[]): Promise<D1Result<never>[]> {
    if (statements.length === 0) {
      return [];
    }

    const sql = statements.map((statement) => statement.toSql()).join(";\n");
    await runSql(this.dbPath, `BEGIN;\n${sql};\nCOMMIT;`);

    return statements.map(() => ({
      results: [],
      success: true,
      meta: {},
    }));
  }
}

export interface TestDatabaseContext {
  DB: TestD1Database;
  cleanup: () => Promise<void>;
}

export const createTestDatabase = async (): Promise<TestDatabaseContext> => {
  const tempDir = await mkdtemp(join(tmpdir(), "spinrank-test-db-"));
  const dbPath = join(tempDir, "worker.sqlite");
  const DB = new TestD1Database(dbPath);

  await applyMigrations(async (sql) => {
    await runSql(dbPath, sql);
  });

  return {
    DB,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
};
