import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { leagues, seasons, users } from "@/db/schema";

const setActiveSeasonSchema = z.object({
  season_id: z.uuid("Format season_id tidak valid"),
});

export const PATCH = RouteHandler(async (req) => {
  const user = await requireAuth(req);

  const parsed = setActiveSeasonSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input tidak valid", parsed.error.issues);
  }

  const [season] = await orm
    .select({
      id: seasons.id,
      name: seasons.name,
      league_id: seasons.league_id,
      league_name: leagues.name,
    })
    .from(seasons)
    .leftJoin(leagues, eq(seasons.league_id, leagues.id))
    .where(eq(seasons.id, parsed.data.season_id))
    .limit(1);

  if (!season) {
    throw ApiError.notFound("Musim tidak ditemukan");
  }

  await orm
    .update(users)
    .set({
      active_season_id: season.id,
      updated_at: nowIsoString(),
    })
    .where(eq(users.id, user.id));

  return ApiResponse.ok("Musim aktif berhasil diatur", {
    active_season_id: season.id,
    active_season_name: season.name,
    active_league_id: season.league_id,
    active_league_name: season.league_name,
  });
});
