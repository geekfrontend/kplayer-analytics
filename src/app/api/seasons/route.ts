import { randomUUID } from "node:crypto";
import { and, count, desc, eq, isNull, like, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { getDbErrorCode, PG_UNIQUE_VIOLATION } from "@/app/api/utils/db-error";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { leagues, seasons } from "@/db/schema";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  league_id: z.uuid("Format league_id tidak valid").optional(),
});

const createSeasonSchema = z
  .object({
    name: z.string().regex(/^\d{4}\/\d{4}$/, "Format season harus YYYY/YYYY"),
    league_id: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== "" ? val : undefined))
      .pipe(z.uuid("Format league_id tidak valid").optional()),
    start_date: z.iso.date("Format start_date harus YYYY-MM-DD"),
    end_date: z.iso.date("Format end_date harus YYYY-MM-DD"),
    is_active: z.boolean().optional().default(false),
  })
  .refine(
    (data) =>
      Number(data.name.split("/")[1]) === Number(data.name.split("/")[0]) + 1,
    { message: "Tahun season tidak valid", path: ["name"] },
  )
  .refine((data) => data.start_date < data.end_date, {
    message: "start_date harus lebih kecil dari end_date",
    path: ["end_date"],
  });

export const GET = RouteHandler(async (req) => {
  await requireAuth(req);

  const parsedQuery = querySchema.safeParse({
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    q: req.nextUrl.searchParams.get("q") ?? undefined,
    league_id: req.nextUrl.searchParams.get("league_id") ?? undefined,
  });
  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const { page, limit, q, league_id } = parsedQuery.data;
  const offset = (page - 1) * limit;
  const whereConditions: SQL[] = [isNull(seasons.deleted_at)];
  if (q) {
    whereConditions.push(like(seasons.name, `%${q}%`));
  }
  if (league_id) {
    whereConditions.push(eq(seasons.league_id, league_id));
  }
  const whereClause = and(...whereConditions);

  const items = await orm
    .select({
      id: seasons.id,
      name: seasons.name,
      league_id: seasons.league_id,
      league_name: leagues.name,
      league_country: leagues.country,
      start_date: seasons.start_date,
      end_date: seasons.end_date,
      is_active: seasons.is_active,
      created_at: seasons.created_at,
      updated_at: seasons.updated_at,
    })
    .from(seasons)
    .leftJoin(leagues, eq(seasons.league_id, leagues.id))
    .where(whereClause)
    .orderBy(desc(seasons.start_date))
    .limit(limit)
    .offset(offset);

  const [countResult] = await orm
    .select({ total: count() })
    .from(seasons)
    .where(whereClause);

  return ApiResponse.ok("Daftar musim berhasil diambil", {
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

  const parsed = createSeasonSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input season tidak valid", parsed.error.issues);
  }

  // Validasi league_id jika diberikan
  if (parsed.data.league_id) {
    const [league] = await orm
      .select({ id: leagues.id })
      .from(leagues)
      .where(and(eq(leagues.id, parsed.data.league_id), isNull(leagues.deleted_at)))
      .limit(1);
    if (!league) {
      throw ApiError.badRequest("Liga tidak ditemukan");
    }
  }

  const id = randomUUID();
  const now = nowIsoString();

  try {
    await orm.insert(seasons).values({
      id,
      name: parsed.data.name,
      league_id: parsed.data.league_id ?? null,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      is_active: parsed.data.is_active ? 1 : 0,
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    if (getDbErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw ApiError.conflict(
        parsed.data.league_id
          ? "Musim dengan nama tersebut sudah terdaftar untuk liga ini"
          : "Musim sudah terdaftar",
      );
    }
    throw error;
  }

  return ApiResponse.created("Musim berhasil dibuat", {
    id,
    ...parsed.data,
    created_at: now,
    updated_at: now,
  });
});
