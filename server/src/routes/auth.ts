import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { ok, fail } from "../lib/response.js";
import { writeAudit } from "../lib/audit.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema } from "../validators/schemas.js";

export const authRouter = Router();

// Rate-limit login attempts (Architecture.md §6).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => fail(res, 429, "Too many login attempts, try again later"),
});

authRouter.post("/login", loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip ?? null;
    const user = await prisma.user.findUnique({
      where: { username },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !valid || !user.is_active) {
      await writeAudit({
        userId: user?.user_id ?? null,
        actionType: "UserLoginFailed",
        targetTable: "Users",
        targetId: user?.user_id ?? null,
        ipAddress: ip,
      });
      return fail(res, 401, "Invalid credentials");
    }
    const token = jwt.sign({ sub: user.user_id, username: user.username }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    });
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.permission_key),
    );
    await writeAudit({
      userId: user.user_id,
      actionType: "UserLoginSucceeded",
      targetTable: "Users",
      targetId: user.user_id,
      ipAddress: ip,
    });
    return ok(res, {
      token,
      user: { user_id: user.user_id, username: user.username, full_name: user.full_name, permissions },
    });
  } catch (err) {
    next(err);
  }
});

// Session restore for the SPA — returns the current user from a valid token.
authRouter.get("/me", authenticate, async (req, res) => {
  return ok(res, { user: req.user });
});
