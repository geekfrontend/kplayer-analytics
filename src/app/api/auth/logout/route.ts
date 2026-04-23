import { ApiResponse } from "@/app/api/utils/api-response";
import { RouteHandler } from "@/app/api/utils/route-handler";
import { deleteSessionByToken, getBearerToken } from "@/app/api/utils/auth";

export const POST = RouteHandler(async (req) => {
  const token = getBearerToken(req);
  deleteSessionByToken(token);

  return ApiResponse.ok("Logout success");
});

