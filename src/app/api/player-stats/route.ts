import { randomUUID } from "node:crypto";
import { and, count, desc, eq, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { getDbErrorCode, PG_UNIQUE_VIOLATION } from "@/app/api/utils/db-error";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import {
  clubs,
  player_club_history,
  player_stats,
  players,
  season_clubs,
  seasons,
} from "@/db/schema";

const querySchema = z.object({
  player_id: z.uuid("Format player_id tidak valid").optional(),
  season_id: z.uuid("Format season_id tidak valid").optional(),
  club_id: z.uuid("Format club_id tidak valid").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z
  .object({
    player_id: z.uuid("Format player_id tidak valid"),
    season_id: z.uuid("Format season_id tidak valid"),
    club_id: z.uuid("Format club_id tidak valid"),
    goals: z.coerce.number().int().min(0),
    assists: z.coerce.number().int().min(0),
    shots: z.coerce.number().int().min(0),
  })
  .refine((data) => data.shots >= data.goals, {
    message: "shots tidak boleh lebih kecil dari goals",
    path: ["shots"],
  });

function validateStatsDomain(goals: number, shots: number) {
  if (shots < goals) {
    throw ApiError.badRequest("shots tidak boleh lebih kecil dari goals");
  }
}

async function validateMasterReferences(
  playerId: string,
  seasonId: string,
  clubId: string,
) {
  const [player] = await orm
    .select({ id: players.id })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!player) {
    throw ApiError.badRequest("Pemain tidak ditemukan");
  }

  const [season] = await orm
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);
  if (!season) {
    throw ApiError.badRequest("Musim tidak ditemukan");
  }

  const [club] = await orm
    .select({ id: clubs.id })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1);
  if (!club) {
    throw ApiError.badRequest("Klub tidak ditemukan");
  }

  const [seasonClub] = await orm
    .select({ id: season_clubs.id })
    .from(season_clubs)
    .where(
      and(
        eq(season_clubs.season_id, seasonId),
        eq(season_clubs.club_id, clubId),
      ),
    )
    .limit(1);
  if (!seasonClub) {
    throw ApiError.badRequest(
      "Klub belum terdaftar pada musim terkait di relasi musim-klub",
    );
  }
}

async function validateAssignment(playerId: string, seasonId: string, clubId: string) {
  const [assignment] = await orm
    .select({ id: player_club_history.id })
    .from(player_club_history)
    .where(
      and(
        eq(player_club_history.player_id, playerId),
        eq(player_club_history.season_id, seasonId),
        eq(player_club_history.club_id, clubId),
      ),
    )
    .limit(1);

  if (!assignment) {
    throw ApiError.badRequest(
      "Statistik hanya bisa dibuat jika penugasan pemain-musim-klub valid",
    );
  }
}

export const GET = RouteHandler(async (req) => {
  await requireAuth(req);

  const parsedQuery = querySchema.safeParse({
    player_id: req.nextUrl.searchParams.get("player_id") ?? undefined,
    season_id: req.nextUrl.searchParams.get("season_id") ?? undefined,
    club_id: req.nextUrl.searchParams.get("club_id") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const { player_id, season_id, club_id, page, limit } = parsedQuery.data;
  const offset = (page - 1) * limit;

  const whereConditions: SQL[] = [];
  if (player_id) {
    whereConditions.push(eq(player_stats.player_id, player_id));
  }
  if (season_id) {
    whereConditions.push(eq(player_stats.season_id, season_id));
  }
  if (club_id) {
    whereConditions.push(eq(player_stats.club_id, club_id));
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

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
    .orderBy(desc(player_stats.updated_at))
    .limit(limit)
    .offset(offset);

  const [countResult] = await orm
    .select({ total: count() })
    .from(player_stats)
    .where(whereClause);

  return ApiResponse.ok("Statistik pemain berhasil diambil", {
    items,
    pagination: {
      page,
      limit,
      total: countResult?.total ?? 0,
      total_pages: Math.max(1, Math.ceil((countResult?.total ?? 0) / limit)),
    },
  });
});

export const POST = RouteHandler(async (req) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input statistik tidak valid", parsed.error.issues);
  }

  const payload = parsed.data;
  validateStatsDomain(payload.goals, payload.shots);
  await validateMasterReferences(
    payload.player_id,
    payload.season_id,
    payload.club_id,
  );
  await validateAssignment(payload.player_id, payload.season_id, payload.club_id);

  const id = randomUUID();
  const now = nowIsoString();

  try {
    await orm
      .insert(player_stats)
      .values({
        id,
        player_id: payload.player_id,
        season_id: payload.season_id,
        club_id: payload.club_id,
        minutes_played: 90,
        goals: payload.goals,
        assists: payload.assists,
        shots: payload.shots,
        created_at: now,
        updated_at: now,
        created_by: user.id,
        updated_by: user.id,
      });
  } catch (error) {
    if (getDbErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw ApiError.conflict("Statistik pemain untuk cakupan tersebut sudah ada");
    }
    throw error;
  }

  const [item] = await orm
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
    .where(eq(player_stats.id, id))
    .limit(1);

  return ApiResponse.created("Statistik pemain berhasil dibuat", { item });
});
