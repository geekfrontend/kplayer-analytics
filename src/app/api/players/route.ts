import { randomUUID } from "node:crypto";
import { and, count, desc, like, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { players } from "@/db/schema";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});

const createPlayerSchema = z.object({
  full_name: z.string().trim().min(3, "Nama pemain minimal 3 karakter"),
  date_of_birth: z.iso.date("Format date_of_birth harus YYYY-MM-DD"),
  nationality: z
    .string()
    .trim()
    .min(2, "Nationality minimal 2 karakter")
    .optional(),
  primary_position: z.string().trim().min(2, "Posisi minimal 2 karakter"),
});

function validateDateOfBirth(dateOfBirth: string) {
  if (new Date(dateOfBirth).getTime() > Date.now()) {
    throw ApiError.badRequest("date_of_birth tidak boleh tanggal masa depan");
  }
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
    whereConditions.push(like(players.full_name, `%${q}%`));
  }
  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const items = await orm
    .select({
      id: players.id,
      full_name: players.full_name,
      date_of_birth: players.date_of_birth,
      nationality: players.nationality,
      primary_position: players.primary_position,
      created_at: players.created_at,
      updated_at: players.updated_at,
    })
    .from(players)
    .where(whereClause)
    .orderBy(desc(players.created_at))
    .limit(limit)
    .offset(offset);

  const [countResult] = await orm
    .select({ total: count() })
    .from(players)
    .where(whereClause);

  return ApiResponse.ok("Daftar pemain berhasil diambil", {
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

  const parsed = createPlayerSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input player tidak valid", parsed.error.issues);
  }

  validateDateOfBirth(parsed.data.date_of_birth);

  const id = randomUUID();
  const now = nowIsoString();

  await orm
    .insert(players)
    .values({
      id,
      full_name: parsed.data.full_name,
      date_of_birth: parsed.data.date_of_birth,
      nationality: parsed.data.nationality ?? null,
      primary_position: parsed.data.primary_position,
      created_at: now,
      updated_at: now,
    });

  return ApiResponse.created("Pemain berhasil dibuat", {
    id,
    ...parsed.data,
    created_at: now,
    updated_at: now,
  });
});
