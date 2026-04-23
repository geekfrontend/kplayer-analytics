import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole, UserRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { orm, nowIsoString } from "@/db/sqlite";
import { sessions, users } from "@/db/schema";

const paramsSchema = z.object({
  id: z.uuid("Format id user tidak valid"),
});

const updateUserSchema = z
  .object({
    name: z.string().trim().min(3, "Nama minimal 3 karakter").optional(),
    email: z
      .email("Email tidak valid")
      .transform((value) => value.toLowerCase())
      .optional(),
    role: z.enum(["admin", "analyst"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal 1 field harus diisi",
  });

type UserRow = {
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

async function parseUserId(paramsPromise: Promise<Record<string, string>>) {
  const parsed = paramsSchema.safeParse(await paramsPromise);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter id tidak valid", parsed.error.issues);
  }
  return parsed.data.id;
}

export const GET = RouteHandler(async (req, ctx) => {
  const currentUser = requireAuth(req);
  requireRole(currentUser, ["admin"]);

  const userId = await parseUserId(ctx.params);
  const user = orm
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      created_at: users.created_at,
      updated_at: users.updated_at,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deleted_at)))
    .limit(1)
    .get() as UserRow | undefined;

  if (!user) {
    throw ApiError.notFound("User tidak ditemukan");
  }

  return ApiResponse.ok("Detail user fetched", { user });
});

export const PATCH = RouteHandler(async (req, ctx) => {
  const currentUser = requireAuth(req);
  requireRole(currentUser, ["admin"]);

  const userId = await parseUserId(ctx.params);
  const payload = await req.json();
  const parsedBody = updateUserSchema.safeParse(payload);
  if (!parsedBody.success) {
    throw ApiError.badRequest(
      "Input update user tidak valid",
      parsedBody.error.issues,
    );
  }

  const existingUser = orm
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deleted_at)))
    .limit(1)
    .get() as { id: string } | undefined;

  if (!existingUser) {
    throw ApiError.notFound("User tidak ditemukan");
  }

  const updates: {
    name?: string;
    email?: string;
    role?: UserRole;
    updated_at: string;
  } = {
    updated_at: nowIsoString(),
  };

  if (parsedBody.data.name) {
    updates.name = parsedBody.data.name;
  }
  if (parsedBody.data.email) {
    updates.email = parsedBody.data.email;
  }
  if (parsedBody.data.role) {
    updates.role = parsedBody.data.role;
  }

  try {
    orm.update(users).set(updates).where(eq(users.id, userId)).run();
  } catch (error) {
    if (getSqliteErrorCode(error) === "SQLITE_CONSTRAINT_UNIQUE") {
      throw ApiError.conflict("Email sudah terdaftar");
    }
    throw error;
  }

  const updatedUser = orm
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      created_at: users.created_at,
      updated_at: users.updated_at,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deleted_at)))
    .limit(1)
    .get() as UserRow;

  return ApiResponse.ok("User berhasil diperbarui", { user: updatedUser });
});

export const DELETE = RouteHandler(async (req, ctx) => {
  const currentUser = requireAuth(req);
  requireRole(currentUser, ["admin"]);

  const userId = await parseUserId(ctx.params);

  const existingUser = orm
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deleted_at)))
    .limit(1)
    .get() as { id: string } | undefined;

  if (!existingUser) {
    throw ApiError.notFound("User tidak ditemukan");
  }

  if (currentUser.id === userId) {
    throw ApiError.badRequest("Admin tidak boleh menghapus akunnya sendiri");
  }

  const now = nowIsoString();
  orm
    .update(users)
    .set({
      deleted_at: now,
      updated_at: now,
    })
    .where(eq(users.id, userId))
    .run();

  orm.delete(sessions).where(eq(sessions.user_id, userId)).run();

  return ApiResponse.ok("User berhasil di-soft-delete");
});
