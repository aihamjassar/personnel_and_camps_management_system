import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

// Integration-layer audit writer (memory.md §7.4): routes/services call this
// server-side only; the frontend can never trigger or skip it.
// AuditLogs are append-only — this module exposes create + read, never update/delete.

export interface AuditEntry {
  userId: number | null;
  actionType: string;
  targetTable: string;
  targetId?: number | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: entry.userId,
        action_type: entry.actionType,
        target_table: entry.targetTable,
        target_id: entry.targetId ?? null,
        old_value: (entry.oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
        new_value: (entry.newValue ?? undefined) as Prisma.InputJsonValue | undefined,
        ip_address: entry.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Never let audit failure mask the original operation result,
    // but do surface it in server logs.
    console.error("[audit] failed to write audit log:", err);
  }
}
