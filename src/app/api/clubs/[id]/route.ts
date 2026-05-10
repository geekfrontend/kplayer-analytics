import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { clubs } from "@/db/schema";

const paramsSchema = z.object({
  id: z.uuid("Format id club tidak valid"),
});

const updateClubSchema = z
  .object({
    name: z.string().trim().min(2, "Nama klub minimal 2 karakter").optional(),
    country: z.string().trim().min(2, "Negara minimal 2 karakter").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal 1 field harus diisi",
  });

function getSqliteErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }
  const candidate = error as { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : null;
}

async function parseClubId(params: Promise<Record<string, string>>) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter id tidak valid", parsed.error.issues);
  }
  return parsed.data.id;
}

export const GET = RouteHandler(async (req, ctx) => {
  await requireAuth(req);
  const clubId = await parseClubId(ctx.params);

  const club = await orm
    .select({
      id: clubs.id,
      name: clubs.name,
      country: clubs.country,
      created_at: clubs.created_at,
      updated_at: clubs.updated_at,
    })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)
    .get();

  if (!club) {
    throw ApiError.notFound("Klub tidak ditemukan");
  }

  return ApiResponse.ok("Detail klub berhasil diambil", { club });
});

export const PATCH = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);
  const clubId = await parseClubId(ctx.params);

  const parsed = updateClubSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input club tidak valid", parsed.error.issues);
  }

  const existing = await orm
    .select({ id: clubs.id })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)
    .get() as { id: string } | undefined;
  if (!existing) {
    throw ApiError.notFound("Klub tidak ditemukan");
  }

  const updates: {
    name?: string;
    country?: string;
    updated_at: string;
  } = {
    updated_at: nowIsoString(),
  };

  if (parsed.data.name) {
    updates.name = parsed.data.name;
  }
  if (parsed.data.country) {
    updates.country = parsed.data.country;
  }

  try {
    await orm.update(clubs).set(updates).where(eq(clubs.id, clubId)).run();
  } catch (error) {
    if (getSqliteErrorCode(error) === "SQLITE_CONSTRAINT_UNIQUE") {
      throw ApiError.conflict("Klub sudah terdaftar");
    }
    throw error;
  }

  const club = await orm
    .select({
      id: clubs.id,
      name: clubs.name,
      country: clubs.country,
      created_at: clubs.created_at,
      updated_at: clubs.updated_at,
    })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)
    .get();

  return ApiResponse.ok("Klub berhasil diperbarui", { club });
});

export const DELETE = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);
  const clubId = await parseClubId(ctx.params);

  const result = await orm.delete(clubs).where(eq(clubs.id, clubId)).run();
  if (result.changes < 1) {
    throw ApiError.notFound("Klub tidak ditemukan");
  }

  return ApiResponse.ok("Klub berhasil dihapus");
});
