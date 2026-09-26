import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { ok } from "../lib/response.js";
import { writeAudit } from "../lib/audit.js";
import { authenticate, requirePermission } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/error.js";
import { createUserSchema, updateUserSchema } from "../validators/schemas.js";

export const usersRouter = Router();
usersRouter.use(authenticate);

const userInclude = {
  roles: { include: { role: { select: { role_id: true, role_name: true } } } },
} as const;

// GET /api/v1/users — list accounts (never expose password_hash)
usersRouter.get("/", requirePermission("users.manage"), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: userInclude,
      orderBy: { user_id: "asc" },
    });
    const safe = users.map(({ password_hash: _ph, ...u }) => u);
    return ok(res, { items: safe, total: safe.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/roles — roles + permissions catalog for the assign UI
usersRouter.get("/roles", requirePermission("users.manage"), async (_req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { role_id: "asc" },
    });
    return ok(res, { items: roles });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users — create account (FR-10 basic)
usersRouter.post(
  "/",
  requirePermission("users.manage"),
  validateBody(createUserSchema),
  async (req, res, next) => {
    try {
      const { username, password, full_name, email, role_ids } = req.body;
      const password_hash = await bcrypt.hash(password, 10);
      const created = await prisma.user.create({
        data: {
          username,
          password_hash,
          full_name,
          email: email ?? null,
          roles: { create: role_ids.map((role_id: number) => ({ role_id })) },
        },
        include: userInclude,
      });
      await writeAudit({
        userId: req.user!.userId,
        actionType: "UserCreated",
        targetTable: "Users",
        targetId: created.user_id,
        newValue: { user_id: created.user_id, username: created.username, role_ids },
        ipAddress: req.ip,
      });
      const { password_hash: _ph, ...safe } = created;
      return ok(res, safe, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/users/:id — update profile / roles / active flag / optional password
usersRouter.put(
  "/:id",
  requirePermission("users.manage"),
  validateBody(updateUserSchema),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const before = await prisma.user.findUnique({ where: { user_id: id } });
      if (!before) throw new HttpError(404, "User not found");
      const body = req.body as {
        full_name?: string;
        email?: string | null;
        is_active?: boolean;
        password?: string;
        role_ids?: number[];
      };
      const updated = await prisma.user.update({
        where: { user_id: id },
        data: {
          ...(body.full_name !== undefined ? { full_name: body.full_name } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
          ...(body.password ? { password_hash: await bcrypt.hash(body.password, 10) } : {}),
          ...(body.role_ids
            ? { roles: { deleteMany: {}, create: body.role_ids.map((role_id) => ({ role_id })) } }
            : {}),
        },
        include: userInclude,
      });
      // Role/permission changes are the most sensitive audit event (Audit.md §3.5).
      await writeAudit({
        userId: req.user!.userId,
        actionType: body.role_ids ? "RoleOrPermissionChanged" : "UserUpdated",
        targetTable: "Users",
        targetId: id,
        oldValue: { full_name: before.full_name, is_active: before.is_active },
        newValue: { full_name: updated.full_name, is_active: updated.is_active, role_ids: body.role_ids },
        ipAddress: req.ip,
      });
      const { password_hash: _ph, ...safe } = updated;
      return ok(res, safe);
    } catch (err) {
      next(err);
    }
  },
);
