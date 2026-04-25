import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { orm } from "@/db/postgres";
import { player_stats, player_stats_history } from "@/db/schema";

const paramsSchema = z.object({
  id: z.uuid("Format id stats tidak valid"),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

type HistoryRow = {
  id: string;
  player_stats_id: string;
  before_payload: string;
  after_payload: string;
  changed_by: string;
  changed_at: string;
};

async function parseStatsId(params: Promise<Record<string, string>>) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter id tidak valid", parsed.error.issues);
  }
  return parsed.data.id;
}

function parseJsonPayload(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export const GET = RouteHandler(async (req, ctx) => {
  await requireAuth(req);

  const statsId = await parseStatsId(ctx.params);
  const parsedQuery = querySchema.safeParse({
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    throw ApiError.badRequest("Query tidak valid", parsedQuery.error.issues);
  }

  const stats = await orm
    .select({ id: player_stats.id })
    .from(player_stats)
    .where(eq(player_stats.id, statsId))
    .limit(1)
    .get() as { id: string } | undefined;

  if (!stats) {
    throw ApiError.notFound("Player stats tidak ditemukan");
  }

  const { page, limit } = parsedQuery.data;
  const offset = (page - 1) * limit;

  const historyItems = await orm
    .select({
      id: player_stats_history.id,
      player_stats_id: player_stats_history.player_stats_id,
      before_payload: player_stats_history.before_payload,
      after_payload: player_stats_history.after_payload,
      changed_by: player_stats_history.changed_by,
      changed_at: player_stats_history.changed_at,
    })
    .from(player_stats_history)
    .where(eq(player_stats_history.player_stats_id, statsId))
    .orderBy(desc(player_stats_history.changed_at))
    .limit(limit)
    .offset(offset)
    .all() as HistoryRow[];

  const countResult = (await orm
    .select({ total: count() })
    .from(player_stats_history)
    .where(and(eq(player_stats_history.player_stats_id, statsId)))
    .get()) as { total: number } | undefined;

  return ApiResponse.ok("Player stats history fetched", {
    items: historyItems.map((item) => ({
      id: item.id,
      player_stats_id: item.player_stats_id,
      before_payload: parseJsonPayload(item.before_payload),
      after_payload: parseJsonPayload(item.after_payload),
      changed_by: item.changed_by,
      changed_at: item.changed_at,
    })),
    pagination: {
      page,
      limit,
      total: countResult?.total ?? 0,
      total_pages: Math.max(1, Math.ceil((countResult?.total ?? 0) / limit)),
    },
  });
});
