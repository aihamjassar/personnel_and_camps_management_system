import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { fail } from "../lib/response.js";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return fail(res, err.statusCode, err.message);
  }
  if (err instanceof ZodError) {
    return fail(res, 400, "Validation failed", err.issues);
  }
  console.error("[unhandled]", err);
  return fail(res, 500, "Internal server error");
}
