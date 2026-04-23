import { STATUS_CODES } from "../constants/status-codes";
import { logger } from "./logger";
import { NextRequest } from "next/server";

type HandlerContext = {
  params: Promise<Record<string, string>>;
};

type RouteHandlerFn = (
  req: NextRequest,
  ctx: HandlerContext,
) => Promise<Response> | Response;

function getHttpStatusFromError(error: Error): number | null {
  const candidate = error as Error & { status?: unknown; statusCode?: unknown };

  if (typeof candidate.statusCode === "number") {
    return candidate.statusCode;
  }

  if (typeof candidate.status === "number") {
    return candidate.status;
  }

  return null;
}

export function RouteHandler(fn: RouteHandlerFn) {
  return async (req: NextRequest, ctx: HandlerContext): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (error: unknown) {
      logger.error("API Error", { error });

      let message = "Internal Server Error";
      let status: number = STATUS_CODES.INTERNAL_SERVER_ERROR;

      if (error instanceof Error) {
        message = error.message;

        const errorStatus = getHttpStatusFromError(error);
        if (errorStatus !== null) {
          status = errorStatus;
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          message,
        }),
        {
          status,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  };
}
