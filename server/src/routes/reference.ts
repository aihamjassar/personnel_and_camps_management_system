import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ok } from "../lib/response.js";
import { writeAudit } from "../lib/audit.js";
import { authenticate, requireAnyPermission, requirePermission } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/error.js";
import { campSchema, unitSchema, rankSchema, positionSchema, assignmentSchema } from "../validators/schemas.js";
import { createAssignment } from "../integration/assignments.js";

// Generic CRUD helper for the simple Phase 1 reference tables
// (camps, units, ranks, positions): same envelope, same audit events, same RBAC.
function simpleCrud<T extends { [K: string]: any }>(opts: {
  router: Router;
  model: {
    findMany: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
    count: (args?: any) => Promise<number>;
  };
  idKey: string;
  permission: string;
  readPermissions?: string[];
  auditTable: string;
  auditType: string;
  createSchema: any;
  updateSchema?: any;
  include?: any;
  orderBy?: any;
}) {
  const { router, model, idKey, permission, readPermissions, auditTable, auditType, createSchema, include, orderBy } = opts;

  router.get("/", requireAnyPermission(...(readPermissions ?? [permission])), async (_req, res, next) => {
    try {
      const items = await model.findMany({ include, orderBy: orderBy ?? { [idKey]: "asc" } });
      return ok(res, { items, total: items.length });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", requirePermission(permission), validateBody(createSchema), async (req, res, next) => {
    try {
      const created = await model.create({ data: req.body, include });
      await writeAudit({
        userId: req.user!.userId,
        actionType: `${auditType}Created`,
        targetTable: auditTable,
        targetId: created[idKey],
        newValue: created,
        ipAddress: req.ip,
      });
      return ok(res, created, 201);
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", requirePermission(permission), validateBody(opts.updateSchema ?? createSchema), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const before = await model.findMany({ where: { [idKey]: id }, take: 1 }).then((r: any[]) => r[0]);
      if (!before) throw new HttpError(404, `${auditTable} not found`);
      const updated = await model.update({ where: { [idKey]: id }, data: req.body, include });
      await writeAudit({
        userId: req.user!.userId,
        actionType: `${auditType}Updated`,
        targetTable: auditTable,
        targetId: id,
        oldValue: before,
        newValue: updated,
        ipAddress: req.ip,
      });
      return ok(res, updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", requirePermission(permission), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      try {
        await model.delete({ where: { [idKey]: id } });
      } catch {
        throw new HttpError(404, `${auditTable} not found`);
      }
      await writeAudit({
        userId: req.user!.userId,
        actionType: `${auditType}Deleted`,
        targetTable: auditTable,
        targetId: id,
        ipAddress: req.ip,
      });
      return ok(res, { [idKey]: id, deleted: true });
    } catch (err) {
      next(err);
    }
  });
}

export const campsRouter = Router();
campsRouter.use(authenticate);
simpleCrud({
  router: campsRouter,
  model: prisma.camp,
  idKey: "camp_id",
  permission: "camps.manage",
  readPermissions: ["camps.manage", "personnel.manage", "units.manage", "transfers.manage"],
  auditTable: "Camps",
  auditType: "Camp",
  createSchema: campSchema,
  updateSchema: campSchema.partial(),
  orderBy: { name: "asc" },
});

export const unitsRouter = Router();
unitsRouter.use(authenticate);
simpleCrud({
  router: unitsRouter,
  model: prisma.organizationalUnit,
  idKey: "unit_id",
  permission: "units.manage",
  readPermissions: ["units.manage", "personnel.manage", "assignments.manage", "positions.manage", "transfers.manage"],
  auditTable: "OrganizationalUnits",
  auditType: "OrganizationalUnit",
  createSchema: unitSchema,
  updateSchema: unitSchema.partial(),
  include: { camp: { select: { camp_id: true, name: true } } },
  orderBy: { name: "asc" },
});

export const ranksRouter = Router();
ranksRouter.use(authenticate);
simpleCrud({
  router: ranksRouter,
  model: prisma.rank,
  idKey: "rank_id",
  permission: "ranks.manage",
  readPermissions: ["ranks.manage", "personnel.manage"],
  auditTable: "Ranks",
  auditType: "Rank",
  createSchema: rankSchema,
  updateSchema: rankSchema.partial(),
  orderBy: { level: "asc" },
});

export const positionsRouter = Router();
positionsRouter.use(authenticate);
simpleCrud({
  router: positionsRouter,
  model: prisma.position,
  idKey: "position_id",
  permission: "positions.manage",
  readPermissions: ["positions.manage", "personnel.manage", "assignments.manage"],
  auditTable: "Positions",
  auditType: "Position",
  createSchema: positionSchema,
  updateSchema: positionSchema.partial(),
  orderBy: { name: "asc" },
});

// Assignments (FR-08) — append-oriented: creating a new one may close the previous current one.
export const assignmentsRouter = Router();
assignmentsRouter.use(authenticate);

assignmentsRouter.get("/", requirePermission("assignments.manage"), async (_req, res, next) => {
  try {
    const items = await prisma.assignment.findMany({
      include: {
        personnel: { select: { personnel_id: true, full_name: true } },
        unit: { select: { unit_id: true, name: true } },
        position: { select: { position_id: true, name: true } },
      },
      orderBy: { assignment_id: "desc" },
    });
    return ok(res, { items, total: items.length });
  } catch (err) {
    next(err);
  }
});

assignmentsRouter.post(
  "/",
  requirePermission("assignments.manage"),
  validateBody(assignmentSchema),
  async (req, res, next) => {
    try {
      const created = await createAssignment({ ...req.body, user_id: req.user!.userId, ip_address: req.ip });
      return ok(res, created, 201);
    } catch (err) {
      next(err);
    }
  },
);
