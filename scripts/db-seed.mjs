import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur");
}

const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@kplayer.local";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Password123!";
const adminName = process.env.SEED_ADMIN_NAME || "KPlayer Admin";

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  const existingUser = await pool.query(
    "SELECT id FROM users WHERE email = $1 LIMIT 1",
    [adminEmail],
  );

  if (existingUser.rowCount && existingUser.rowCount > 0) {
    console.log("[db:seed] admin already exists");
    return;
  }

  const passwordHash = bcrypt.hashSync(adminPassword, 10);

  await pool.query(
    `
      INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'admin', NOW()::text, NOW()::text)
    `,
    [randomUUID(), adminName, adminEmail, passwordHash],
  );

  console.log("[db:seed] admin created");
}

main()
  .catch((error) => {
    console.error("[db:seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
