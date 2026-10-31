/**
 * One-off backfill: recompute persisted match impact snapshots so attendance
 * penalties reflect the corrected before/after semantics.
 *
 * Why: snapshots created before this fix charged a missed-week gap to the wrong
 * match (penalties that appear to shrink, e.g. 24 -> 8) and predate the
 * `attendanceMissedWeeks` field. `getMatches` serves a stored snapshot whenever
 * one exists, so those rows stay wrong until they are rebuilt.
 *
 * Safety:
 * - Dry run by default. Pass --apply to write.
 * - Operates on a local SQLite file only. There is no --remote path here on
 *   purpose: export the production D1 database to a file, run this against the
 *   file, then import the result back.
 * - Re-derives before deleting, so a failure cannot lose data.
 * - Idempotent: running it twice yields the same rows.
 *
 * Usage:
 *   npx vite-node scripts/recompute-match-impacts.ts -- --db ./prod-copy.sqlite --all
 *   npx vite-node scripts/recompute-match-impacts.ts -- --db ./prod-copy.sqlite --all --apply
 *   npx vite-node scripts/recompute-match-impacts.ts -- --db ./prod-copy.sqlite --user <id> --apply
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  deriveUserMatchImpactDetails,
  invalidateUserMatchImpactCache,
  persistMatchImpactSnapshotsForMatch,
} from "../worker/src/services/elo";
import type { Env } from "../worker/src/types";

// Minimal structural shapes so this script type-checks on its own: the Cloudflare
// Workers types live in worker/node_modules and are not part of the root project.
interface StatementResult<T> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface Args {
  db: string;
  users: string[];
  all: boolean;
  apply: boolean;
}

const parseArgs = (argv: string[]): Args => {
  const parsed: Args = { db: "", users: [], all: false, apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--db") parsed.db = argv[++index] ?? "";
    else if (arg === "--user") {
      const value = argv[++index];
      if (value) parsed.users.push(value);
    } else if (arg === "--all") parsed.all = true;
    else if (arg === "--apply") parsed.apply = true;
  }
  return parsed;
};

const sqlLiteral = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
};

const bindSql = (sql: string, params: readonly unknown[]): string =>
  sql.replace(/\?(\d+)/g, (_match, indexText: string) => {
    const index = Number(indexText) - 1;
    if (index < 0 || index >= params.length) throw new Error(`Missing bound value for ?${indexText}`);
    return sqlLiteral(params[index]);
  });

const MAX_BUFFER = 64 * 1024 * 1024;

class FileStatement {
  constructor(
    private readonly dbPath: string,
    private readonly sql: string,
    private readonly params: readonly unknown[] = [],
  ) {}

  bind(...params: unknown[]): FileStatement {
    return new FileStatement(this.dbPath, this.sql, params);
  }

  async first<T>(): Promise<T | null> {
    return (await this.all<T>()).results[0] ?? null;
  }

  async all<T>(): Promise<StatementResult<T>> {
    const stdout = execFileSync(
      "sqlite3",
      ["-json", "-cmd", ".timeout 5000", this.dbPath, bindSql(this.sql, this.params)],
      { encoding: "utf8", maxBuffer: MAX_BUFFER },
    ).trim();
    return { results: stdout ? (JSON.parse(stdout) as T[]) : [], success: true, meta: {} };
  }

  async run(): Promise<StatementResult<never>> {
    execFileSync("sqlite3", ["-cmd", ".timeout 5000", this.dbPath, bindSql(this.sql, this.params)], {
      encoding: "utf8",
      maxBuffer: MAX_BUFFER,
    });
    return { results: [], success: true, meta: {} };
  }

  toSql(): string {
    return bindSql(this.sql, this.params);
  }
}

class FileDb {
  constructor(private readonly dbPath: string) {}

  prepare(sql: string): FileStatement {
    return new FileStatement(this.dbPath, sql);
  }

  async batch(statements: readonly FileStatement[]): Promise<StatementResult<never>[]> {
    if (statements.length === 0) return [];
    const sql = statements.map((statement) => statement.toSql()).join(";\n");
    execFileSync("sqlite3", ["-cmd", ".timeout 5000", this.dbPath, `BEGIN;\n${sql};\nCOMMIT;`], {
      encoding: "utf8",
      maxBuffer: MAX_BUFFER,
    });
    return statements.map(() => ({ results: [], success: true, meta: {} }));
  }
}

const query = (dbPath: string, sql: string): Record<string, unknown>[] => {
  const stdout = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  }).trim();
  return stdout ? JSON.parse(stdout) : [];
};

// Only the pre-fix code wrote a breakdown without `attendanceMissedWeeks`, so its
// absence is an exact and stable signal of a stale row. Using a "penalty went
// down" heuristic instead would never converge: the 200-point score floor makes
// the applied penalty shrink legitimately when the conservative rating drops.
const stalePredicate = `mri.season_breakdown_json NOT LIKE '%attendanceMissedWeeks%'`;

const seasonMatchIdsForUser = (dbPath: string, userId: string): string[] =>
  query(
    dbPath,
    `SELECT DISTINCT m.id AS id
       FROM matches m
       JOIN match_players mp ON mp.match_id = m.id
      WHERE m.status = 'active'
        AND mp.user_id = ${sqlLiteral(userId)}
        AND (m.season_id IS NOT NULL OR m.tournament_id IS NOT NULL)`,
  ).map((row) => String(row.id));

const staleCountForUser = (dbPath: string, userId: string): number => {
  const rows = query(
    dbPath,
    `SELECT COUNT(*) AS n
       FROM match_rating_impacts mri
       JOIN matches m ON m.id = mri.match_id
      WHERE mri.user_id = ${sqlLiteral(userId)}
        AND m.status = 'active'
        AND mri.season_breakdown_json IS NOT NULL
        AND ${stalePredicate}`,
  );
  return Number(rows[0]?.n ?? 0);
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.db) throw new Error("Missing --db <path.sqlite>");
  if (!existsSync(args.db)) throw new Error(`Database not found: ${args.db}`);
  if (!args.all && args.users.length === 0) throw new Error("Pass --all or at least one --user <id>");

  const targetUsers = args.all
    ? query(args.db, "SELECT id FROM users ORDER BY id").map((row) => String(row.id))
    : args.users;

  console.log(`db:    ${args.db}`);
  console.log(`mode:  ${args.apply ? "APPLY (writes)" : "dry run (no writes, pass --apply to write)"}`);
  console.log(`users: ${targetUsers.length}`);
  console.log("");

  const env = { DB: new FileDb(args.db), APP_ENV: "dev" } as unknown as Env;

  let rebuilt = 0;
  let failed = 0;
  let skipped = 0;

  for (const userId of targetUsers) {
    const matchIds = seasonMatchIdsForUser(args.db, userId);
    if (matchIds.length === 0) continue;

    const stale = staleCountForUser(args.db, userId);
    if (stale === 0) {
      skipped += 1;
      continue;
    }

    if (!args.apply) {
      console.log(`  ${userId}: ${stale} stale snapshot(s) of ${matchIds.length} season match(es) would be rebuilt`);
      continue;
    }

    try {
      invalidateUserMatchImpactCache();
      const derived = await deriveUserMatchImpactDetails(env, userId, matchIds);
      const rederivable = Object.keys(derived);
      if (rederivable.length === 0) {
        skipped += 1;
        continue;
      }

      execFileSync(
        "sqlite3",
        [
          "-cmd",
          ".timeout 5000",
          args.db,
          `DELETE FROM match_rating_impacts
             WHERE user_id = ${sqlLiteral(userId)}
               AND match_id IN (${rederivable.map(sqlLiteral).join(",")})`,
        ],
        { encoding: "utf8" },
      );

      invalidateUserMatchImpactCache();
      for (const matchId of rederivable) {
        await persistMatchImpactSnapshotsForMatch(env, matchId, [userId]);
      }
      rebuilt += rederivable.length;
      console.log(`  ${userId}: rebuilt ${rederivable.length} snapshot(s)`);
    } catch (error) {
      failed += 1;
      console.error(`  ${userId}: FAILED - ${(error as Error).message}`);
    }
  }

  console.log("");
  console.log(
    args.apply
      ? `done: ${rebuilt} snapshot(s) rebuilt, ${skipped} user(s) already current, ${failed} user(s) failed`
      : `dry run complete: ${skipped} user(s) already current, no changes written`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
