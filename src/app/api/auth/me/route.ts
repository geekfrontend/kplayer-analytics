import { ApiResponse } from "@/app/api/utils/api-response";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { requireAuth } from "@/app/api/utils/auth";

export const GET = RouteHandler(async (req) => {
  const user = await requireAuth(req);

  return ApiResponse.ok("Data pengguna saat ini berhasil diambil", { user });
});
