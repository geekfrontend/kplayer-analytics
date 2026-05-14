import "dotenv/config";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur");
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

export const orm: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export const db = pool;

export async function closePool() {
  await pool.end();
}

export function nowIsoString() {
  return new Date().toISOString();
}
