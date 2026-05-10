import { z } from "zod";
import { ApiError } from "@/app/api/utils/api-error";
import { ApiResponse } from "@/app/api/utils/api-response";
import { RouteHandler } from "@/app/api/utils/route-handler";
import {
  createSession,
  findUserByEmail,
  getAccessTokenExpiresInSeconds,
  signAccessToken,
  verifyPassword,
} from "@/app/api/utils/auth";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export const POST = RouteHandler(async (req) => {
  const payload = await req.json();
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    throw ApiError.badRequest("Input login tidak valid", parsed.error.flatten());
  }

  const user = await findUserByEmail(parsed.data.email);
  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    throw ApiError.unauthorized("Email atau password salah");
  }

  const accessToken = signAccessToken(user);
  const expiresIn = getAccessTokenExpiresInSeconds();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await createSession(user.id, accessToken, expiresAt);

  return ApiResponse.ok("Berhasil masuk", {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});
