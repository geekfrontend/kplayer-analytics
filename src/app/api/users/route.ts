import { randomUUID } from "node:crypto";
import { and, count, desc, eq, isNull, like, or, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import {
  hashPassword,
  requireAuth,
  requireRole,
  UserRole,
} from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { orm, nowIsoString } from "@/db/postgres";
import { users } from "@/db/schema";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  role: z.enum(["admin", "analyst"]).optional(),
});

const createUserSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter"),
  email: z.email("Email tidak valid").transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .regex(/[A-Z]/, "Password wajib mengandung huruf besar")
    .regex(/[a-z]/, "Password wajib mengandung huruf kecil")
    .regex(/[0-9]/, "Password wajib mengandung angka")
    .regex(/[^A-Za-z0-9]/, "Password wajib mengandung simbol"),
  role: z.enum(["admin", "analyst"]),
});

type ListUserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

function getSqliteErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }
  const candidate = error as { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : null;
}

export const GET = RouteHandler(async (req) => {
  const currentUser = await requireAuth(req);
  requireRole(currentUser, ["admin"]);

  const parsedQuery = querySchema.safeParse({
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    q: req.nextUrl.searchParams.get("q") ?? undefined,
    role: req.nextUrl.searchParams.get("role") ?? undefined,
  });

  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const { page, limit, q, role } = parsedQuery.data;
  const offset = (page - 1) * limit;

  const whereConditions: SQL[] = [isNull(users.deleted_at)];
  if (q) {
    whereConditions.push(
      or(like(users.name, `%${q}%`), like(users.email, `%${q}%`)) as SQL,
    );
  }
  if (role) {
    whereConditions.push(eq(users.role, role));
  }

  const whereClause = and(...whereConditions);

  const items = await orm
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      created_at: users.created_at,
      updated_at: users.updated_at,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.created_at))
    .limit(limit)
    .offset(offset)
    .all() as ListUserRow[];

  const countRow = (await orm
    .select({ total: count() })
    .from(users)
    .where(whereClause)
    .get()) as { total: number } | undefined;

  return ApiResponse.ok("Daftar pengguna berhasil diambil", {
    items,
    pagination: {
      page,
      limit,
      total: countRow?.total ?? 0,
      total_pages: Math.max(1, Math.ceil((countRow?.total ?? 0) / limit)),
    },
  });
});

export const POST = RouteHandler(async (req) => {
  const currentUser = await requireAuth(req);
  requireRole(currentUser, ["admin"]);

  const payload = await req.json();
  const parsed = createUserSchema.safeParse(payload);
  if (!parsed.success) {
    throw ApiError.badRequest(
      "Input create user tidak valid",
      parsed.error.issues,
    );
  }

  const now = nowIsoString();
  const userId = randomUUID();
  const passwordHash = hashPassword(parsed.data.password);

  try {
    orm
      .insert(users)
      .values({
        id: userId,
        name: parsed.data.name,
        email: parsed.data.email,
        password_hash: passwordHash,
        role: parsed.data.role,
        created_at: now,
        updated_at: now,
      })
      .run();
  } catch (error) {
    if (getSqliteErrorCode(error) === "SQLITE_CONSTRAINT_UNIQUE") {
      throw ApiError.conflict("Email sudah terdaftar");
    }
    throw error;
  }

  return ApiResponse.created("Pengguna berhasil dibuat", {
    id: userId,
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    created_at: now,
    updated_at: now,
  });
});
