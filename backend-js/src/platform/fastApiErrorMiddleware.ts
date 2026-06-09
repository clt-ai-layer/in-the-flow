import type { ErrorRequestHandler, RequestHandler } from "express";
import {
  ConcurrencyError,
  IllegalStateError,
  NotFoundError,
  ValidationError,
} from "@event-driven-io/emmett";
import { ZodError } from "zod";

type FastApiErrorBody = {
  detail: string;
};

type HttpLikeError = Error & {
  status?: number;
  statusCode?: number;
  detail?: string;
};

/**
 * Maps an {@link IllegalStateError} message to a FastAPI-compatible HTTP status.
 *
 * @param message - Domain error message.
 * @returns HTTP status code (400, 404, or 422).
 */
export function mapIllegalStateStatus(message: string): number {
  const lower = message.toLowerCase();

  if (lower.includes("not found")) {
    return 404;
  }

  if (
    lower.includes("invalid") ||
    lower.includes("status") ||
    lower.includes("validation") ||
    lower.includes("boundaries") ||
    lower.includes("must align")
  ) {
    return 422;
  }

  return 400;
}

/**
 * Converts any thrown value into a FastAPI `{ detail }` response payload.
 *
 * @param error - Unknown thrown value.
 * @returns HTTP status and `{ detail }` body.
 */
export function mapErrorToFastApiResponse(error: unknown): {
  status: number;
  body: FastApiErrorBody;
} {
  if (error instanceof ZodError) {
    const detail =
      error.errors.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") ||
      "Validation error";

    return { status: 422, body: { detail } };
  }

  if (error instanceof NotFoundError) {
    const detail =
      error.message && error.message.length > 0 ? error.message : "Not found";
    return { status: 404, body: { detail } };
  }

  if (error instanceof ValidationError) {
    return { status: 422, body: { detail: error.message } };
  }

  if (error instanceof IllegalStateError) {
    return {
      status: mapIllegalStateStatus(error.message),
      body: { detail: error.message },
    };
  }

  if (error instanceof ConcurrencyError) {
    return { status: 412, body: { detail: error.message } };
  }

  if (isHttpLikeError(error)) {
    const status = error.status ?? error.statusCode ?? 500;
    const detail = error.detail ?? error.message ?? "Internal server error";
    return { status, body: { detail } };
  }

  if (error instanceof Error) {
    return { status: 500, body: { detail: error.message || "Internal server error" } };
  }

  return { status: 500, body: { detail: "Internal server error" } };
}

/**
 * Wraps async Express handlers so rejections reach the FastAPI error middleware.
 *
 * @param handler - Async route handler.
 * @returns Express middleware function.
 */
export function asyncHandler(
  handler: RequestHandler,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * Express error middleware that maps all errors to FastAPI `{ detail }` shape.
 */
export const fastApiErrorMiddleware: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const { status, body } = mapErrorToFastApiResponse(error);
  res.status(status).json(body);
};

function isHttpLikeError(error: unknown): error is HttpLikeError {
  return error instanceof Error && ("status" in error || "statusCode" in error || "detail" in error);
}
