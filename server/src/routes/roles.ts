import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ok } from "../lib/response.js";
import { authenticate, requirePermission } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/error.js";
import { notifyPermissionHolders } from "../lib/notifications.js";
import { rolePermissionsSchema } from "../validators/schemas.js";

export const rolesRouter = Router();
rolesRouter.use(authenticate);
rolesRouter.get("/", requirePermission("users.manage"), async (_req, res, next) => {
  try {
    const items = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { role_id: "asc" },
    });
    return ok(res, { items });
  } catch (err) {
    next(err);
  }
});
rolesRouter.get("/permissions", requirePermission("users.manage"), async (_req, res, next) => {
  try {
    const items = await prisma.permission.findMany({ orderBy: { permission_key: "asc" } });
    return ok(res, { items });
  } catch (err) {
    next(err);
  }
});
rolesRouter.put("/:id/permissions", requirePermission("users.manage"), validateBody(rolePermissionsSchema), async (req, res, next) => {
  try {
    const roleId = Number(req.params.id);
    const permissionIds = [...new Set<number>(req.body.permission_ids)];
    const result = await prisma.$transaction(async (tx) => {
      // Serialize the last-administrator invariant across concurrent RBAC updates.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(741852963) IS NULL AS lock_acquired`;
      const role = await tx.role.findUnique({
        where: { role_id: roleId },
        include: { permissions: { include: { permission: true } } },
      });
      if (!role) throw new HttpError(404, "Role not found");
      const catalog = await tx.permission.findMany({ where: { permission_id: { in: permissionIds } } });
      if (catalog.length !== permissionIds.length) throw new HttpError(400, "One or more permissions do not exist");
      const previous = role.permissions.map(({ permission }) => permission.permission_id);
      await tx.rolePermission.deleteMany({ where: { role_id: roleId } });
      if (permissionIds.length) {
        await tx.rolePermission.createMany({ data: permissionIds.map((permission_id) => ({ role_id: roleId, permission_id })) });
      }
      // Never allow configuration that leaves the system without an active administrator.
      const administratorPermission = await tx.permission.findUnique({ where: { permission_key: "system.admin" } });
      if (administratorPermission) {
        const admins = await tx.user.count({
          where: {
            is_active: true,
            roles: { some: { role: { permissions: { some: { permission_id: administratorPermission.permission_id } } } } },
          },
        });
        if (admins === 0) throw new HttpError(409, "At least one active system administrator must retain system.admin");
      }
      await tx.auditLog.create({
        data: {
          user_id: req.user!.userId,
          action_type: "RolePermissionsChanged",
          target_table: "Roles",
          target_id: roleId,
          ip_address: req.ip,
          old_value: { permission_ids: previous },
          new_value: { permission_ids: permissionIds },
        },
      });
      return tx.role.findUniqueOrThrow({
        where: { role_id: roleId },
        include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      });
    });
    // FR-15: confirmation copy to system administrators (Flow-of-Event.md §5).
    await notifyPermissionHolders(
      "system.admin",
      "تغيير صلاحيات دور",
      `حدّث مستخدم رقم ${req.user!.userId} صلاحيات الدور رقم ${roleId}.`,
      req.user!.userId,
    );
    return ok(res, result);
  } catch (err) {
    next(err);
  }
});
