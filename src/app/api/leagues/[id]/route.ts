import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { getDbErrorCode, PG_UNIQUE_VIOLATION } from "@/app/api/utils/db-error";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { leagues } from "@/db/schema";

const paramsSchema = z.object({
  id: z.uuid("Format id liga tidak valid"),
});

const updateLeagueSchema = z
  .object({
    name: z.string().trim().min(2, "Nama liga minimal 2 karakter").optional(),
    country: z.string().trim().min(2, "Negara minimal 2 karakter").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal 1 field harus diisi",
  });

async function parseLeagueId(params: Promise<Record<string, string>>) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter id tidak valid", parsed.error.issues);
  }
  return parsed.data.id;
}

const activeLeague = (id: string) =>
  and(eq(leagues.id, id), isNull(leagues.deleted_at));

export const GET = RouteHandler(async (req, ctx) => {
  await requireAuth(req);
  const leagueId = await parseLeagueId(ctx.params);

  const [league] = await orm
    .select({
      id: leagues.id,
      name: leagues.name,
      country: leagues.country,
      created_at: leagues.created_at,
      updated_at: leagues.updated_at,
    })
    .from(leagues)
    .where(activeLeague(leagueId))
    .limit(1);

  if (!league) {
    throw ApiError.notFound("Liga tidak ditemukan");
  }

  return ApiResponse.ok("Detail liga berhasil diambil", { league });
});

export const PATCH = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);
  const leagueId = await parseLeagueId(ctx.params);

  const parsed = updateLeagueSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input liga tidak valid", parsed.error.issues);
  }

  const [existing] = await orm
    .select({ id: leagues.id })
    .from(leagues)
    .where(activeLeague(leagueId))
    .limit(1);

  if (!existing) {
    throw ApiError.notFound("Liga tidak ditemukan");
  }

  const updates: { name?: string; country?: string; updated_at: string } = {
    updated_at: nowIsoString(),
  };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.country) updates.country = parsed.data.country;

  try {
    await orm.update(leagues).set(updates).where(activeLeague(leagueId));
  } catch (error) {
    if (getDbErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw ApiError.conflict("Liga sudah terdaftar");
    }
    throw error;
  }

  const [league] = await orm
    .select({
      id: leagues.id,
      name: leagues.name,
      country: leagues.country,
      created_at: leagues.created_at,
      updated_at: leagues.updated_at,
    })
    .from(leagues)
    .where(activeLeague(leagueId))
    .limit(1);

  return ApiResponse.ok("Liga berhasil diperbarui", { league });
});

export const DELETE = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);
  const leagueId = await parseLeagueId(ctx.params);

  const [existing] = await orm
    .select({ id: leagues.id })
    .from(leagues)
    .where(activeLeague(leagueId))
    .limit(1);

  if (!existing) {
    throw ApiError.notFound("Liga tidak ditemukan");
  }

  const now = nowIsoString();
  await orm
    .update(leagues)
    .set({ deleted_at: now, updated_at: now })
    .where(eq(leagues.id, leagueId));

  return ApiResponse.ok("Liga berhasil dihapus");
});
