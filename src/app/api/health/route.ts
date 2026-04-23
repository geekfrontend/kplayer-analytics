import { ApiResponse } from "@/app/api/utils/api-response";
import { RouteHandler } from "@/app/api/utils/route-handler";

export const GET = RouteHandler(async () => {
  return ApiResponse.ok("Service is healthy", {
    service: "kplayer-analytics-api",
    timestamp: new Date().toISOString(),
  });
});

