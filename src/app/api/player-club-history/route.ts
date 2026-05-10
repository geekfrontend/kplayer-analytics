import { randomUUID } from "node:crypto";
import { and, count, desc, eq, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import {
  clubs,
  player_club_history,
  players,
  season_clubs,
  seasons,
} from "@/db/schema";

const activeFilterSchema = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const querySchema = z.object({
  player_id: z.uuid("Format player_id tidak valid").optional(),
  season_id: z.uuid("Format season_id tidak valid").optional(),
  club_id: z.uuid("Format club_id tidak valid").optional(),
  is_active: activeFilterSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  player_id: z.uuid("Format player_id tidak valid"),
  season_id: z.uuid("Format season_id tidak valid"),
  club_id: z.uuid("Format club_id tidak valid"),
  join_date: z.iso.date("Format join_date harus YYYY-MM-DD"),
  leave_date: z.iso.date("Format leave_date harus YYYY-MM-DD").optional(),
  is_active: z.boolean().optional().default(true),
});

type AssignmentRow = {
  id: string;
  player_id: string;
  player_name: string;
  season_id: string;
  season_name: string;
  club_id: string;
  club_name: string;
  join_date: string;
  leave_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function validateDateOrder(joinDate: string, leaveDate?: string) {
  if (leaveDate && leaveDate < joinDate) {
    throw ApiError.badRequest("leave_date harus lebih besar atau sama join_date");
  }
}

async function validateMasterReferences(
  playerId: string,
  seasonId: string,
  clubId: string,
) {
  const player = (await orm
    .select({ id: players.id })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1)
    .get()) as { id: string } | undefined;
  if (!player) {
    throw ApiError.badRequest("Pemain tidak ditemukan");
  }

  const season = (await orm
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1)
    .get()) as { id: string } | undefined;
  if (!season) {
    throw ApiError.badRequest("Musim tidak ditemukan");
  }

  const club = (await orm
    .select({ id: clubs.id })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)
    .get()) as { id: string } | undefined;
  if (!club) {
    throw ApiError.badRequest("Klub tidak ditemukan");
  }

  const seasonClub = (await orm
    .select({ id: season_clubs.id })
    .from(season_clubs)
    .where(
      and(
        eq(season_clubs.season_id, seasonId),
        eq(season_clubs.club_id, clubId),
      ),
    )
    .limit(1)
    .get()) as { id: string } | undefined;

  if (!seasonClub) {
    throw ApiError.badRequest(
      "Klub belum terdaftar pada musim terkait di relasi musim-klub",
    );
  }
}

async function ensureNoActiveConflict(playerId: string, seasonId: string) {
  const activeAssignment = (await orm
    .select({ id: player_club_history.id })
    .from(player_club_history)
    .where(
      and(
        eq(player_club_history.player_id, playerId),
        eq(player_club_history.season_id, seasonId),
        eq(player_club_history.is_active, 1),
      ),
    )
    .limit(1)
    .get()) as { id: string } | undefined;

  if (activeAssignment) {
    throw ApiError.conflict(
      "Pemain sudah memiliki penugasan aktif pada musim tersebut",
    );
  }
}

export const GET = RouteHandler(async (req) => {
  await requireAuth(req);

  const parsedQuery = querySchema.safeParse({
    player_id: req.nextUrl.searchParams.get("player_id") ?? undefined,
    season_id: req.nextUrl.searchParams.get("season_id") ?? undefined,
    club_id: req.nextUrl.searchParams.get("club_id") ?? undefined,
    is_active: req.nextUrl.searchParams.get("is_active") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const { player_id, season_id, club_id, is_active, page, limit } =
    parsedQuery.data;
  const offset = (page - 1) * limit;

  const whereConditions: SQL[] = [];
  if (player_id) {
    whereConditions.push(eq(player_club_history.player_id, player_id));
  }
  if (season_id) {
    whereConditions.push(eq(player_club_history.season_id, season_id));
  }
  if (club_id) {
    whereConditions.push(eq(player_club_history.club_id, club_id));
  }
  if (typeof is_active === "boolean") {
    whereConditions.push(eq(player_club_history.is_active, is_active ? 1 : 0));
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const items = await orm
    .select({
      id: player_club_history.id,
      player_id: player_club_history.player_id,
      player_name: players.full_name,
      season_id: player_club_history.season_id,
      season_name: seasons.name,
      club_id: player_club_history.club_id,
      club_name: clubs.name,
      join_date: player_club_history.join_date,
      leave_date: player_club_history.leave_date,
      is_active: player_club_history.is_active,
      created_at: player_club_history.created_at,
      updated_at: player_club_history.updated_at,
    })
    .from(player_club_history)
    .innerJoin(players, eq(player_club_history.player_id, players.id))
    .innerJoin(seasons, eq(player_club_history.season_id, seasons.id))
    .innerJoin(clubs, eq(player_club_history.club_id, clubs.id))
    .where(whereClause)
    .orderBy(desc(player_club_history.created_at))
    .limit(limit)
    .offset(offset)
    .all() as AssignmentRow[];

  const countResult = (await orm
    .select({ total: count() })
    .from(player_club_history)
    .where(whereClause)
    .get()) as { total: number } | undefined;

  return ApiResponse.ok("Riwayat klub pemain berhasil diambil", {
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
    throw ApiError.badRequest("Input assignment tidak valid", parsed.error.issues);
  }

  const payload = parsed.data;
  validateDateOrder(payload.join_date, payload.leave_date);
  await validateMasterReferences(
    payload.player_id,
    payload.season_id,
    payload.club_id,
  );

  if (payload.is_active) {
    await ensureNoActiveConflict(payload.player_id, payload.season_id);
  }

  const id = randomUUID();
  const now = nowIsoString();

  await orm
    .insert(player_club_history)
    .values({
      id,
      player_id: payload.player_id,
      season_id: payload.season_id,
      club_id: payload.club_id,
      join_date: payload.join_date,
      leave_date: payload.leave_date ?? null,
      is_active: payload.is_active ? 1 : 0,
      created_at: now,
      updated_at: now,
    })
    .run();

  const item = await orm
    .select({
      id: player_club_history.id,
      player_id: player_club_history.player_id,
      player_name: players.full_name,
      season_id: player_club_history.season_id,
      season_name: seasons.name,
      club_id: player_club_history.club_id,
      club_name: clubs.name,
      join_date: player_club_history.join_date,
      leave_date: player_club_history.leave_date,
      is_active: player_club_history.is_active,
      created_at: player_club_history.created_at,
      updated_at: player_club_history.updated_at,
    })
    .from(player_club_history)
    .innerJoin(players, eq(player_club_history.player_id, players.id))
    .innerJoin(seasons, eq(player_club_history.season_id, seasons.id))
    .innerJoin(clubs, eq(player_club_history.club_id, clubs.id))
    .where(eq(player_club_history.id, id))
    .limit(1)
    .get() as AssignmentRow;

  return ApiResponse.created("Penugasan berhasil dibuat", { item });
});
