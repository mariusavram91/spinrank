import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface MigrationFile {
  fileName: string;
  sql: string;
}

const defaultMigrationsDir = resolve(process.cwd(), "worker/migrations");

export const listMigrationFiles = async (
  migrationsDir = defaultMigrationsDir,
): Promise<MigrationFile[]> => {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    fileNames.map(async (fileName) => ({
      fileName,
      sql: await readFile(resolve(migrationsDir, fileName), "utf8"),
    })),
  );
};

export const applyMigrations = async (
  executeSql: (sql: string, fileName: string) => Promise<void>,
  migrationsDir = defaultMigrationsDir,
): Promise<void> => {
  const files = await listMigrationFiles(migrationsDir);
  for (const file of files) {
    await executeSql(file.sql, file.fileName);
  }
};
