import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur");
}

const migrationsDir = path.join(process.cwd(), "db", "migrations");
const pool = new Pool({ connectionString: databaseUrl });

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL
    );
  `);

  for (const filename of migrationFiles) {
    const check = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1",
      [filename],
    );

    if (check.rowCount && check.rowCount > 0) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, NOW())",
        [filename],
      );
      await client.query("COMMIT");
      console.log(`[db:migrate] applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("[db:migrate] done");
}

main()
  .catch((error) => {
    console.error("[db:migrate] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
