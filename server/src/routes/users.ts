import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { ok } from "../lib/response.js";
import { writeAudit } from "../lib/audit.js";
import { authenticate, requirePermission } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/error.js";
import { createUserSchema, updateUserSchema } from "../validators/schemas.js";
import { getSystemSettings } from "../lib/system-settings.js";
import { passwordPolicyViolations } from "../lib/password-policy.js";

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
      const policy = await getSystemSettings();
      const violations = passwordPolicyViolations(password, policy);
      if (violations.length) throw new HttpError(400, `Password does not satisfy system policy: ${violations.join(", ")}`);
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
      const body = req.body as {
        full_name?: string;
        email?: string | null;
        is_active?: boolean;
        password?: string;
        role_ids?: number[];
      };
      if (body.password) {
        const policy = await getSystemSettings();
        const violations = passwordPolicyViolations(body.password, policy);
        if (violations.length) throw new HttpError(400, `Password does not satisfy system policy: ${violations.join(", ")}`);
      }
      const password_hash = body.password ? await bcrypt.hash(body.password, 10) : undefined;
      const updated = await prisma.$transaction(async (tx) => {
        // Share a global lock with role-permission changes so two administrators cannot
        // concurrently deactivate the last admin through separate routes.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(741852963) IS NULL AS lock_acquired`;
        const before = await tx.user.findUnique({ where: { user_id: id }, include: userInclude });
        if (!before) throw new HttpError(404, "User not found");
        const changed = await tx.user.update({
          where: { user_id: id },
          data: {
            ...(body.full_name !== undefined ? { full_name: body.full_name } : {}),
            ...(body.email !== undefined ? { email: body.email } : {}),
            ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
            ...(password_hash ? { password_hash } : {}),
            ...(body.role_ids
              ? { roles: { deleteMany: {}, create: body.role_ids.map((role_id) => ({ role_id })) } }
              : {}),
          },
          include: userInclude,
        });
        const administratorPermission = await tx.permission.findUnique({ where: { permission_key: "system.admin" } });
        if (administratorPermission) {
          const activeAdmins = await tx.user.count({
            where: {
              is_active: true,
              roles: { some: { role: { permissions: { some: { permission_id: administratorPermission.permission_id } } } } },
            },
          });
          if (activeAdmins === 0) throw new HttpError(409, "At least one active system administrator must retain system.admin");
        }
        await tx.auditLog.create({
          data: {
            user_id: req.user!.userId,
            action_type: body.role_ids ? "RoleOrPermissionChanged" : "UserUpdated",
            target_table: "Users",
            target_id: id,
            ip_address: req.ip,
            old_value: {
              full_name: before.full_name,
              is_active: before.is_active,
              role_ids: before.roles.map(({ role }) => role.role_id),
            },
            new_value: {
              full_name: changed.full_name,
              is_active: changed.is_active,
              role_ids: changed.roles.map(({ role }) => role.role_id),
            },
          },
        });
        return changed;
      });
      const { password_hash: _ph, ...safe } = updated;
      return ok(res, safe);
    } catch (err) {
      next(err);
    }
  },
);
