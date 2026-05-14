import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { players } from "@/db/schema";

const paramsSchema = z.object({
  id: z.uuid("Format id player tidak valid"),
});

const updatePlayerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(3, "Nama pemain minimal 3 karakter")
      .optional(),
    date_of_birth: z.iso
      .date("Format date_of_birth harus YYYY-MM-DD")
      .optional(),
    nationality: z
      .string()
      .trim()
      .min(2, "Nationality minimal 2 karakter")
      .optional(),
    primary_position: z
      .string()
      .trim()
      .min(2, "Posisi minimal 2 karakter")
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal 1 field harus diisi",
  });

function validateDateOfBirth(dateOfBirth: string) {
  if (new Date(dateOfBirth).getTime() > Date.now()) {
    throw ApiError.badRequest("date_of_birth tidak boleh tanggal masa depan");
  }
}

async function parsePlayerId(params: Promise<Record<string, string>>) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter id tidak valid", parsed.error.issues);
  }
  return parsed.data.id;
}

export const GET = RouteHandler(async (req, ctx) => {
  await requireAuth(req);
  const playerId = await parsePlayerId(ctx.params);

  const [player] = await orm
    .select({
      id: players.id,
      full_name: players.full_name,
      date_of_birth: players.date_of_birth,
      nationality: players.nationality,
      primary_position: players.primary_position,
      created_at: players.created_at,
      updated_at: players.updated_at,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    throw ApiError.notFound("Pemain tidak ditemukan");
  }

  return ApiResponse.ok("Detail pemain berhasil diambil", { player });
});

export const PATCH = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);
  const playerId = await parsePlayerId(ctx.params);

  const parsed = updatePlayerSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input player tidak valid", parsed.error.issues);
  }

  if (parsed.data.date_of_birth) {
    validateDateOfBirth(parsed.data.date_of_birth);
  }

  const [existing] = await orm
    .select({ id: players.id })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!existing) {
    throw ApiError.notFound("Pemain tidak ditemukan");
  }

  const updates: {
    full_name?: string;
    date_of_birth?: string;
    nationality?: string;
    primary_position?: string;
    updated_at: string;
  } = {
    updated_at: nowIsoString(),
  };

  if (parsed.data.full_name) {
    updates.full_name = parsed.data.full_name;
  }
  if (parsed.data.date_of_birth) {
    updates.date_of_birth = parsed.data.date_of_birth;
  }
  if (parsed.data.nationality) {
    updates.nationality = parsed.data.nationality;
  }
  if (parsed.data.primary_position) {
    updates.primary_position = parsed.data.primary_position;
  }

  await orm.update(players).set(updates).where(eq(players.id, playerId));

  const [player] = await orm
    .select({
      id: players.id,
      full_name: players.full_name,
      date_of_birth: players.date_of_birth,
      nationality: players.nationality,
      primary_position: players.primary_position,
      created_at: players.created_at,
      updated_at: players.updated_at,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  return ApiResponse.ok("Pemain berhasil diperbarui", { player });
});

export const DELETE = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);
  const playerId = await parsePlayerId(ctx.params);

  const result = await orm.delete(players).where(eq(players.id, playerId));
  if ((result.rowCount ?? 0) < 1) {
    throw ApiError.notFound("Pemain tidak ditemukan");
  }

  return ApiResponse.ok("Pemain berhasil dihapus");
});
