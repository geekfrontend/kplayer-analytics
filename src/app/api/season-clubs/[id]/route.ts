import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { requireAuth, requireRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { orm } from "@/db/postgres";
import { season_clubs } from "@/db/schema";

const paramsSchema = z.object({
  id: z.uuid("Format id season club tidak valid"),
});

async function parseSeasonClubId(params: Promise<Record<string, string>>) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter id tidak valid", parsed.error.issues);
  }
  return parsed.data.id;
}

export const DELETE = RouteHandler(async (req, ctx) => {
  const user = await requireAuth(req);
  requireRole(user, ["admin"]);

  const id = await parseSeasonClubId(ctx.params);
  const result = await orm.delete(season_clubs).where(eq(season_clubs.id, id));

  if ((result.rowCount ?? 0) < 1) {
    throw ApiError.notFound("Relasi musim-klub tidak ditemukan");
  }

  return ApiResponse.ok("Relasi musim-klub berhasil dihapus");
});
