import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { hashPassword, requireAuth, requireRole } from "@/app/api/utils/auth";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { nowIsoString, orm } from "@/db/sqlite";
import { sessions, users } from "@/db/schema";

const paramsSchema = z.object({
  id: z.uuid("Format id user tidak valid"),
});

const resetPasswordSchema = z.object({
  new_password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .regex(/[A-Z]/, "Password wajib mengandung huruf besar")
    .regex(/[a-z]/, "Password wajib mengandung huruf kecil")
    .regex(/[0-9]/, "Password wajib mengandung angka")
    .regex(/[^A-Za-z0-9]/, "Password wajib mengandung simbol"),
});

async function parseUserId(paramsPromise: Promise<Record<string, string>>) {
  const parsed = paramsSchema.safeParse(await paramsPromise);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter id tidak valid", parsed.error.issues);
  }
  return parsed.data.id;
}

export const PATCH = RouteHandler(async (req, ctx) => {
  const currentUser = requireAuth(req);
  requireRole(currentUser, ["admin"]);

  const userId = await parseUserId(ctx.params);
  const payload = await req.json();
  const parsedBody = resetPasswordSchema.safeParse(payload);
  if (!parsedBody.success) {
    throw ApiError.badRequest(
      "Input reset password tidak valid",
      parsedBody.error.issues,
    );
  }

  const existingUser = orm
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .get() as { id: string } | undefined;

  if (!existingUser) {
    throw ApiError.notFound("User tidak ditemukan");
  }

  const passwordHash = hashPassword(parsedBody.data.new_password);
  orm
    .update(users)
    .set({
      password_hash: passwordHash,
      updated_at: nowIsoString(),
    })
    .where(eq(users.id, userId))
    .run();

  orm.delete(sessions).where(eq(sessions.user_id, userId)).run();

  return ApiResponse.ok("Password user berhasil di-reset");
});
