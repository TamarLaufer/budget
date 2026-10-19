import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import type { Logger } from "../config/logger.js";
import { Prisma } from "../generated/prisma/client.js";
import type { ApiErrorBody } from "../../../shared/api.js";
import { AppError } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiErrorBody = { error: { code: "ROUTE_NOT_FOUND", message: "Route not found" } };
  res.status(404).json(body);
};

function toAppError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return new AppError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed",
      error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return new AppError(409, "CONFLICT", "Resource already exists");
    if (error.code === "P2025") return new AppError(404, "NOT_FOUND", "Resource not found");
    if (error.code === "P2003") {
      return new AppError(409, "REFERENCE_CONFLICT", "Resource is referenced by other records");
    }
  }

  // express.json() errors carry an HTTP status and a `type`.
  if (typeof error === "object" && error !== null && "type" in error) {
    const type = error.type;
    if (type === "entity.parse.failed") return new AppError(400, "INVALID_JSON", "Malformed JSON body");
    if (type === "entity.too.large") return new AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
  }

  return undefined;
}

/**
 * Central error handler. Known errors become `{ error: { code, message } }` with the right
 * status; anything unexpected is logged server-side and returned as a generic 500.
 * Stack traces and internal messages are never sent to clients.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    const appError = toAppError(error);
    if (appError && appError.status < 500) {
      const body: ApiErrorBody = {
        error: {
          code: appError.code,
          message: appError.message,
          ...(appError.details ? { details: appError.details } : {}),
        },
      };
      res.status(appError.status).json(body);
      return;
    }

    logger.error({ err: error, method: req.method, path: req.path }, "Unhandled request error");
    const body: ApiErrorBody = {
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
    res.status(500).json(body);
  };
}
