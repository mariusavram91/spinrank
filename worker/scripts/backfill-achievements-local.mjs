import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildAchievementState } from "../src/services/achievementRebuildShared.js";

const execFileAsync = promisify(execFile);
const WORKER_DIR = fileURLToPath(new URL("..", import.meta.url));

function parseArgs(argv) {
  const options = {
    env: "dev",
    persistTo: null,
    userId: null,
    write: false,
    remote: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env") {
      options.env = argv[index + 1] ?? options.env;
      index += 1;
    } else if (arg === "--persist-to") {
      options.persistTo = argv[index + 1] ?? options.persistTo;
      index += 1;
    } else if (arg === "--user") {
      options.userId = argv[index + 1] ?? options.userId;
      index += 1;
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--remote") {
      options.remote = true;
    } else if (arg === "--local") {
      options.remote = false;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.remote) {
    options.persistTo ??= `.wrangler/state/${options.env}`;
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run achievements:backfill -- [--env dev|e2e|prod] [--local|--remote] [--persist-to PATH] [--user USER_ID] [--write]

Defaults to local dry-run mode. Add --write to persist changes.
Use --remote for Cloudflare D1 remote databases, including production.
`);
}

function shellCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

async function runWrangler(args, options = {}) {
  const { stdout, stderr } = await execFileAsync(shellCommand(), ["wrangler", ...args], {
    cwd: WORKER_DIR,
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  if (stderr?.trim()) {
    process.stderr.write(stderr);
  }
  return stdout;
}

async function d1Json(options, sql) {
  const args = [
    "d1",
    "execute",
    "DB",
    "--env",
    options.env,
    "--json",
    "--command",
    sql,
  ];
  if (options.remote) {
    args.splice(5, 0, "--remote");
  } else {
    args.splice(5, 0, "--local", `--persist-to=${options.persistTo}`);
  }
  const stdout = await runWrangler(args);
  const parsed = JSON.parse(stdout);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first?.results ?? [];
}

async function d1Execute(options, sql) {
  const args = [
    "d1",
    "execute",
    "DB",
    "--env",
    options.env,
    "--command",
    sql,
  ];
  if (options.remote) {
    args.splice(5, 0, "--remote");
  } else {
    args.splice(5, 0, "--local", `--persist-to=${options.persistTo}`);
  }
  await runWrangler(args);
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildUserUpsertSql(userId, achievementStates) {
  return [
    "BEGIN TRANSACTION;",
    ...achievementStates.map(
      (achievement) => `
        INSERT INTO user_achievements (
          user_id, achievement_key, unlocked_at, progress_value, progress_target, last_evaluated_at, context_json
        ) VALUES (
          ${sqlString(userId)},
          ${sqlString(achievement.key)},
          ${achievement.unlock ? sqlString(achievement.nowIso) : "NULL"},
          ${achievement.progressValue},
          ${achievement.progressTarget ?? "NULL"},
          ${sqlString(achievement.nowIso)},
          ${sqlString(JSON.stringify(achievement.context ?? {}))}
        )
        ON CONFLICT(user_id, achievement_key) DO UPDATE SET
          progress_value = MAX(user_achievements.progress_value, excluded.progress_value),
          progress_target = COALESCE(user_achievements.progress_target, excluded.progress_target),
          unlocked_at = COALESCE(user_achievements.unlocked_at, excluded.unlocked_at),
          last_evaluated_at = excluded.last_evaluated_at,
          context_json = CASE
            WHEN user_achievements.unlocked_at IS NULL AND excluded.unlocked_at IS NOT NULL THEN excluded.context_json
            ELSE user_achievements.context_json
          END;
      `,
    ),
    "COMMIT;",
  ].join("\n");
}

function mapCountRows(rows, keyField) {
  return new Map(rows.map((row) => [row[keyField], Number(row.count ?? row.created_count ?? row.played_count ?? 0)]));
}

async function loadData(options) {
  const userFilter = options.userId ? `WHERE ranked.id = ${sqlString(options.userId)}` : "";
  const users = await d1Json(
    options,
    `
      SELECT *
      FROM (
        SELECT
          id,
          global_elo,
          wins,
          losses,
          streak,
          created_at,
          ROW_NUMBER() OVER (ORDER BY global_elo DESC, wins DESC, losses ASC, display_name ASC) AS rank,
          (wins + losses) AS matches_played
        FROM users
      ) ranked
      ${userFilter}
      ORDER BY ranked.id ASC
    `,
  );

  const idFilter = options.userId ? `WHERE created_by_user_id = ${sqlString(options.userId)}` : "";
  const playedUserFilter = options.userId ? `AND mp.user_id = ${sqlString(options.userId)}` : "";
  const seasonsCreatedRows = await d1Json(
    options,
    `
      SELECT created_by_user_id AS user_id, COUNT(*) AS created_count
      FROM seasons
      ${idFilter}
      GROUP BY created_by_user_id
    `,
  );
  const tournamentsCreatedRows = await d1Json(
    options,
    `
      SELECT created_by_user_id AS user_id, COUNT(*) AS created_count
      FROM tournaments
      ${idFilter}
      GROUP BY created_by_user_id
    `,
  );
  const seasonsPlayedRows = await d1Json(
    options,
    `
      SELECT mp.user_id, COUNT(DISTINCT m.season_id) AS played_count
      FROM match_players mp
      JOIN matches m ON m.id = mp.match_id
      WHERE m.status = 'active' AND m.season_id IS NOT NULL ${playedUserFilter}
      GROUP BY mp.user_id
    `,
  );
  const tournamentsPlayedRows = await d1Json(
    options,
    `
      SELECT mp.user_id, COUNT(DISTINCT m.tournament_id) AS played_count
      FROM match_players mp
      JOIN matches m ON m.id = mp.match_id
      WHERE m.status = 'active' AND m.tournament_id IS NOT NULL ${playedUserFilter}
      GROUP BY mp.user_id
    `,
  );
  const matchTypeRows = await d1Json(
    options,
    `
      SELECT
        mp.user_id,
        SUM(CASE WHEN m.match_type = 'singles' THEN 1 ELSE 0 END) AS singles_count,
        SUM(CASE WHEN m.match_type = 'doubles' THEN 1 ELSE 0 END) AS doubles_count
      FROM match_players mp
      JOIN matches m ON m.id = mp.match_id
      WHERE m.status = 'active' ${playedUserFilter}
      GROUP BY mp.user_id
    `,
  );

  return {
    users,
    seasonsCreated: mapCountRows(seasonsCreatedRows, "user_id"),
    tournamentsCreated: mapCountRows(tournamentsCreatedRows, "user_id"),
    seasonsPlayed: mapCountRows(seasonsPlayedRows, "user_id"),
    tournamentsPlayed: mapCountRows(tournamentsPlayedRows, "user_id"),
    singlesCount: new Map(matchTypeRows.map((row) => [row.user_id, Number(row.singles_count ?? 0)])),
    doublesCount: new Map(matchTypeRows.map((row) => [row.user_id, Number(row.doubles_count ?? 0)])),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const nowIso = new Date().toISOString();
  const data = await loadData(options);

  if (data.users.length === 0) {
    console.log("No users matched. Nothing to do.");
    return;
  }

  const plan = data.users.map((user) => ({
    userId: user.id,
    achievements: buildAchievementState(user, nowIso, data),
  }));

  const wouldUnlock = plan.reduce(
    (sum, entry) => sum + entry.achievements.filter((achievement) => achievement.unlock).length,
    0,
  );

  console.log(
    `${options.write ? "Applying" : "Dry run for"} achievement backfill on ${plan.length} user(s) in ${
      options.remote ? "remote" : "local"
    } ${options.env} D1${options.remote ? "" : ` (${options.persistTo})`}.`,
  );
  const totalAchievementStates = plan.reduce((sum, entry) => sum + entry.achievements.length, 0);
  console.log(`Calculated ${totalAchievementStates} achievement states, ${wouldUnlock} currently unlocked milestones.`);
  console.log("The backfill is idempotent: it only inserts or advances achievement progress and never deletes data.");

  if (!options.write) {
    console.log("Preview:");
    plan.slice(0, 10).forEach((entry) => {
      const unlocked = entry.achievements.filter((achievement) => achievement.unlock).length;
      console.log(`- ${entry.userId}: ${unlocked}/${entry.achievements.length} unlocked`);
    });
    console.log("Re-run with --write to persist.");
    return;
  }

  for (const entry of plan) {
    await d1Execute(options, buildUserUpsertSql(entry.userId, entry.achievements));
  }

  console.log(`Backfill complete for ${plan.length} user(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
