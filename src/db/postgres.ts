import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur");
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const orm: any = drizzle(pool, { schema });
export const db = pool;

function installQueryCompatMethods() {
  const selectProto = Object.getPrototypeOf(
    orm.select().from(schema.users).limit(1),
  );
  const insertProto = Object.getPrototypeOf(
    orm.insert(schema.users).values({
      id: "__compat__",
      name: "__compat__",
      email: "__compat__@example.com",
      password_hash: "__compat__",
      role: "admin",
      created_at: "__compat__",
      updated_at: "__compat__",
      deleted_at: null,
    }),
  );
  const updateProto = Object.getPrototypeOf(
    orm.update(schema.users).set({ updated_at: "__compat__" }),
  );
  const deleteProto = Object.getPrototypeOf(orm.delete(schema.users));

  const prototypes = [selectProto, insertProto, updateProto, deleteProto];

  for (const proto of prototypes) {
    if (
      !proto ||
      (proto as { __drizzleCompatInstalled?: boolean }).__drizzleCompatInstalled
    ) {
      continue;
    }

    if (typeof (proto as { all?: unknown }).all !== "function") {
      Object.defineProperty(proto, "all", {
        value: async function all<T>() {
          const result = (await this) as T[] | unknown;
          return Array.isArray(result) ? result : [];
        },
      });
    }

    if (typeof (proto as { get?: unknown }).get !== "function") {
      Object.defineProperty(proto, "get", {
        value: async function get<T>() {
          const result = await this;
          if (Array.isArray(result)) {
            return result[0] as T | undefined;
          }
          return result as T | undefined;
        },
      });
    }

    if (typeof (proto as { run?: unknown }).run !== "function") {
      Object.defineProperty(proto, "run", {
        value: async function run() {
          const result = (await this) as unknown;
          const candidate = result as { rowCount?: unknown } | null;
          if (
            candidate &&
            typeof candidate === "object" &&
            typeof candidate.rowCount === "number"
          ) {
            return { changes: candidate.rowCount };
          }

          if (Array.isArray(result)) {
            return { changes: result.length };
          }

          return { changes: 0 };
        },
      });
    }

    Object.defineProperty(proto, "__drizzleCompatInstalled", {
      value: true,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }
}

installQueryCompatMethods();

export async function closePool() {
  await pool.end();
}

export function nowIsoString() {
  return new Date().toISOString();
}
