import { and, asc, count, desc, eq, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { orm } from "@/db/postgres";
import { clubs, player_stats, players, seasons } from "@/db/schema";

const querySchema = z.object({
  season_id: z.uuid("Format season_id tidak valid").optional(),
  club_id: z.uuid("Format club_id tidak valid").optional(),
  player_id: z.uuid("Format player_id tidak valid").optional(),
  sort_by: z
    .enum(["updated_at", "goals", "assists", "minutes_played"])
    .default("updated_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = RouteHandler(async (req) => {
  await requireAuth(req);

  const parsedQuery = querySchema.safeParse({
    season_id: req.nextUrl.searchParams.get("season_id") ?? undefined,
    club_id: req.nextUrl.searchParams.get("club_id") ?? undefined,
    player_id: req.nextUrl.searchParams.get("player_id") ?? undefined,
    sort_by: req.nextUrl.searchParams.get("sort_by") ?? undefined,
    sort_order: req.nextUrl.searchParams.get("sort_order") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const { season_id, club_id, player_id, sort_by, sort_order, page, limit } =
    parsedQuery.data;
  const offset = (page - 1) * limit;

  const whereConditions: SQL[] = [];
  if (season_id) {
    whereConditions.push(eq(player_stats.season_id, season_id));
  }
  if (club_id) {
    whereConditions.push(eq(player_stats.club_id, club_id));
  }
  if (player_id) {
    whereConditions.push(eq(player_stats.player_id, player_id));
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const sortColumns = {
    updated_at: player_stats.updated_at,
    goals: player_stats.goals,
    assists: player_stats.assists,
    minutes_played: player_stats.minutes_played,
  } as const;

  const orderByColumn = sortColumns[sort_by];
  const orderByExpr = sort_order === "asc" ? asc(orderByColumn) : desc(orderByColumn);

  const items = await orm
    .select({
      id: player_stats.id,
      player_id: player_stats.player_id,
      player_name: players.full_name,
      season_id: player_stats.season_id,
      season_name: seasons.name,
      club_id: player_stats.club_id,
      club_name: clubs.name,
      minutes_played: player_stats.minutes_played,
      goals: player_stats.goals,
      assists: player_stats.assists,
      shots: player_stats.shots,
      created_at: player_stats.created_at,
      updated_at: player_stats.updated_at,
      created_by: player_stats.created_by,
      updated_by: player_stats.updated_by,
    })
    .from(player_stats)
    .innerJoin(players, eq(player_stats.player_id, players.id))
    .innerJoin(seasons, eq(player_stats.season_id, seasons.id))
    .innerJoin(clubs, eq(player_stats.club_id, clubs.id))
    .where(whereClause)
    .orderBy(orderByExpr)
    .limit(limit)
    .offset(offset);

  const [countResult] = await orm
    .select({ total: count() })
    .from(player_stats)
    .where(whereClause);

  return ApiResponse.ok("Statistik berhasil diambil", {
    items,
    pagination: {
      page,
      limit,
      total: countResult?.total ?? 0,
      total_pages: Math.max(1, Math.ceil((countResult?.total ?? 0) / limit)),
    },
  });
});
