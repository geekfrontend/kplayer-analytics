import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { leagues, users } from "@/db/schema";

const setActiveLeagueSchema = z.object({
  league_id: z.uuid("Format league_id tidak valid"),
});

export const PATCH = RouteHandler(async (req) => {
  const user = await requireAuth(req);

  const parsed = setActiveLeagueSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input tidak valid", parsed.error.issues);
  }

  const [league] = await orm
    .select({ id: leagues.id, name: leagues.name, country: leagues.country })
    .from(leagues)
    .where(eq(leagues.id, parsed.data.league_id))
    .limit(1);

  if (!league) {
    throw ApiError.notFound("Liga tidak ditemukan");
  }

  await orm
    .update(users)
    .set({ active_league_id: league.id, updated_at: nowIsoString() })
    .where(eq(users.id, user.id));

  return ApiResponse.ok("Liga aktif berhasil diatur", {
    active_league_id: league.id,
    active_league_name: league.name,
    active_league_country: league.country,
  });
});

export const DELETE = RouteHandler(async (req) => {
  const user = await requireAuth(req);

  await orm
    .update(users)
    .set({ active_league_id: null, updated_at: nowIsoString() })
    .where(eq(users.id, user.id));

  return ApiResponse.ok("Liga aktif berhasil dihapus");
});
