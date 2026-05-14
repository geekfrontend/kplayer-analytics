import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { orm } from "@/db/postgres";
import { player_stats, players, seasons } from "@/db/schema";

const querySchema = z.object({
  season_id: z.uuid("Format season_id tidak valid"),
  club_id: z.uuid("Format club_id tidak valid").optional(),
});

export const GET = RouteHandler(async (req) => {
  await requireAuth(req);

  const parsedQuery = querySchema.safeParse({
    season_id: req.nextUrl.searchParams.get("season_id") ?? undefined,
    club_id: req.nextUrl.searchParams.get("club_id") ?? undefined,
  });

  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const { season_id, club_id } = parsedQuery.data;

  const [season] = await orm
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.id, season_id))
    .limit(1);

  if (!season) {
    throw ApiError.notFound("Musim tidak ditemukan");
  }

  // Base filter: season + optional club
  const baseFilter = club_id
    ? sql`${player_stats.season_id} = ${season_id} AND ${player_stats.club_id} = ${club_id}`
    : sql`${player_stats.season_id} = ${season_id}`;

  const [totalPlayersResult] = await orm
    .select({ total: sql<number>`COUNT(DISTINCT ${player_stats.player_id})` })
    .from(player_stats)
    .where(baseFilter);

  const topScorer = await orm
    .select({
      player_id: player_stats.player_id,
      full_name: players.full_name,
      goals: sql<number>`CAST(SUM(${player_stats.goals}) AS INTEGER)`,
    })
    .from(player_stats)
    .innerJoin(players, eq(player_stats.player_id, players.id))
    .where(baseFilter)
    .groupBy(player_stats.player_id, players.full_name)
    .orderBy(desc(sql`SUM(${player_stats.goals})`), asc(players.full_name))
    .limit(1);

  const topAssist = await orm
    .select({
      player_id: player_stats.player_id,
      full_name: players.full_name,
      assists: sql<number>`CAST(SUM(${player_stats.assists}) AS INTEGER)`,
    })
    .from(player_stats)
    .innerJoin(players, eq(player_stats.player_id, players.id))
    .where(baseFilter)
    .groupBy(player_stats.player_id, players.full_name)
    .orderBy(desc(sql`SUM(${player_stats.assists})`), asc(players.full_name))
    .limit(1);

  return ApiResponse.ok("Ringkasan dasbor berhasil diambil", {
    season_id,
    club_id: club_id ?? null,
    total_players: totalPlayersResult?.total ?? 0,
    top_scorer: topScorer,
    top_assist: topAssist,
  });
});
