import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ok } from "../lib/response.js";
import { authenticate, requireAnyPermission } from "../middleware/auth.js";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

const ALL_APP_PERMISSIONS = [
  "personnel.manage", "camps.manage", "units.manage", "ranks.manage", "positions.manage",
  "assignments.manage", "transfers.manage", "users.manage", "reports.view", "audit.view", "system.admin",
];

// GET /api/v1/notifications — current user's notifications (newest first).
notificationsRouter.get("/", requireAnyPermission(...ALL_APP_PERMISSIONS), async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === "true";
    const items = await prisma.notification.findMany({
      where: { user_id: req.user!.userId, ...(unreadOnly ? { is_read: false } : {}) },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    const unread = await prisma.notification.count({ where: { user_id: req.user!.userId, is_read: false } });
    return ok(res, { items, unread });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/notifications/:id/read — mark one notification as read.
notificationsRouter.patch("/:id/read", requireAnyPermission(...ALL_APP_PERMISSIONS), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.notification.findFirst({ where: { notification_id: id, user_id: req.user!.userId } });
    if (!existing) return res.status(404).json({ status: "fail", data: null, error: { message: "Notification not found" } });
    const updated = await prisma.notification.update({ where: { notification_id: id }, data: { is_read: true } });
    return ok(res, updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/notifications/read-all — mark all of the current user's notifications as read.
notificationsRouter.patch("/read-all", requireAnyPermission(...ALL_APP_PERMISSIONS), async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({ where: { user_id: req.user!.userId, is_read: false }, data: { is_read: true } });
    return ok(res, { updated: result.count });
  } catch (err) {
    next(err);
  }
});
