import { HttpError } from "../middleware/error.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { createNotifications, notifyPermissionHolders } from "../lib/notifications.js";

export interface TransferInput {
  personnel_id: number;
  camp_from_id: number;
  camp_to_id: number;
  unit_to_id: number;
  reason?: string;
  user_id: number;
  ip_address?: string;
}

/** Coordinates the personnel, camp/unit, transfer, and audit modules in one DB transaction. */
export async function executeTransfer(input: TransferInput) {
  try {
    // FR-15: notify on submission before the atomic transaction runs.
    await notifyPermissionHolders(
      "transfers.manage",
      "طلب انتقال جديد",
      `قدّم مستخدم رقم ${input.user_id} طلب نقل للفرد رقم ${input.personnel_id} إلى معسكر ${input.camp_to_id}.`,
      input.user_id,
    );
    const result = await prisma.$transaction(async (tx) => {
    // Lock the person so two concurrent requests cannot transfer the same record twice.
    await tx.$queryRaw<Array<{ personnel_id: number }>>`SELECT personnel_id FROM personnel WHERE personnel_id = ${input.personnel_id} FOR UPDATE`;

    const person = await tx.personnel.findUnique({ where: { personnel_id: input.personnel_id } });
    if (!person || person.deleted_at || !person.is_active) throw new HttpError(404, "Personnel record not found");
    if (person.camp_id !== input.camp_from_id) throw new HttpError(409, "Personnel is no longer assigned to the stated source camp");
    if (input.camp_from_id === input.camp_to_id) throw new HttpError(400, "Source and destination camps must be different");

    // Serialize capacity checks for the destination camp; subsequent transactions see the committed count.
    const lockedCamp = await tx.$queryRaw<Array<{ camp_id: number }>>`SELECT camp_id FROM camps WHERE camp_id = ${input.camp_to_id} FOR UPDATE`;
    if (!lockedCamp.length) throw new HttpError(404, "Destination camp not found");
    const sourceCamp = await tx.camp.findUnique({ where: { camp_id: input.camp_from_id } });
    const unit = await tx.organizationalUnit.findUnique({ where: { unit_id: input.unit_to_id } });
    if (!sourceCamp) throw new HttpError(404, "Source camp not found");
    if (!sourceCamp.is_active) throw new HttpError(400, "Source camp is inactive");
    if (!unit || unit.camp_id !== input.camp_to_id) throw new HttpError(400, "Destination unit does not belong to the destination camp");
    const destination = await tx.camp.findUnique({ where: { camp_id: input.camp_to_id } });
    if (!destination || !destination.is_active) throw new HttpError(400, "Destination camp is inactive");

    const occupancy = await tx.personnel.count({
      where: { camp_id: destination.camp_id, is_active: true, deleted_at: null },
    });
    if (occupancy >= destination.capacity) {
      throw new HttpError(409, "Destination camp has reached its capacity");
    }

    const now = new Date();
    const updatedPerson = await tx.personnel.update({
      where: { personnel_id: person.personnel_id },
      data: { camp_id: destination.camp_id, unit_id: unit.unit_id },
      include: {
        camp: { select: { camp_id: true, name: true } },
        unit: { select: { unit_id: true, name: true } },
      },
    });
    const transfer = await tx.transfer.create({
      data: {
        personnel_id: person.personnel_id,
        camp_from_id: sourceCamp.camp_id,
        camp_to_id: destination.camp_id,
        requested_by: input.user_id,
        status: "completed",
        reason: input.reason ?? null,
        requested_at: now,
        processed_at: now,
      },
      include: {
        personnel: { select: { personnel_id: true, full_name: true } },
        camp_from: { select: { camp_id: true, name: true } },
        camp_to: { select: { camp_id: true, name: true } },
      },
    });

    // Audit entry is part of this transaction: a transfer cannot commit without its audit record.
    await tx.auditLog.create({
      data: {
        user_id: input.user_id,
        action_type: "PersonnelTransferred",
        target_table: "Transfers",
        target_id: transfer.transfer_id,
        ip_address: input.ip_address ?? null,
        old_value: { personnel_id: person.personnel_id, camp_id: person.camp_id, unit_id: person.unit_id },
        new_value: { personnel_id: person.personnel_id, camp_id: destination.camp_id, unit_id: unit.unit_id, transfer_id: transfer.transfer_id },
      },
    });
    return { transfer, personnel: updatedPerson };
    }, { maxWait: 5000, timeout: 10000 });

    // Notifications (FR-15): announced to transfers holders on submit, result to requester.
    await notifyPermissionHolders(
      "transfers.manage",
      "تم قبول طلب انتقال",
      `تم نقل الفرد رقم ${input.personnel_id} من معسكر ${input.camp_from_id} إلى معسكر ${input.camp_to_id}.`,
      input.user_id,
    );
    await createNotifications(
      [input.user_id],
      "تم قبول طلب النقل",
      `اكتمل نقل الفرد رقم ${input.personnel_id} إلى المعسكر الهدف بنجاح وسُجّل في سجل التدقيق.`,
    );
    return result;
  } catch (err) {
    if (err instanceof HttpError && err.statusCode >= 400 && err.statusCode < 500) {
      await writeAudit({
        userId: input.user_id,
        actionType: "PersonnelTransferRejected",
        targetTable: "Transfers",
        targetId: input.personnel_id,
        oldValue: { personnel_id: input.personnel_id, camp_from_id: input.camp_from_id },
        newValue: { camp_to_id: input.camp_to_id, unit_to_id: input.unit_to_id, reason: err.message },
        ipAddress: input.ip_address,
      });
      await createNotifications(
        [input.user_id],
        "رُفض طلب النقل",
        `تعذّر تنفيذ النقل: ${err.message}`,
      );
    }
    throw err;
  }
}
