import type { Response } from "express";

// Unified response envelope — required on EVERY endpoint (memory.md §2).
export type ApiStatus = "success" | "fail";

export interface ApiSuccess<T> {
  status: "success";
  data: T;
  error: null;
}

export interface ApiFail {
  status: "fail";
  data: null;
  error: { message: string; details?: unknown };
}

export function ok<T>(res: Response, data: T, statusCode = 200): Response {
  const body: ApiSuccess<T> = { status: "success", data, error: null };
  return res.status(statusCode).json(body);
}

export function fail(
  res: Response,
  statusCode: number,
  message: string,
  details?: unknown,
): Response {
  const body: ApiFail = {
    status: "fail",
    data: null,
    error: details === undefined ? { message } : { message, details },
  };
  return res.status(statusCode).json(body);
}
