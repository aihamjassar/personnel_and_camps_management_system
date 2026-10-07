import { Router, type Request } from "express";
import { prisma } from "../lib/prisma.js";
import { ok } from "../lib/response.js";
import { writeAudit } from "../lib/audit.js";
import { authenticate, requirePermission } from "../middleware/auth.js";
import { buildPdf, buildXlsx } from "../lib/reportFile.js";
import { HttpError } from "../middleware/error.js";

export const reportsRouter = Router();
reportsRouter.use(authenticate);

type SummaryFilters = { from?: Date; to?: Date; campId?: number; status?: string };

function summaryFiltersFromRequest(req: Request): SummaryFilters {
  const parseDate = (value: unknown, field: string) => {
    if (value === undefined) return undefined;
    if (typeof value !== "string") throw new HttpError(400, `${field} must be a single ISO date`);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} must be a valid date`);
    return date;
  };
  const from = parseDate(req.query.from, "from");
  const to = parseDate(req.query.to, "to");
  if (from && to && from > to) throw new HttpError(400, "Report date range start must be before or equal to its end");

  let campId: number | undefined;
  if (req.query.camp_id !== undefined) {
    if (typeof req.query.camp_id !== "string" || !/^\d+$/.test(req.query.camp_id)) {
      throw new HttpError(400, "camp_id must be a positive integer");
    }
    campId = Number(req.query.camp_id);
    if (!Number.isSafeInteger(campId) || campId < 1) throw new HttpError(400, "camp_id must be a positive integer");
  }

  let status: string | undefined;
  if (req.query.status !== undefined) {
    const allowed = ["active", "inactive", "on_leave", "transferred", "discharged"];
    if (typeof req.query.status !== "string" || !allowed.includes(req.query.status)) {
      throw new HttpError(400, "status is not supported");
    }
    status = req.query.status;
  }
  return { from, to, campId, status };
}

// Date bounds filter personnel record creation and matching transfer dates;
// camp/status filter the current personnel snapshot. The UI labels this scope explicitly.
async function fetchSummary(filters: SummaryFilters = {}) {
  const personnelWhere = {
    deleted_at: null,
    ...(filters.campId ? { camp_id: filters.campId } : {}),
    ...(filters.status ? { current_status: filters.status } : {}),
    ...(filters.from || filters.to ? {
      created_at: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) },
    } : {}),
  };
  const transferWhere = {
    ...(filters.from || filters.to ? {
      requested_at: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) },
    } : {}),
    ...(filters.campId ? { OR: [{ camp_from_id: filters.campId }, { camp_to_id: filters.campId }] } : {}),
    ...(filters.status ? { personnel: { is: { deleted_at: null, current_status: filters.status } } } : {}),
  };
  const [total, active, byCamp, byRank, byStatus, recentTransfers] = await Promise.all([
    prisma.personnel.count({ where: personnelWhere }),
    filters.status && filters.status !== "active"
      ? Promise.resolve(0)
      : prisma.personnel.count({ where: { ...personnelWhere, current_status: "active" } }),
    prisma.personnel.groupBy({
      by: ["camp_id"],
      where: personnelWhere,
      _count: { _all: true },
    }),
    prisma.personnel.groupBy({
      by: ["rank_id"],
      where: personnelWhere,
      _count: { _all: true },
    }),
    prisma.personnel.groupBy({
      by: ["current_status"],
      where: personnelWhere,
      _count: { _all: true },
    }),
    prisma.transfer.findMany({
      where: transferWhere,
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
    status_breakdown: byStatus.map((r) => ({ status: r.current_status, count: r._count._all })),
    filters: {
      from: filters.from?.toISOString() ?? null,
      to: filters.to?.toISOString() ?? null,
      camp_id: filters.campId ?? null,
      status: filters.status ?? null,
    },
    available_camps: camps.map((c) => ({ camp_id: c.camp_id, name: c.name })),
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
    const summary = await fetchSummary(summaryFiltersFromRequest(req));
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
    const summary = await fetchSummary(summaryFiltersFromRequest(req));
    await writeAudit({
      userId: req.user!.userId,
      actionType: "ReportExported",
      targetTable: "Reports",
      newValue: { format, filters: summary.filters },
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
