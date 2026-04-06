import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const WORKER_DIR = fileURLToPath(new URL("..", import.meta.url));

const ACHIEVEMENTS = [
  { key: "account_created", category: "onboarding", tier: "bronze", points: 10, sortOrder: 10 },
  { key: "first_match", category: "onboarding", tier: "bronze", points: 20, sortOrder: 20 },
  { key: "first_win", category: "performance", tier: "bronze", points: 30, sortOrder: 30 },
  { key: "first_singles", category: "activity", tier: "bronze", points: 25, sortOrder: 32 },
  { key: "singles_10", category: "activity", tier: "silver", points: 70, sortOrder: 33 },
  { key: "first_doubles", category: "activity", tier: "bronze", points: 25, sortOrder: 34 },
  { key: "doubles_10", category: "activity", tier: "silver", points: 70, sortOrder: 34 },
  { key: "matches_3", category: "activity", tier: "bronze", points: 25, sortOrder: 35 },
  { key: "matches_5", category: "activity", tier: "bronze", points: 35, sortOrder: 37 },
  { key: "matches_10", category: "activity", tier: "silver", points: 50, sortOrder: 40 },
  { key: "matches_25", category: "activity", tier: "gold", points: 100, sortOrder: 50 },
  { key: "matches_50", category: "activity", tier: "gold", points: 150, sortOrder: 55 },
  { key: "matches_100", category: "activity", tier: "platinum", points: 260, sortOrder: 57 },
  { key: "win_streak_3", category: "performance", tier: "silver", points: 60, sortOrder: 60 },
  { key: "win_streak_5", category: "performance", tier: "gold", points: 120, sortOrder: 70 },
  { key: "rank_top_3", category: "performance", tier: "gold", points: 120, sortOrder: 80 },
  { key: "rank_1", category: "performance", tier: "platinum", points: 200, sortOrder: 90 },
  { key: "season_creator", category: "community", tier: "silver", points: 70, sortOrder: 100 },
  { key: "seasons_3", category: "community", tier: "silver", points: 110, sortOrder: 105 },
  { key: "seasons_5", category: "community", tier: "gold", points: 180, sortOrder: 107 },
  { key: "season_played", category: "community", tier: "bronze", points: 30, sortOrder: 108 },
  { key: "seasons_played_3", category: "community", tier: "silver", points: 75, sortOrder: 109 },
  { key: "seasons_played_5", category: "community", tier: "gold", points: 140, sortOrder: 110 },
  { key: "tournament_creator", category: "community", tier: "silver", points: 80, sortOrder: 120 },
  { key: "tournaments_3", category: "community", tier: "silver", points: 120, sortOrder: 125 },
  { key: "tournaments_5", category: "community", tier: "gold", points: 190, sortOrder: 127 },
  { key: "tournament_played", category: "community", tier: "bronze", points: 35, sortOrder: 128 },
  { key: "tournaments_played_3", category: "community", tier: "silver", points: 85, sortOrder: 129 },
  { key: "tournaments_played_5", category: "community", tier: "gold", points: 150, sortOrder: 130 },
  { key: "elo_1250", category: "performance", tier: "bronze", points: 40, sortOrder: 140 },
  { key: "elo_1350", category: "performance", tier: "silver", points: 90, sortOrder: 141 },
  { key: "elo_1500", category: "performance", tier: "gold", points: 170, sortOrder: 142 },
  { key: "elo_1700", category: "performance", tier: "platinum", points: 300, sortOrder: 143 },
  { key: "days_30", category: "onboarding", tier: "bronze", points: 30, sortOrder: 150 },
  { key: "days_180", category: "community", tier: "silver", points: 90, sortOrder: 151 },
  { key: "days_365", category: "community", tier: "gold", points: 180, sortOrder: 152 },
];

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

function daysBetween(fromIso, toIso) {
  return Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / (1000 * 60 * 60 * 24)));
}

function addThresholdAchievement(items, key, currentValue, target, nowIso, context = null) {
  items.push({
    key,
    progressValue: Math.min(currentValue, target),
    progressTarget: target,
    unlock: currentValue >= target,
    context: currentValue >= target ? context : {},
    nowIso,
  });
}

function buildAchievementState(user, nowIso, maps) {
  const achievements = [];
  const matchesPlayed = Number(user.matches_played ?? 0);
  const wins = Number(user.wins ?? 0);
  const streak = Number(user.streak ?? 0);
  const rank = Number(user.rank ?? 0);
  const elo = Number(user.global_elo ?? 1200);
  const seasonsCreated = maps.seasonsCreated.get(user.id) ?? 0;
  const tournamentsCreated = maps.tournamentsCreated.get(user.id) ?? 0;
  const seasonsPlayed = maps.seasonsPlayed.get(user.id) ?? 0;
  const tournamentsPlayed = maps.tournamentsPlayed.get(user.id) ?? 0;
  const singlesCount = maps.singlesCount.get(user.id) ?? 0;
  const doublesCount = maps.doublesCount.get(user.id) ?? 0;
  const elapsedDays = daysBetween(user.created_at, nowIso);

  addThresholdAchievement(achievements, "account_created", 1, 1, nowIso);
  for (const target of [1, 3, 5, 10, 25, 50, 100]) {
    addThresholdAchievement(achievements, target === 1 ? "first_match" : `matches_${target}`, matchesPlayed, target, nowIso);
  }
  addThresholdAchievement(achievements, "first_win", wins, 1, nowIso);
  addThresholdAchievement(achievements, "first_singles", singlesCount, 1, nowIso);
  addThresholdAchievement(achievements, "singles_10", singlesCount, 10, nowIso);
  addThresholdAchievement(achievements, "first_doubles", doublesCount, 1, nowIso);
  addThresholdAchievement(achievements, "doubles_10", doublesCount, 10, nowIso);
  addThresholdAchievement(achievements, "win_streak_3", Math.max(streak, 0), 3, nowIso, { streak });
  addThresholdAchievement(achievements, "win_streak_5", Math.max(streak, 0), 5, nowIso, { streak });
  addThresholdAchievement(achievements, "rank_top_3", rank <= 3 ? 3 : 0, 3, nowIso, { rank });
  addThresholdAchievement(achievements, "rank_1", rank === 1 ? 1 : 0, 1, nowIso, { rank });
  addThresholdAchievement(achievements, "season_creator", seasonsCreated, 1, nowIso);
  addThresholdAchievement(achievements, "seasons_3", seasonsCreated, 3, nowIso);
  addThresholdAchievement(achievements, "seasons_5", seasonsCreated, 5, nowIso);
  addThresholdAchievement(achievements, "season_played", seasonsPlayed, 1, nowIso);
  addThresholdAchievement(achievements, "seasons_played_3", seasonsPlayed, 3, nowIso);
  addThresholdAchievement(achievements, "seasons_played_5", seasonsPlayed, 5, nowIso);
  addThresholdAchievement(achievements, "tournament_creator", tournamentsCreated, 1, nowIso);
  addThresholdAchievement(achievements, "tournaments_3", tournamentsCreated, 3, nowIso);
  addThresholdAchievement(achievements, "tournaments_5", tournamentsCreated, 5, nowIso);
  addThresholdAchievement(achievements, "tournament_played", tournamentsPlayed, 1, nowIso);
  addThresholdAchievement(achievements, "tournaments_played_3", tournamentsPlayed, 3, nowIso);
  addThresholdAchievement(achievements, "tournaments_played_5", tournamentsPlayed, 5, nowIso);
  addThresholdAchievement(achievements, "elo_1250", elo, 1250, nowIso, { elo });
  addThresholdAchievement(achievements, "elo_1350", elo, 1350, nowIso, { elo });
  addThresholdAchievement(achievements, "elo_1500", elo, 1500, nowIso, { elo });
  addThresholdAchievement(achievements, "elo_1700", elo, 1700, nowIso, { elo });
  addThresholdAchievement(achievements, "days_30", elapsedDays, 30, nowIso);
  addThresholdAchievement(achievements, "days_180", elapsedDays, 180, nowIso);
  addThresholdAchievement(achievements, "days_365", elapsedDays, 365, nowIso);

  return achievements;
}

function buildDefinitionSql() {
  return [
    "BEGIN TRANSACTION;",
    ...ACHIEVEMENTS.map(
      (achievement) => `
        INSERT INTO achievement_definitions (key, category, tier, points, sort_order, active)
        VALUES (${sqlString(achievement.key)}, ${sqlString(achievement.category)}, ${sqlString(achievement.tier)}, ${achievement.points}, ${achievement.sortOrder}, 1)
        ON CONFLICT(key) DO UPDATE SET
          category = excluded.category,
          tier = excluded.tier,
          points = excluded.points,
          sort_order = excluded.sort_order,
          active = 1;
      `,
    ),
    "COMMIT;",
  ].join("\n");
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
  console.log(`Calculated ${plan.length * ACHIEVEMENTS.length} achievement states, ${wouldUnlock} currently unlocked milestones.`);
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

  await d1Execute(options, buildDefinitionSql());
  for (const entry of plan) {
    await d1Execute(options, buildUserUpsertSql(entry.userId, entry.achievements));
  }

  console.log(`Backfill complete for ${plan.length} user(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
