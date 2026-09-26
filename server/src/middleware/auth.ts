import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/response.js";

export interface AuthUser {
  userId: number;
  username: string;
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload {
  sub: number;
  username: string;
}

// Loads permissions fresh on every request so role/permission changes
// take effect immediately without waiting for token expiry.
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return fail(res, 401, "Authentication required");
  }
  const token = header.slice(7);
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
  } catch {
    return fail(res, 401, "Invalid or expired token");
  }
  const user = await prisma.user.findUnique({
    where: { user_id: payload.sub },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!user || !user.is_active) {
    return fail(res, 401, "Invalid or expired token");
  }
  const permissions = user.roles.flatMap((ur) =>
    ur.role.permissions.map((rp) => rp.permission.permission_key),
  );
  req.user = { userId: user.user_id, username: user.username, permissions };
  next();
}

// RBAC guard — EVERY endpoint must be wrapped (memory.md §7.5).
export function requirePermission(...keys: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, 401, "Authentication required");
    const hasAll = keys.every((k) => req.user!.permissions.includes(k));
    if (!hasAll) return fail(res, 403, "Insufficient permissions");
    next();
  };
}
