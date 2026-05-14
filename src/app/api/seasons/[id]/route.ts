import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { getDbErrorCode, PG_UNIQUE_VIOLATION } from "@/app/api/utils/db-error";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { seasons } from "@/db/schema";

const paramsSchema = z.object({
  id: z.uuid("Format id season tidak valid"),
});

const updateSeasonSchema = z
  .object({
    name: z
      .string()
      .regex(/^\d{4}\/\d{4}$/, "Format season harus YYYY/YYYY")
      .optional(),
    start_date: z.iso.date("Format start_date harus YYYY-MM-DD").optional(),
    end_date: z.iso.date("Format end_date harus YYYY-MM-DD").optional(),
    is_active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal 1 field harus diisi",
  })
  .refine(
    (data) =>
      !data.name ||
      Number(data.name.split("/")[1]) === Number(data.name.split("/")[0]) + 1,
    { message: "Tahun season tidak valid", path: ["name"] },
  )
  .refine(
    (data) =>
      !data.start_date || !data.end_date || data.start_date < data.end_date,
    {
      message: "start_date harus lebih kecil dari end_date",
      path: ["end_date"],
    },
  );

async function parseSeasonId(params: Promise<Record<string, string>>) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter id tidak valid", parsed.error.issues);
  }
  return parsed.data.id;
}

export const GET = RouteHandler(async (req, ctx) => {
  await requireAuth(req);
  const seasonId = await parseSeasonId(ctx.params);

  const [season] = await orm
    .select({
      id: seasons.id,
      name: seasons.name,
      start_date: seasons.start_date,
      end_date: seasons.end_date,
      is_active: seasons.is_active,
      created_at: seasons.created_at,
      updated_at: seasons.updated_at,
    })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);

  if (!season) {
    throw ApiError.notFound("Musim tidak ditemukan");
  }

  return ApiResponse.ok("Detail musim berhasil diambil", { season });
});

export const PATCH = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);
  const seasonId = await parseSeasonId(ctx.params);

  const parsed = updateSeasonSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input season tidak valid", parsed.error.issues);
  }

  const [existing] = await orm
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);

  if (!existing) {
    throw ApiError.notFound("Musim tidak ditemukan");
  }

  const updates: {
    name?: string;
    start_date?: string;
    end_date?: string;
    is_active?: number;
    updated_at: string;
  } = {
    updated_at: nowIsoString(),
  };

  if (parsed.data.name) {
    updates.name = parsed.data.name;
  }
  if (parsed.data.start_date) {
    updates.start_date = parsed.data.start_date;
  }
  if (parsed.data.end_date) {
    updates.end_date = parsed.data.end_date;
  }
  if (typeof parsed.data.is_active === "boolean") {
    updates.is_active = parsed.data.is_active ? 1 : 0;
  }

  try {
    await orm.update(seasons).set(updates).where(eq(seasons.id, seasonId));
  } catch (error) {
    if (getDbErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw ApiError.conflict("Musim sudah terdaftar");
    }
    throw error;
  }

  const [season] = await orm
    .select({
      id: seasons.id,
      name: seasons.name,
      start_date: seasons.start_date,
      end_date: seasons.end_date,
      is_active: seasons.is_active,
      created_at: seasons.created_at,
      updated_at: seasons.updated_at,
    })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);

  return ApiResponse.ok("Musim berhasil diperbarui", { season });
});

export const DELETE = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);
  const seasonId = await parseSeasonId(ctx.params);

  const result = await orm.delete(seasons).where(eq(seasons.id, seasonId));
  if ((result.rowCount ?? 0) < 1) {
    throw ApiError.notFound("Musim tidak ditemukan");
  }

  return ApiResponse.ok("Musim berhasil dihapus");
});
