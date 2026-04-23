import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "kplayer.sqlite");
const migrationsDir = path.join(process.cwd(), "db", "migrations");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  );
`);

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

const hasMigrationStmt = db.prepare(
  "SELECT 1 FROM schema_migrations WHERE filename = ? LIMIT 1",
);
const insertMigrationStmt = db.prepare(
  "INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)",
);

for (const filename of migrationFiles) {
  const alreadyApplied = hasMigrationStmt.get(filename);
  if (alreadyApplied) {
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
  const tx = db.transaction(() => {
    db.exec(sql);
    insertMigrationStmt.run(filename, new Date().toISOString());
  });
  tx();
  console.log(`[db:migrate] applied ${filename}`);
}

console.log("[db:migrate] done");

