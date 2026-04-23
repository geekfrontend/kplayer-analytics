import path from "node:path";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const dbPath = path.join(process.cwd(), "data", "kplayer.sqlite");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@kplayer.local";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Password123!";
const adminName = process.env.SEED_ADMIN_NAME || "KPlayer Admin";

const existingUser = db
  .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
  .get(adminEmail);

if (existingUser) {
  console.log("[db:seed] admin already exists");
  process.exit(0);
}

const passwordHash = bcrypt.hashSync(adminPassword, 10);
const now = new Date().toISOString();

db.prepare(
  `
  INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
  VALUES (?, ?, ?, ?, 'admin', ?, ?)
`,
).run(randomUUID(), adminName, adminEmail, passwordHash, now, now);

console.log("[db:seed] admin created");

