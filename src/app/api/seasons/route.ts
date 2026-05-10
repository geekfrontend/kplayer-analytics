import { randomUUID } from "node:crypto";
import { and, count, desc, like, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { seasons } from "@/db/schema";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});

const createSeasonSchema = z
  .object({
    name: z.string().regex(/^\d{4}\/\d{4}$/, "Format season harus YYYY/YYYY"),
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

type SeasonRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function getSqliteErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }
  const candidate = error as { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : null;
}

export const GET = RouteHandler(async (req) => {
  await requireAuth(req);

  const parsedQuery = querySchema.safeParse({
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    q: req.nextUrl.searchParams.get("q") ?? undefined,
  });
  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const { page, limit, q } = parsedQuery.data;
  const offset = (page - 1) * limit;
  const whereConditions: SQL[] = [];
  if (q) {
    whereConditions.push(like(seasons.name, `%${q}%`));
  }
  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const items = await orm
    .select({
      id: seasons.id,
      name: seasons.name,
      start_date: seasons.start_date,
      end_date: seasons.end_date,
      is_active: seasons.is_active,
      created_at: seasons.created_at,
      updated_at: seasons.updated_at,
    })
    .from(seasons)
    .where(whereClause)
    .orderBy(desc(seasons.start_date))
    .limit(limit)
    .offset(offset)
    .all() as SeasonRow[];

  const countResult = (await orm
    .select({ total: count() })
    .from(seasons)
    .where(whereClause)
    .get()) as { total: number } | undefined;

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

  const id = randomUUID();
  const now = nowIsoString();

  try {
    orm
      .insert(seasons)
      .values({
        id,
        name: parsed.data.name,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        is_active: parsed.data.is_active ? 1 : 0,
        created_at: now,
        updated_at: now,
      })
      .run();
  } catch (error) {
    if (getSqliteErrorCode(error) === "SQLITE_CONSTRAINT_UNIQUE") {
      throw ApiError.conflict("Musim sudah terdaftar");
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
