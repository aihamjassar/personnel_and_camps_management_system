import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/error.js";

export interface AssignmentInput {
  personnel_id: number;
  unit_id: number;
  position_id: number;
  start_date?: Date;
  end_date?: Date | null;
  notes?: string;
  user_id: number;
  ip_address?: string;
}

/** Synchronizes assignment, personnel unit/camp pointers, and audit history in one transaction. */
export async function createAssignment(input: AssignmentInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ personnel_id: number }>>`SELECT personnel_id FROM personnel WHERE personnel_id = ${input.personnel_id} FOR UPDATE`;
    const person = await tx.personnel.findUnique({ where: { personnel_id: input.personnel_id } });
    if (!person || person.deleted_at || !person.is_active) throw new HttpError(404, "Personnel record not found");
    const unit = await tx.organizationalUnit.findUnique({ where: { unit_id: input.unit_id } });
    if (!unit) throw new HttpError(404, "Organizational unit not found");
    const position = await tx.position.findUnique({ where: { position_id: input.position_id } });
    if (!position) throw new HttpError(404, "Position not found");
    if (position.unit_id !== null && position.unit_id !== unit.unit_id) {
      throw new HttpError(400, "Position does not belong to the selected unit");
    }

    const assignmentStart = input.start_date ?? new Date();
    await tx.assignment.updateMany({
      where: { personnel_id: input.personnel_id, end_date: null },
      data: { end_date: assignmentStart },
    });
    const assignment = await tx.assignment.create({
      data: {
        personnel_id: input.personnel_id,
        unit_id: input.unit_id,
        position_id: input.position_id,
        start_date: assignmentStart,
        end_date: input.end_date ?? null,
        notes: input.notes,
      },
      include: {
        personnel: { select: { personnel_id: true, full_name: true } },
        unit: { select: { unit_id: true, name: true, camp_id: true, camp: { select: { camp_id: true, name: true } } } },
        position: { select: { position_id: true, name: true } },
      },
    });
    await tx.personnel.update({
      where: { personnel_id: person.personnel_id },
      data: { unit_id: unit.unit_id, camp_id: unit.camp_id },
    });
    await tx.auditLog.create({
      data: {
        user_id: input.user_id,
        action_type: "AssignmentCreated",
        target_table: "Assignments",
        target_id: assignment.assignment_id,
        ip_address: input.ip_address ?? null,
        old_value: { personnel_id: person.personnel_id, unit_id: person.unit_id, camp_id: person.camp_id },
        new_value: { personnel_id: person.personnel_id, assignment_id: assignment.assignment_id, unit_id: unit.unit_id, camp_id: unit.camp_id },
      },
    });
    return assignment;
  }, { maxWait: 5000, timeout: 10000 });
}
