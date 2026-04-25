import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { STATUS_CODES } from "../constants/status-codes";
import { logger } from "./logger";

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
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const startedAt = Date.now();

    try {
      const response = await fn(req, ctx);
      logger.info("API Request", {
        request_id: requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        status: response.status,
        duration_ms: Date.now() - startedAt,
      });
      return response;
    } catch (error: unknown) {
      let message = "Internal Server Error";
      let status: number = STATUS_CODES.INTERNAL_SERVER_ERROR;
      let errors: unknown;

      if (error instanceof Error) {
        message = error.message;

        const errorStatus = getHttpStatusFromError(error);
        if (errorStatus !== null) {
          status = errorStatus;
        }

        const candidate = error as Error & { errors?: unknown };
        if (candidate.errors !== undefined) {
          errors = candidate.errors;
        }
      }

      logger.error("API Error", {
        request_id: requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        status,
        duration_ms: Date.now() - startedAt,
        error,
      });

      return new Response(
        JSON.stringify({
          success: false,
          message,
          statusCode: status,
          ...(errors !== undefined && { errors }),
        }),
        {
          status,
          headers: {
            "Content-Type": "application/json",
            "x-request-id": requestId,
          },
        },
      );
    }
  };
}
