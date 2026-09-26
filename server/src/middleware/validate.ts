import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

// Validates req.body against a Zod schema and replaces it with the parsed value.
// Strict validation of type/length/format is required on every field (Architecture.md §6).
export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
}
