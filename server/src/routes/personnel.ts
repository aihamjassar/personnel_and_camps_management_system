import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ok } from "../lib/response.js";
import { writeAudit } from "../lib/audit.js";
import { authenticate, requirePermission } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/error.js";
import {
  createPersonnelSchema,
  updatePersonnelSchema,
  statusChangeSchema,
  listQuerySchema,
} from "../validators/schemas.js";

export const personnelRouter = Router();
personnelRouter.use(authenticate);

const includeRefs = {
  rank: { select: { rank_id: true, name: true, level: true } },
  unit: { select: { unit_id: true, name: true } },
  camp: { select: { camp_id: true, name: true } },
} as const;

// GET /api/v1/personnel — list with search/filter/pagination
personnelRouter.get("/", requirePermission("personnel.manage"), async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const where = {
      deleted_at: null, // soft-deleted rows never appear (memory.md §7.1)
      ...(q.search
        ? { full_name: { contains: q.search, mode: "insensitive" as const } }
        : {}),
      ...(q.camp_id ? { camp_id: q.camp_id } : {}),
      ...(q.unit_id ? { unit_id: q.unit_id } : {}),
      ...(q.rank_id ? { rank_id: q.rank_id } : {}),
      ...(q.status ? { current_status: q.status } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.personnel.findMany({
        where,
        include: includeRefs,
        orderBy: { personnel_id: "desc" },
        skip: (q.page - 1) * q.page_size,
        take: q.page_size,
      }),
      prisma.personnel.count({ where }),
    ]);
    return ok(res, { items, total, page: q.page, page_size: q.page_size });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/personnel — create (FR-01)
personnelRouter.post(
  "/",
  requirePermission("personnel.manage"),
  validateBody(createPersonnelSchema),
  async (req, res, next) => {
    try {
      const created = await prisma.personnel.create({ data: req.body, include: includeRefs });
      // First status row — history starts here (memory.md §7.2).
      await prisma.personnelStatus.create({
        data: { personnel_id: created.personnel_id, status: "active", changed_by: req.user!.userId },
      });
      await writeAudit({
        userId: req.user!.userId,
        actionType: "PersonnelCreated",
        targetTable: "Personnel",
        targetId: created.personnel_id,
        newValue: created,
        ipAddress: req.ip,
      });
      return ok(res, created, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/personnel/:id — update (FR-02)
personnelRouter.put(
  "/:id",
  requirePermission("personnel.manage"),
  validateBody(updatePersonnelSchema),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const before = await prisma.personnel.findFirst({ where: { personnel_id: id, deleted_at: null } });
      if (!before) throw new HttpError(404, "Personnel not found");
      const updated = await prisma.personnel.update({
        where: { personnel_id: id },
        data: req.body,
        include: includeRefs,
      });
      await writeAudit({
        userId: req.user!.userId,
        actionType: "PersonnelUpdated",
        targetTable: "Personnel",
        targetId: id,
        oldValue: before,
        newValue: updated,
        ipAddress: req.ip,
      });
      return ok(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/personnel/:id — logical delete only (memory.md §7.1)
personnelRouter.delete(
  "/:id",
  requirePermission("personnel.manage"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const before = await prisma.personnel.findFirst({ where: { personnel_id: id, deleted_at: null } });
      if (!before) throw new HttpError(404, "Personnel not found");
      const deleted = await prisma.personnel.update({
        where: { personnel_id: id },
        data: { deleted_at: new Date(), is_active: false },
      });
      await writeAudit({
        userId: req.user!.userId,
        actionType: "PersonnelDeactivated",
        targetTable: "Personnel",
        targetId: id,
        oldValue: before,
        newValue: deleted,
        ipAddress: req.ip,
      });
      return ok(res, { personnel_id: id, deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/personnel/:id/status — append-only status history (FR-04)
personnelRouter.post(
  "/:id/status",
  requirePermission("personnel.manage"),
  validateBody(statusChangeSchema),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const person = await prisma.personnel.findFirst({ where: { personnel_id: id, deleted_at: null } });
      if (!person) throw new HttpError(404, "Personnel not found");
      const oldStatus = person.current_status;
      const { status, notes } = req.body;
      // Single transaction: update current pointer + append history row (no overwrites).
      const history = await prisma.$transaction(async (tx) => {
        await tx.personnel.update({ where: { personnel_id: id }, data: { current_status: status } });
        return tx.personnelStatus.create({
          data: { personnel_id: id, status, notes, changed_by: req.user!.userId },
        });
      });
      await writeAudit({
        userId: req.user!.userId,
        actionType: "PersonnelStatusChanged",
        targetTable: "Personnel",
        targetId: id,
        oldValue: { status: oldStatus },
        newValue: { status, notes },
        ipAddress: req.ip,
      });
      return ok(res, history, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/personnel/:id/status — full status history
personnelRouter.get("/:id/status", requirePermission("personnel.manage"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const items = await prisma.personnelStatus.findMany({
      where: { personnel_id: id },
      orderBy: { created_at: "desc" },
    });
    return ok(res, { items });
  } catch (err) {
    next(err);
  }
});
