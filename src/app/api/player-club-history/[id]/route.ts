import { and, eq, ne } from "drizzle-orm";
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

const paramsSchema = z.object({
  id: z.uuid("Format id assignment tidak valid"),
});

const updateSchema = z
  .object({
    player_id: z.uuid("Format player_id tidak valid").optional(),
    season_id: z.uuid("Format season_id tidak valid").optional(),
    club_id: z.uuid("Format club_id tidak valid").optional(),
    join_date: z.iso.date("Format join_date harus YYYY-MM-DD").optional(),
    leave_date: z
      .union([z.iso.date("Format leave_date harus YYYY-MM-DD"), z.null()])
      .optional(),
    is_active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal 1 field harus diisi",
  });

type AssignmentRecord = {
  id: string;
  player_id: string;
  season_id: string;
  club_id: string;
  join_date: string;
  leave_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function validateDateOrder(joinDate: string, leaveDate: string | null) {
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
    throw ApiError.badRequest("Player tidak ditemukan");
  }

  const season = (await orm
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1)
    .get()) as { id: string } | undefined;
  if (!season) {
    throw ApiError.badRequest("Season tidak ditemukan");
  }

  const club = (await orm
    .select({ id: clubs.id })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)
    .get()) as { id: string } | undefined;
  if (!club) {
    throw ApiError.badRequest("Club tidak ditemukan");
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
      "Club belum terdaftar pada season terkait di season-clubs",
    );
  }
}

async function ensureNoActiveConflict(
  assignmentId: string,
  playerId: string,
  seasonId: string,
) {
  const activeAssignment = (await orm
    .select({ id: player_club_history.id })
    .from(player_club_history)
    .where(
      and(
        eq(player_club_history.player_id, playerId),
        eq(player_club_history.season_id, seasonId),
        eq(player_club_history.is_active, 1),
        ne(player_club_history.id, assignmentId),
      ),
    )
    .limit(1)
    .get()) as { id: string } | undefined;

  if (activeAssignment) {
    throw ApiError.conflict(
      "Player sudah memiliki assignment aktif pada season tersebut",
    );
  }
}

async function parseAssignmentId(params: Promise<Record<string, string>>) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter id tidak valid", parsed.error.issues);
  }

  return parsed.data.id;
}

export const PATCH = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);

  const assignmentId = await parseAssignmentId(ctx.params);
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input assignment tidak valid", parsed.error.issues);
  }

  const existing = await orm
    .select({
      id: player_club_history.id,
      player_id: player_club_history.player_id,
      season_id: player_club_history.season_id,
      club_id: player_club_history.club_id,
      join_date: player_club_history.join_date,
      leave_date: player_club_history.leave_date,
      is_active: player_club_history.is_active,
      created_at: player_club_history.created_at,
      updated_at: player_club_history.updated_at,
    })
    .from(player_club_history)
    .where(eq(player_club_history.id, assignmentId))
    .limit(1)
    .get() as AssignmentRecord | undefined;

  if (!existing) {
    throw ApiError.notFound("Assignment tidak ditemukan");
  }

  const nextState = {
    player_id: parsed.data.player_id ?? existing.player_id,
    season_id: parsed.data.season_id ?? existing.season_id,
    club_id: parsed.data.club_id ?? existing.club_id,
    join_date: parsed.data.join_date ?? existing.join_date,
    leave_date:
      parsed.data.leave_date !== undefined
        ? parsed.data.leave_date
        : existing.leave_date,
    is_active:
      typeof parsed.data.is_active === "boolean"
        ? parsed.data.is_active
        : existing.is_active === 1,
  };

  validateDateOrder(nextState.join_date, nextState.leave_date);
  await validateMasterReferences(
    nextState.player_id,
    nextState.season_id,
    nextState.club_id,
  );

  if (nextState.is_active) {
    await ensureNoActiveConflict(
      assignmentId,
      nextState.player_id,
      nextState.season_id,
    );
  }

  await orm
    .update(player_club_history)
    .set({
      player_id: nextState.player_id,
      season_id: nextState.season_id,
      club_id: nextState.club_id,
      join_date: nextState.join_date,
      leave_date: nextState.leave_date,
      is_active: nextState.is_active ? 1 : 0,
      updated_at: nowIsoString(),
    })
    .where(eq(player_club_history.id, assignmentId))
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
    .where(eq(player_club_history.id, assignmentId))
    .limit(1)
    .get();

  return ApiResponse.ok("Assignment berhasil diperbarui", { item });
});

export const DELETE = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);

  const assignmentId = await parseAssignmentId(ctx.params);
  const result = await orm
    .delete(player_club_history)
    .where(eq(player_club_history.id, assignmentId))
    .run();

  if (result.changes < 1) {
    throw ApiError.notFound("Assignment tidak ditemukan");
  }

  return ApiResponse.ok("Assignment berhasil dihapus");
});
