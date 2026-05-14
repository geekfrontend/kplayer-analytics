import { randomUUID } from "node:crypto";
import { and, count, desc, isNull, like, SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/postgres";
import { clubs } from "@/db/schema";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});

const createClubSchema = z.object({
  name: z.string().trim().min(2, "Nama klub minimal 2 karakter"),
});

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
  const whereConditions: SQL[] = [isNull(clubs.deleted_at)];
  if (q) {
    whereConditions.push(like(clubs.name, `%${q}%`));
  }
  const whereClause = and(...whereConditions);

  const items = await orm
    .select({
      id: clubs.id,
      name: clubs.name,
      created_at: clubs.created_at,
      updated_at: clubs.updated_at,
    })
    .from(clubs)
    .where(whereClause)
    .orderBy(desc(clubs.created_at))
    .limit(limit)
    .offset(offset);

  const [countResult] = await orm
    .select({ total: count() })
    .from(clubs)
    .where(whereClause);

  return ApiResponse.ok("Daftar klub berhasil diambil", {
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

  const parsed = createClubSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw ApiError.badRequest("Input club tidak valid", parsed.error.issues);
  }

  const id = randomUUID();
  const now = nowIsoString();
  await orm
    .insert(clubs)
    .values({
      id,
      name: parsed.data.name,
      created_at: now,
      updated_at: now,
    });

  return ApiResponse.created("Klub berhasil dibuat", {
    id,
    name: parsed.data.name,
    created_at: now,
    updated_at: now,
  });
});
