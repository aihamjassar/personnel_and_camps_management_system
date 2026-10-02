import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ok } from "../lib/response.js";
import { writeAudit } from "../lib/audit.js";
import { authenticate, requirePermission } from "../middleware/auth.js";
import { buildPdf, buildXlsx } from "../lib/reportFile.js";

export const reportsRouter = Router();
reportsRouter.use(authenticate);

// Shared aggregate query for the dashboard report (FR-12, FR-13 basic).
async function fetchSummary() {
  const [total, active, byCamp, byRank, recentTransfers] = await Promise.all([
    prisma.personnel.count({ where: { deleted_at: null } }),
    prisma.personnel.count({ where: { deleted_at: null, current_status: "active" } }),
    prisma.personnel.groupBy({
      by: ["camp_id"],
      where: { deleted_at: null },
      _count: { _all: true },
    }),
    prisma.personnel.groupBy({
      by: ["rank_id"],
      where: { deleted_at: null },
      _count: { _all: true },
    }),
    prisma.transfer.findMany({
      orderBy: { requested_at: "desc" },
      take: 10,
      include: {
        personnel: { select: { personnel_id: true, full_name: true } },
        camp_from: { select: { camp_id: true, name: true } },
        camp_to: { select: { camp_id: true, name: true } },
      },
    }),
  ]);
  const [camps, ranks] = await Promise.all([
    prisma.camp.findMany({ select: { camp_id: true, name: true, capacity: true } }),
    prisma.rank.findMany({ select: { rank_id: true, name: true }, orderBy: { level: "asc" } }),
  ]);
  const campName = new Map(camps.map((c) => [c.camp_id, c.name]));
  const rankName = new Map(ranks.map((r) => [r.rank_id, r.name]));
  return {
    total_personnel: total,
    active_personnel: active,
    by_camp: byCamp.map((r) => ({
      camp_id: r.camp_id,
      name: r.camp_id ? (campName.get(r.camp_id) ?? "Unassigned") : "Unassigned",
      count: r._count._all,
      capacity: r.camp_id ? (camps.find((c) => c.camp_id === r.camp_id)?.capacity ?? 0) : 0,
    })),
    by_rank: byRank.map((r) => ({
      rank_id: r.rank_id,
      name: r.rank_id ? (rankName.get(r.rank_id) ?? "No rank") : "No rank",
      count: r._count._all,
    })),
    recent_transfers: recentTransfers,
  };
}

// GET /api/v1/reports/summary — dashboard/report aggregates (FR-12, FR-13 basic)
reportsRouter.get("/summary", requirePermission("reports.view"), async (req, res, next) => {
  try {
    const summary = await fetchSummary();
    await writeAudit({
      userId: req.user!.userId,
      actionType: "ReportGenerated",
      targetTable: "Reports",
      ipAddress: req.ip ?? null,
    });
    return ok(res, summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/export?format=xlsx|pdf — exportable reports (FR-13, Phase 3)
reportsRouter.get("/export", requirePermission("reports.view"), async (req, res, next) => {
  try {
    const format = typeof req.query.format === "string" ? req.query.format.toLowerCase() : "xlsx";
    if (format !== "xlsx" && format !== "pdf") {
      res.status(400).json({ status: "fail", data: null, error: { message: "format must be xlsx or pdf" } });
      return;
    }
    const summary = await fetchSummary();
    await writeAudit({
      userId: req.user!.userId,
      actionType: "ReportExported",
      targetTable: "Reports",
      newValue: { format },
      ipAddress: req.ip ?? null,
    });
    if (format === "xlsx") {
      const buffer = await buildXlsx(summary);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="report-summary.xlsx"');
      res.send(buffer);
      return;
    }
    const buffer = await buildPdf(summary);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="report-summary.pdf"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
