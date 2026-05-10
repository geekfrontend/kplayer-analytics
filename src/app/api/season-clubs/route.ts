import { randomUUID } from "node:crypto";
import { and, count, desc, eq, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { clubs, season_clubs, seasons } from "@/db/schema";

const querySchema = z.object({
  season_id: z.uuid("Format season_id tidak valid").optional(),
  club_id: z.uuid("Format club_id tidak valid").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createSeasonClubSchema = z.object({
  season_id: z.uuid("Format season_id tidak valid"),
  club_id: z.uuid("Format club_id tidak valid"),
});

type SeasonClubRow = {
  id: string;
  season_id: string;
  season_name: string;
  club_id: string;
  club_name: string;
  created_at: string;
};

function getSqliteErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }
  const candidate = error as { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : null;
}

async function validateForeignKeys(seasonId: string, clubId: string) {
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
}

export const GET = RouteHandler(async (req) => {
  await requireAuth(req);

  const parsedQuery = querySchema.safeParse({
    season_id: req.nextUrl.searchParams.get("season_id") ?? undefined,
    club_id: req.nextUrl.searchParams.get("club_id") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const { season_id, club_id, page, limit } = parsedQuery.data;
  const offset = (page - 1) * limit;
  const whereConditions: SQL[] = [];

  if (season_id) {
    whereConditions.push(eq(season_clubs.season_id, season_id));
  }

  if (club_id) {
    whereConditions.push(eq(season_clubs.club_id, club_id));
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const items = await orm
    .select({
      id: season_clubs.id,
      season_id: season_clubs.season_id,
      season_name: seasons.name,
      club_id: season_clubs.club_id,
      club_name: clubs.name,
      created_at: season_clubs.created_at,
    })
    .from(season_clubs)
    .innerJoin(seasons, eq(season_clubs.season_id, seasons.id))
    .innerJoin(clubs, eq(season_clubs.club_id, clubs.id))
    .where(whereClause)
    .orderBy(desc(season_clubs.created_at))
    .limit(limit)
    .offset(offset)
    .all() as SeasonClubRow[];

  const countResult = (await orm
    .select({ total: count() })
    .from(season_clubs)
    .where(whereClause)
    .get()) as { total: number } | undefined;

  return ApiResponse.ok("Daftar relasi musim-klub berhasil diambil", {
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

  const parsed = createSeasonClubSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest(
      "Input season club tidak valid",
      parsed.error.issues,
    );
  }

  await validateForeignKeys(parsed.data.season_id, parsed.data.club_id);

  const id = randomUUID();
  const createdAt = nowIsoString();

  try {
    await orm
      .insert(season_clubs)
      .values({
        id,
        season_id: parsed.data.season_id,
        club_id: parsed.data.club_id,
        created_at: createdAt,
      })
      .run();
  } catch (error) {
    if (getSqliteErrorCode(error) === "SQLITE_CONSTRAINT_UNIQUE") {
      throw ApiError.conflict("Relasi musim dan klub sudah terdaftar");
    }
    throw error;
  }

  const item = await orm
    .select({
      id: season_clubs.id,
      season_id: season_clubs.season_id,
      season_name: seasons.name,
      club_id: season_clubs.club_id,
      club_name: clubs.name,
      created_at: season_clubs.created_at,
    })
    .from(season_clubs)
    .innerJoin(seasons, eq(season_clubs.season_id, seasons.id))
    .innerJoin(clubs, eq(season_clubs.club_id, clubs.id))
    .where(eq(season_clubs.id, id))
    .limit(1)
    .get() as SeasonClubRow;

  return ApiResponse.created("Relasi musim-klub berhasil dibuat", { item });
});
