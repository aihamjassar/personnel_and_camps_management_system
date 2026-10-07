import { describe, expect, it } from "vitest";
import {
  assignmentSchema,
  campSchema,
  createPersonnelSchema,
  createUserSchema,
  listQuerySchema,
  loginSchema,
  positionSchema,
  rankSchema,
  rolePermissionsSchema,
  statusChangeSchema,
  transferSchema,
  unitSchema,
  updatePersonnelSchema,
  updateUserSchema,
} from "../../src/validators/schemas.js";

describe("request schemas (independent validation units)", () => {
  it("validates login credentials", () => {
    expect(loginSchema.safeParse({ username: "admin", password: "secret" }).success).toBe(true);
    expect(loginSchema.safeParse({ username: "", password: "secret" }).success).toBe(false);
  });

  it("validates personnel creation and enumerated fields", () => {
    expect(createPersonnelSchema.safeParse({ full_name: "Synthetic Person", gender: "female" }).success).toBe(true);
    expect(createPersonnelSchema.safeParse({ full_name: "Synthetic Person", gender: "other" }).success).toBe(false);
  });

  it("requires at least one valid personnel update", () => {
    expect(updatePersonnelSchema.safeParse({}).success).toBe(false);
    expect(updatePersonnelSchema.safeParse({ email: null }).success).toBe(true);
  });

  it("accepts only known personnel statuses", () => {
    expect(statusChangeSchema.safeParse({ status: "on_leave" }).success).toBe(true);
    expect(statusChangeSchema.safeParse({ status: "unknown" }).success).toBe(false);
  });

  it("coerces list query values and supplies safe pagination defaults", () => {
    expect(listQuerySchema.parse({})).toMatchObject({ page: 1, page_size: 20 });
    expect(listQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });

  it("validates camp names and applies the zero-capacity default", () => {
    expect(campSchema.parse({ name: "Demo Camp" }).capacity).toBe(0);
    expect(campSchema.safeParse({ name: "Demo Camp", capacity: -1 }).success).toBe(false);
  });

  it("requires a camp for an organizational unit", () => {
    expect(unitSchema.safeParse({ name: "Synthetic Unit", camp_id: 1 }).success).toBe(true);
    expect(unitSchema.safeParse({ name: "Synthetic Unit" }).success).toBe(false);
  });

  it("requires a positive rank level", () => {
    expect(rankSchema.safeParse({ name: "Rank", level: 1 }).success).toBe(true);
    expect(rankSchema.safeParse({ name: "Rank", level: 0 }).success).toBe(false);
  });

  it("accepts an optional organizational-unit position reference", () => {
    expect(positionSchema.safeParse({ name: "Position" }).success).toBe(true);
    expect(positionSchema.safeParse({ name: "Position", unit_id: -1 }).success).toBe(false);
  });

  it("validates assignment links and dates", () => {
    expect(assignmentSchema.safeParse({ personnel_id: 1, unit_id: 1, position_id: 1, start_date: "2026-01-01" }).success).toBe(true);
    expect(assignmentSchema.safeParse({ personnel_id: 0, unit_id: 1, position_id: 1 }).success).toBe(false);
  });

  it("validates new user credentials and defaults the role list", () => {
    expect(createUserSchema.parse({ username: "demo_user", password: "Synthetic9!", full_name: "Demo User" }).role_ids).toEqual([]);
    expect(createUserSchema.safeParse({ username: "ab", password: "short", full_name: "Demo" }).success).toBe(false);
  });

  it("requires a meaningful user update and allows deactivation", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
    expect(updateUserSchema.safeParse({ is_active: false }).success).toBe(true);
  });

  it("rejects transfers between identical source and destination camps", () => {
    const transfer = { personnel_id: 1, camp_from_id: 2, camp_to_id: 2, unit_to_id: 3 };
    expect(transferSchema.safeParse(transfer).success).toBe(false);
    expect(transferSchema.safeParse({ ...transfer, camp_to_id: 4 }).success).toBe(true);
  });

  it("bounds role-permission assignments", () => {
    expect(rolePermissionsSchema.safeParse({ permission_ids: [1, 2] }).success).toBe(true);
    expect(rolePermissionsSchema.safeParse({ permission_ids: Array.from({ length: 101 }, (_, i) => i + 1) }).success).toBe(false);
  });
});
