import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ok } from "../lib/response.js";
import { authenticate, requirePermission } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { transferSchema } from "../validators/schemas.js";
import { executeTransfer } from "../integration/transfers.js";

export const transfersRouter = Router();
transfersRouter.use(authenticate);
transfersRouter.get("/eligible-personnel", requirePermission("transfers.manage"), async (_req, res, next) => {
  try {
    const items = await prisma.personnel.findMany({
      where: { deleted_at: null, is_active: true },
      select: {
        personnel_id: true,
        full_name: true,
        camp_id: true,
        camp: { select: { camp_id: true, name: true } },
      },
      orderBy: { full_name: "asc" },
    });
    return ok(res, { items });
  } catch (err) {
    next(err);
  }
});
transfersRouter.get("/", requirePermission("transfers.manage"), async (_req, res, next) => {
  try {
    const items = await prisma.transfer.findMany({
      include: {
        personnel: { select: { personnel_id: true, full_name: true } },
        camp_from: { select: { camp_id: true, name: true } },
        camp_to: { select: { camp_id: true, name: true } },
      },
      orderBy: { transfer_id: "desc" },
    });
    return ok(res, { items, total: items.length });
  } catch (err) {
    next(err);
  }
});
transfersRouter.post("/", requirePermission("transfers.manage"), validateBody(transferSchema), async (req, res, next) => {
  try {
    const result = await executeTransfer({
      ...req.body,
      user_id: req.user!.userId,
      ip_address: req.ip,
    });
    return ok(res, result, 201);
  } catch (err) {
    next(err);
  }
});
