import { and, asc, count, like, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { orm } from "@/db/postgres";
import { players } from "@/db/schema";

const querySchema = z.object({
  q: z.string().trim().min(1, "Query q wajib diisi"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = RouteHandler(async (req) => {
  await requireAuth(req);

  const parsedQuery = querySchema.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const { q, page, limit } = parsedQuery.data;
  const offset = (page - 1) * limit;
  const whereConditions: SQL[] = [like(players.full_name, `%${q}%`)];
  const whereClause = and(...whereConditions);

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
    .orderBy(asc(players.full_name))
    .limit(limit)
    .offset(offset);

  const [countResult] = await orm
    .select({ total: count() })
    .from(players)
    .where(whereClause);

  return ApiResponse.ok("Hasil pencarian pemain berhasil diambil", {
    items,
    pagination: {
      page,
      limit,
      total: countResult?.total ?? 0,
      total_pages: Math.max(1, Math.ceil((countResult?.total ?? 0) / limit)),
    },
  });
});
