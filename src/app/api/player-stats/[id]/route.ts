import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import {
  clubs,
  player_club_history,
  player_stats,
  player_stats_history,
  players,
  seasons,
} from "@/db/schema";

const paramsSchema = z.object({
  id: z.uuid("Format id statistik tidak valid"),
});

const updateSchema = z
  .object({
    goals: z.coerce.number().int().min(0).optional(),
    assists: z.coerce.number().int().min(0).optional(),
    shots: z.coerce.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal 1 field harus diisi",
  });

type PlayerStatsRecord = {
  id: string;
  player_id: string;
  season_id: string;
  club_id: string;
  minutes_played: number;
  goals: number;
  assists: number;
  shots: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
};

function validateStatsDomain(goals: number, shots: number) {
  if (shots < goals) {
    throw ApiError.badRequest("shots tidak boleh lebih kecil dari goals");
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
      "Statistik hanya bisa diperbarui jika penugasan pemain-musim-klub valid",
    );
  }
}

async function parseStatsId(params: Promise<Record<string, string>>) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter id tidak valid", parsed.error.issues);
  }
  return parsed.data.id;
}

async function getStatsById(id: string): Promise<PlayerStatsRecord | undefined> {
  const [result] = await orm
    .select({
      id: player_stats.id,
      player_id: player_stats.player_id,
      season_id: player_stats.season_id,
      club_id: player_stats.club_id,
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
    .where(eq(player_stats.id, id))
    .limit(1);

  return result as PlayerStatsRecord | undefined;
}

export const GET = RouteHandler(async (req, ctx) => {
  await requireAuth(req);

  const statsId = await parseStatsId(ctx.params);
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
    .where(eq(player_stats.id, statsId))
    .limit(1);

  if (!item) {
    throw ApiError.notFound("Statistik pemain tidak ditemukan");
  }

  return ApiResponse.ok("Detail statistik pemain berhasil diambil", { item });
});

export const PATCH = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);

  const statsId = await parseStatsId(ctx.params);
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest(
      "Input pembaruan statistik tidak valid",
      parsed.error.issues,
    );
  }

  const existing = await getStatsById(statsId);
  if (!existing) {
    throw ApiError.notFound("Statistik pemain tidak ditemukan");
  }

  const nextState = {
    minutes_played: 90,
    goals: parsed.data.goals ?? existing.goals,
    assists: parsed.data.assists ?? existing.assists,
    shots: parsed.data.shots ?? existing.shots,
  };

  validateStatsDomain(nextState.goals, nextState.shots);
  await validateAssignment(existing.player_id, existing.season_id, existing.club_id);

  const now = nowIsoString();

  try {
    await orm.transaction(async (tx) => {
      await tx
        .update(player_stats)
        .set({
          minutes_played: nextState.minutes_played,
          goals: nextState.goals,
          assists: nextState.assists,
          shots: nextState.shots,
          updated_at: now,
          updated_by: user.id,
        })
        .where(eq(player_stats.id, statsId));

      await tx
        .insert(player_stats_history)
        .values({
          id: randomUUID(),
          player_stats_id: statsId,
          before_payload: JSON.stringify({
            minutes_played: existing.minutes_played,
            goals: existing.goals,
            assists: existing.assists,
            shots: existing.shots,
          }),
          after_payload: JSON.stringify({
            minutes_played: nextState.minutes_played,
            goals: nextState.goals,
            assists: nextState.assists,
            shots: nextState.shots,
          }),
          changed_by: user.id,
          changed_at: now,
        });
    });
  } catch {
    throw ApiError.server("Gagal memperbarui statistik dan menyimpan riwayat");
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
    .where(eq(player_stats.id, statsId))
    .limit(1);

  return ApiResponse.ok("Statistik pemain berhasil diperbarui", { item });
});
