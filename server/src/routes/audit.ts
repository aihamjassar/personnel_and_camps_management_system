import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ok } from "../lib/response.js";
import { writeAudit } from "../lib/audit.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

export const auditRouter = Router();
auditRouter.use(authenticate);

// GET /api/v1/audit — admin-only listing with filters (Audit.md §4).
// Read-only by design: no PUT/DELETE routes ever exist for audit logs (Audit.md §6).
auditRouter.get(
  "/",
  requirePermission("system.admin"),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 20));
      const userId = req.query.user_id ? Number(req.query.user_id) : undefined;
      const actionType = typeof req.query.action_type === "string" ? req.query.action_type : undefined;
      const targetTable = typeof req.query.target_table === "string" ? req.query.target_table : undefined;
      const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
      const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
      const where = {
        ...(userId ? { user_id: userId } : {}),
        ...(actionType ? { action_type: actionType } : {}),
        ...(targetTable ? { target_table: targetTable } : {}),
        ...(from ? { created_at: { gte: from } } : {}),
        ...(to ? { created_at: { lte: to } } : {}),
      };
      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { user: { select: { user_id: true, username: true, full_name: true } } },
        }),
        prisma.auditLog.count({ where }),
      ]);
      // Meta-audit: viewing the audit log is itself a logged event (Audit.md §3.9).
      await writeAudit({
        userId: req.user!.userId,
        actionType: "AuditLogViewed",
        targetTable: "AuditLogs",
        ipAddress: req.ip ?? null,
      });
      return ok(res, { items, total, page, page_size: pageSize });
    } catch (err) {
      next(err);
    }
  },
);
