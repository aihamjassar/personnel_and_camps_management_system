import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();

let adminToken = "";
let officerToken = "";
let viewerToken = "";

async function login(username: string, password: string): Promise<string> {
  const res = await request(app).post("/api/v1/auth/login").send({ username, password });
  expect(res.status).toBe(200);
  return res.body.data.token;
}

beforeAll(async () => {
  await prisma.permission.createMany({
    data: [
      { permission_key: "personnel.manage" },
      { permission_key: "camps.manage" },
      { permission_key: "units.manage" },
      { permission_key: "ranks.manage" },
      { permission_key: "positions.manage" },
      { permission_key: "assignments.manage" },
      { permission_key: "transfers.manage" },
      { permission_key: "reports.view" },
      { permission_key: "users.manage" },
      { permission_key: "system.admin" },
      { permission_key: "audit.view" },
    ],
    skipDuplicates: true,
  });
  const perms = await prisma.permission.findMany();
  const adminRole = await prisma.role.create({ data: { role_name: "admin-test" } });
  await prisma.rolePermission.createMany({
    data: perms.map((p) => ({ role_id: adminRole.role_id, permission_id: p.permission_id })),
  });
  const officerRole = await prisma.role.create({ data: { role_name: "officer-test" } });
  const personnelPerm = perms.find((p) => p.permission_key === "personnel.manage")!;
  await prisma.rolePermission.create({
    data: { role_id: officerRole.role_id, permission_id: personnelPerm.permission_id },
  });
  const viewerRole = await prisma.role.create({ data: { role_name: "report-viewer-test" } });
  const reportsPerm = perms.find((p) => p.permission_key === "reports.view")!;
  await prisma.rolePermission.create({
    data: { role_id: viewerRole.role_id, permission_id: reportsPerm.permission_id },
  });
  await prisma.user.createMany({
    data: [
      { username: "admin_t", password_hash: await bcrypt.hash("Admin@1234", 10), full_name: "Admin" },
      { username: "officer_t", password_hash: await bcrypt.hash("Off@12345", 10), full_name: "Officer" },
      { username: "viewer_t", password_hash: await bcrypt.hash("View@12345", 10), full_name: "Viewer" },
      { username: "disabled_t", password_hash: await bcrypt.hash("Dis@12345", 10), full_name: "Disabled", is_active: false },
    ],
  });
  await prisma.userRole.createMany({
    data: [
      { user_id: (await prisma.user.findUniqueOrThrow({ where: { username: "admin_t" } })).user_id, role_id: adminRole.role_id },
      { user_id: (await prisma.user.findUniqueOrThrow({ where: { username: "officer_t" } })).user_id, role_id: officerRole.role_id },
      { user_id: (await prisma.user.findUniqueOrThrow({ where: { username: "viewer_t" } })).user_id, role_id: viewerRole.role_id },
    ],
  });
  adminToken = await login("admin_t", "Admin@1234");
  officerToken = await login("officer_t", "Off@12345");
  viewerToken = await login("viewer_t", "View@12345");
});

describe("auth", () => {
  it("rejects wrong credentials with generic 401 (no field leak)", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ username: "admin_t", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.status).toBe("fail");
    expect(JSON.stringify(res.body.error)).not.toContain("password");
  });

  it("rejects disabled accounts", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ username: "disabled_t", password: "Dis@12345" });
    expect(res.status).toBe(401);
  });

  it("returns unified envelope on /me", async () => {
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "success", error: null });
  });

  it("denies session restoration to an authenticated account with no permissions", async () => {
    await prisma.user.create({ data: { username: "no_permissions", password_hash: await bcrypt.hash("NoPerm@12345", 10), full_name: "No Permissions" } });
    const token = await login("no_permissions", "NoPerm@12345");
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

    it("rejects requests without a token", async () => {
      const res = await request(app).get("/api/v1/personnel");
      expect(res.status).toBe(401);
      expect(res.body.status).toBe("fail");
    });

    it("rejects malformed bearer tokens", async () => {
      const res = await request(app).get("/api/v1/personnel").set("Authorization", "Bearer not-a-jwt");
      expect(res.status).toBe(401);
      expect(res.body.status).toBe("fail");
    });
});

describe("personnel", () => {
  it("creates, lists, updates personnel with the unified envelope", async () => {
    const create = await request(app)
      .post("/api/v1/personnel")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ full_name: "Ahmed Saleh", national_id: "N-1001", phone: "777" });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe("success");
    const id = create.body.data.personnel_id;

    const list = await request(app)
      .get("/api/v1/personnel?search=Ahmed")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.items.some((p: { personnel_id: number }) => p.personnel_id === id)).toBe(true);

    const update = await request(app)
      .put(`/api/v1/personnel/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ phone: "888" });
    expect(update.status).toBe(200);
    expect(update.body.data.phone).toBe("888");
  });

  it("enforces RBAC: officer without reports.view cannot read reports", async () => {
    const res = await request(app)
      .get("/api/v1/reports/summary")
      .set("Authorization", `Bearer ${officerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.status).toBe("fail");
  });

  it("appends status history without overwriting old rows (memory.md §7.2)", async () => {
    const create = await request(app)
      .post("/api/v1/personnel")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ full_name: "Status Test" });
    const id = create.body.data.personnel_id;

    await request(app)
      .post(`/api/v1/personnel/${id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "on_leave", notes: "vacation" });
    await request(app)
      .post(`/api/v1/personnel/${id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "active" });

    const history = await request(app)
      .get(`/api/v1/personnel/${id}/status`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(history.body.data.items).toHaveLength(3); // initial + 2 changes
    const statuses = history.body.data.items.map((s: { status: string }) => s.status);
    expect(statuses).toContain("on_leave");
  });

  it("soft-deletes: record disappears from list but row persists", async () => {
    const create = await request(app)
      .post("/api/v1/personnel")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ full_name: "Delete Test" });
    const id = create.body.data.personnel_id;

    const del = await request(app)
      .delete(`/api/v1/personnel/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    const list = await request(app)
      .get(`/api/v1/personnel?search=Delete Test`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.data.items).toHaveLength(0);
    expect(await prisma.personnel.findUnique({ where: { personnel_id: id } })).not.toBeNull();
  });

  it("returns 400 with field details on invalid input", async () => {
    const res = await request(app)
      .post("/api/v1/personnel")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ full_name: "" });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe("fail");
    expect(res.body.error.details).toBeDefined();
  });
});

describe("Phase 1 reference data and assignments", () => {
  it("supports CRUD for camps, units, ranks, and positions", async () => {
    const camp = await request(app)
      .post("/api/v1/camps")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "CRUD Test Camp", capacity: 25, location: "Sandbox only" });
    expect(camp.status).toBe(201);
    const campId = camp.body.data.camp_id as number;

    const unit = await request(app)
      .post("/api/v1/units")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "CRUD Test Unit", camp_id: campId });
    expect(unit.status).toBe(201);
    const unitId = unit.body.data.unit_id as number;

    const rank = await request(app)
      .post("/api/v1/ranks")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "CRUD Test Rank", level: 91 });
    expect(rank.status).toBe(201);
    const rankId = rank.body.data.rank_id as number;

    const position = await request(app)
      .post("/api/v1/positions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "CRUD Test Position", unit_id: unitId });
    expect(position.status).toBe(201);
    const positionId = position.body.data.position_id as number;

    const list = await request(app).get("/api/v1/camps").set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.items.some((item: { camp_id: number }) => item.camp_id === campId)).toBe(true);

    expect((await request(app).put(`/api/v1/camps/${campId}`).set("Authorization", `Bearer ${adminToken}`).send({ capacity: 26 })).status).toBe(200);
    expect((await request(app).put(`/api/v1/units/${unitId}`).set("Authorization", `Bearer ${adminToken}`).send({ name: "CRUD Updated Unit" })).status).toBe(200);
    expect((await request(app).put(`/api/v1/ranks/${rankId}`).set("Authorization", `Bearer ${adminToken}`).send({ description: "Synthetic update" })).status).toBe(200);
    expect((await request(app).put(`/api/v1/positions/${positionId}`).set("Authorization", `Bearer ${adminToken}`).send({ name: "CRUD Updated Position" })).status).toBe(200);

    expect((await request(app).delete(`/api/v1/positions/${positionId}`).set("Authorization", `Bearer ${adminToken}`)).status).toBe(200);
    expect((await request(app).delete(`/api/v1/ranks/${rankId}`).set("Authorization", `Bearer ${adminToken}`)).status).toBe(200);
    expect((await request(app).delete(`/api/v1/units/${unitId}`).set("Authorization", `Bearer ${adminToken}`)).status).toBe(200);
    expect((await request(app).delete(`/api/v1/camps/${campId}`).set("Authorization", `Bearer ${adminToken}`)).status).toBe(200);
  });

  it("keeps unit parents in the same camp and prevents hierarchy cycles", async () => {
    const campA = await prisma.camp.create({ data: { name: "Hierarchy Camp A", capacity: 10 } });
    const campB = await prisma.camp.create({ data: { name: "Hierarchy Camp B", capacity: 10 } });
    const parent = await prisma.organizationalUnit.create({ data: { name: "Hierarchy Parent", camp_id: campA.camp_id } });
    const child = await request(app)
      .post("/api/v1/units")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Hierarchy Child", camp_id: campA.camp_id, parent_unit_id: parent.unit_id });
    expect(child.status).toBe(201);

    const crossCamp = await request(app)
      .post("/api/v1/units")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Invalid Cross-Camp Child", camp_id: campB.camp_id, parent_unit_id: parent.unit_id });
    expect(crossCamp.status).toBe(400);

    const selfParent = await request(app)
      .put(`/api/v1/units/${parent.unit_id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ parent_unit_id: parent.unit_id });
    expect(selfParent.status).toBe(400);

    const cycle = await request(app)
      .put(`/api/v1/units/${parent.unit_id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ parent_unit_id: child.body.data.unit_id });
    expect(cycle.status).toBe(400);

    const incompatibleCampChange = await request(app)
      .put(`/api/v1/units/${child.body.data.unit_id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ camp_id: campB.camp_id });
    expect(incompatibleCampChange.status).toBe(400);
  });

  it("creates assignments and transactionally closes the prior current assignment", async () => {
    const camp1 = await prisma.camp.create({ data: { name: "Assignment Test Camp A", capacity: 10 } });
    const camp2 = await prisma.camp.create({ data: { name: "Assignment Test Camp B", capacity: 10 } });
    const unit1 = await prisma.organizationalUnit.create({ data: { name: "Assignment Test Unit A", camp_id: camp1.camp_id } });
    const unit2 = await prisma.organizationalUnit.create({ data: { name: "Assignment Test Unit B", camp_id: camp2.camp_id } });
    const position1 = await prisma.position.create({ data: { name: "Assignment Test Position A", unit_id: unit1.unit_id } });
    const position2 = await prisma.position.create({ data: { name: "Assignment Test Position B", unit_id: unit2.unit_id } });
    const person = await request(app)
      .post("/api/v1/personnel")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ full_name: "Assignment Test Person" });
    expect(person.status).toBe(201);
    const personnelId = person.body.data.personnel_id as number;

    const first = await request(app)
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ personnel_id: personnelId, unit_id: unit1.unit_id, position_id: position1.position_id, start_date: "2025-01-01T00:00:00.000Z" });
    expect(first.status).toBe(201);
    const second = await request(app)
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ personnel_id: personnelId, unit_id: unit2.unit_id, position_id: position2.position_id, start_date: "2025-02-01T00:00:00.000Z" });
    expect(second.status).toBe(201);
    expect(second.body.data.personnel.full_name).toBe("Assignment Test Person");

    const prior = await prisma.assignment.findUniqueOrThrow({ where: { assignment_id: first.body.data.assignment_id } });
    expect(prior.end_date?.toISOString()).toBe("2025-02-01T00:00:00.000Z");
    const assignments = await request(app).get("/api/v1/assignments").set("Authorization", `Bearer ${adminToken}`);
    expect(assignments.status).toBe(200);
    expect(assignments.body.data.items.filter((item: { personnel_id: number; end_date: string | null }) => item.personnel_id === personnelId && item.end_date === null)).toHaveLength(1);
    const persistedPerson = await prisma.personnel.findUniqueOrThrow({ where: { personnel_id: personnelId } });
    expect(persistedPerson.unit_id).toBe(unit2.unit_id);
    expect(persistedPerson.camp_id).toBe(camp2.camp_id);
    expect(await prisma.auditLog.count({ where: { action_type: "AssignmentCreated", target_id: second.body.data.assignment_id } })).toBe(1);
  });

  it("allows assignment-only users to load minimal eligible personnel choices", async () => {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { permission_key: "assignments.manage" } });
    const role = await prisma.role.create({ data: { role_name: "assignment-only-test" } });
    await prisma.rolePermission.create({ data: { role_id: role.role_id, permission_id: permission.permission_id } });
    const user = await prisma.user.create({
      data: { username: "assignment_only_t", password_hash: await bcrypt.hash("Assignment@123", 10), full_name: "Assignment Only" },
    });
    await prisma.userRole.create({ data: { user_id: user.user_id, role_id: role.role_id } });
    const token = await login("assignment_only_t", "Assignment@123");
    const candidate = await prisma.personnel.create({ data: { full_name: "Eligible Assignment Person" } });

    const response = await request(app)
      .get("/api/v1/assignments/eligible-personnel")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    const listedCandidate = response.body.data.items.find((item: { personnel_id: number }) => item.personnel_id === candidate.personnel_id);
    expect(listedCandidate).toEqual({ personnel_id: candidate.personnel_id, full_name: "Eligible Assignment Person" });
  });
});

describe("RBAC coverage", () => {
  it("allows reference reads needed for personnel work but denies unrelated roles", async () => {
    for (const endpoint of ["/camps", "/units", "/ranks", "/positions"]) {
      const permitted = await request(app)
        .get(`/api/v1${endpoint}`)
        .set("Authorization", `Bearer ${officerToken}`);
      expect(permitted.status, endpoint).toBe(200);
      const denied = await request(app)
        .get(`/api/v1${endpoint}`)
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(denied.status, endpoint).toBe(403);
    }

    for (const endpoint of ["/assignments", "/personnel"]) {
      const denied = await request(app)
        .get(`/api/v1${endpoint}`)
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(denied.status, endpoint).toBe(403);
      expect(denied.body.status, endpoint).toBe("fail");
    }
    const assignmentsDeniedForOfficer = await request(app)
      .get("/api/v1/assignments")
      .set("Authorization", `Bearer ${officerToken}`);
    expect(assignmentsDeniedForOfficer.status).toBe(403);
  });

  it("exposes only minimal health status publicly", async () => {
    const anonymous = await request(app).get("/api/v1/health");
    expect(anonymous.status).toBe(200);
    expect(anonymous.body).toEqual({ status: "success", data: { ok: true }, error: null });
    const officer = await request(app).get("/api/v1/health").set("Authorization", `Bearer ${officerToken}`);
    expect(officer.status).toBe(200);
    const admin = await request(app).get("/api/v1/health").set("Authorization", `Bearer ${adminToken}`);
    expect(admin.status).toBe(200);
  });

  it("denies transfer and role administration routes to accounts without their permissions", async () => {
    for (const [method, endpoint] of [["get", "/api/v1/transfers"], ["get", "/api/v1/transfers/eligible-personnel"], ["post", "/api/v1/transfers"], ["get", "/api/v1/roles"], ["get", "/api/v1/roles/permissions"]] as const) {
      const res = await request(app)[method](endpoint).set("Authorization", `Bearer ${viewerToken}`).send({});
      expect(res.status, `${method.toUpperCase()} ${endpoint}`).toBe(403);
    }
    const officerTransfer = await request(app).get("/api/v1/transfers").set("Authorization", `Bearer ${officerToken}`);
    expect(officerTransfer.status).toBe(403);
  });
});

describe("Phase 2 transfers", () => {
  it("moves a person and writes transfer plus audit atomically", async () => {
    const source = await prisma.camp.create({ data: { name: "Transfer Source Camp", capacity: 10 } });
    const destination = await prisma.camp.create({ data: { name: "Transfer Destination Camp", capacity: 2 } });
    const sourceUnit = await prisma.organizationalUnit.create({ data: { name: "Transfer Source Unit", camp_id: source.camp_id } });
    const destinationUnit = await prisma.organizationalUnit.create({ data: { name: "Transfer Destination Unit", camp_id: destination.camp_id } });
    const personRes = await request(app).post("/api/v1/personnel").set("Authorization", `Bearer ${adminToken}`).send({ full_name: "Transfer Academic Person", camp_id: source.camp_id, unit_id: sourceUnit.unit_id });
    expect(personRes.status).toBe(201);
    const personnelId = personRes.body.data.personnel_id as number;

    const transfer = await request(app).post("/api/v1/transfers").set("Authorization", `Bearer ${adminToken}`).send({
      personnel_id: personnelId,
      camp_from_id: source.camp_id,
      camp_to_id: destination.camp_id,
      unit_to_id: destinationUnit.unit_id,
      reason: "Academic test transfer",
    });
    expect(transfer.status).toBe(201);
    expect(transfer.body.data.transfer).toMatchObject({ status: "completed", camp_from_id: source.camp_id, camp_to_id: destination.camp_id });
    expect(transfer.body.data.personnel).toMatchObject({ camp_id: destination.camp_id, unit_id: destinationUnit.unit_id });
    expect(await prisma.transfer.count({ where: { personnel_id: personnelId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action_type: "PersonnelTransferred", target_id: transfer.body.data.transfer.transfer_id } })).toBe(1);

    const fullCamp = await prisma.camp.create({ data: { name: "Transfer Full Camp", capacity: 1 } });
    const fullUnit = await prisma.organizationalUnit.create({ data: { name: "Transfer Full Unit", camp_id: fullCamp.camp_id } });
    const occupant = await prisma.personnel.create({ data: { full_name: "Synthetic Occupant", camp_id: fullCamp.camp_id } });
    const failure = await request(app).post("/api/v1/transfers").set("Authorization", `Bearer ${adminToken}`).send({
      personnel_id: personnelId,
      camp_from_id: destination.camp_id,
      camp_to_id: fullCamp.camp_id,
      unit_to_id: fullUnit.unit_id,
      reason: "Should be rejected because full",
    });
    expect(failure.status).toBe(409);
    expect(failure.body.error.message).toContain("capacity");
    expect((await prisma.personnel.findUniqueOrThrow({ where: { personnel_id: personnelId } })).camp_id).toBe(destination.camp_id);
    expect(await prisma.transfer.count({ where: { personnel_id: personnelId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action_type: "PersonnelTransferRejected", target_id: personnelId } })).toBe(1);

    const invalidUnit = await request(app).post("/api/v1/transfers").set("Authorization", `Bearer ${adminToken}`).send({
      personnel_id: personnelId, camp_from_id: destination.camp_id, camp_to_id: source.camp_id, unit_to_id: fullUnit.unit_id,
    });
    expect(invalidUnit.status).toBe(400);
    expect(await prisma.personnel.count({ where: { personnel_id: personnelId, camp_id: destination.camp_id } })).toBe(1);
    expect(await prisma.personnel.findUniqueOrThrow({ where: { personnel_id: occupant.personnel_id } })).not.toBeNull();

    const raceSource = await prisma.camp.create({ data: { name: "Transfer Race Source", capacity: 5 } });
    const raceDestination = await prisma.camp.create({ data: { name: "Transfer Race Destination", capacity: 1 } });
    const raceSourceUnit = await prisma.organizationalUnit.create({ data: { name: "Transfer Race Source Unit", camp_id: raceSource.camp_id } });
    const raceDestinationUnit = await prisma.organizationalUnit.create({ data: { name: "Transfer Race Destination Unit", camp_id: raceDestination.camp_id } });
    const racePeople = await Promise.all(["One", "Two"].map((suffix) => prisma.personnel.create({ data: { full_name: `Transfer Race Person ${suffix}`, camp_id: raceSource.camp_id, unit_id: raceSourceUnit.unit_id } })));
    const concurrent = await Promise.all(racePeople.map((person) => request(app).post("/api/v1/transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ personnel_id: person.personnel_id, camp_from_id: raceSource.camp_id, camp_to_id: raceDestination.camp_id, unit_to_id: raceDestinationUnit.unit_id })));
    expect(concurrent.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await prisma.personnel.count({ where: { camp_id: raceDestination.camp_id } })).toBe(1);
  });
});

describe("dynamic role permissions", () => {
  it("applies permission changes immediately and preserves an active administrator", async () => {
    const viewerRole = await prisma.role.findUniqueOrThrow({ where: { role_name: "report-viewer-test" } });
    const personnelPermission = await prisma.permission.findUniqueOrThrow({ where: { permission_key: "personnel.manage" } });
    const changed = await request(app).put(`/api/v1/roles/${viewerRole.role_id}/permissions`)
      .set("Authorization", `Bearer ${adminToken}`).send({ permission_ids: [personnelPermission.permission_id] });
    expect(changed.status).toBe(200);
    // The token predates this update; auth loads current RBAC rows for every request.
    const newlyAllowed = await request(app).get("/api/v1/personnel").set("Authorization", `Bearer ${viewerToken}`);
    expect(newlyAllowed.status).toBe(200);

    const revoked = await request(app).put(`/api/v1/roles/${viewerRole.role_id}/permissions`)
      .set("Authorization", `Bearer ${adminToken}`).send({ permission_ids: [] });
    expect(revoked.status).toBe(200);
    const newlyDenied = await request(app).get("/api/v1/personnel").set("Authorization", `Bearer ${viewerToken}`);
    expect(newlyDenied.status).toBe(403);

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { role_name: "admin-test" } });
    const noAdminPermission = await request(app).put(`/api/v1/roles/${adminRole.role_id}/permissions`)
      .set("Authorization", `Bearer ${adminToken}`).send({ permission_ids: [personnelPermission.permission_id] });
    expect(noAdminPermission.status).toBe(409);
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: "admin_t" } });
    const disableLastAdmin = await request(app).put(`/api/v1/users/${adminUser.user_id}`)
      .set("Authorization", `Bearer ${adminToken}`).send({ is_active: false });
    expect(disableLastAdmin.status).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { user_id: adminUser.user_id } })).is_active).toBe(true);
    expect(await prisma.auditLog.count({ where: { action_type: "RolePermissionsChanged", target_id: viewerRole.role_id } })).toBe(2);
  });
});

describe("users", () => {
  it("creates and updates accounts while never exposing password hashes", async () => {
    const listed = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.items.every((user: { password_hash?: string }) => !("password_hash" in user))).toBe(true);

    const viewerRole = await prisma.role.findUniqueOrThrow({ where: { role_name: "report-viewer-test" } });
    const created = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "created_viewer", password: "Viewer@12345", full_name: "Created Viewer", email: "created.viewer@example.test", role_ids: [viewerRole.role_id] });
    expect(created.status).toBe(201);
    expect(created.body.data.password_hash).toBeUndefined();
    expect(created.body.data.roles[0].role.role_name).toBe("report-viewer-test");

    const successfulUpdate = await request(app)
      .put(`/api/v1/users/${created.body.data.user_id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ full_name: "Updated Viewer", is_active: false });
    expect(successfulUpdate.status).toBe(200);
    expect(successfulUpdate.body.data.full_name).toBe("Updated Viewer");
    expect(successfulUpdate.body.data.is_active).toBe(false);
    expect(successfulUpdate.body.data.password_hash).toBeUndefined();

    const target = await prisma.user.findUniqueOrThrow({ where: { username: "disabled_t" } });
    const empty = await request(app)
      .put(`/api/v1/users/${target.user_id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(empty.status).toBe(400);

    const invalid = await request(app)
      .put(`/api/v1/users/${target.user_id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: "short", is_active: "yes" });
    expect(invalid.status).toBe(400);
  });
});

describe("audit", () => {
  it("applies both inclusive date bounds and rejects invalid ranges", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin_t" } });
    const timestamps = [
      new Date("2026-01-01T23:59:59.999Z"),
      new Date("2026-01-02T12:00:00.000Z"),
      new Date("2026-01-03T00:00:00.000Z"),
    ];
    await prisma.auditLog.createMany({
      data: timestamps.map((created_at, index) => ({
        user_id: admin.user_id,
        action_type: `AuditRange${index}`,
        target_table: "AuditRangeFixture",
        created_at,
      })),
    });

    const ranged = await request(app)
      .get("/api/v1/audit?target_table=AuditRangeFixture&from=2026-01-02T00:00:00.000Z&to=2026-01-02T23:59:59.999Z")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(ranged.status).toBe(200);
    expect(ranged.body.data.items.map((item: { action_type: string }) => item.action_type)).toEqual(["AuditRange1"]);

    const invalid = await request(app)
      .get("/api/v1/audit?from=not-a-date")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);

    const reversed = await request(app)
      .get("/api/v1/audit?from=2026-02-01&to=2026-01-01")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(reversed.status).toBe(400);
  });

  it("records login and personnel events, admin-only access", async () => {
    const denied = await request(app)
      .get("/api/v1/audit")
      .set("Authorization", `Bearer ${officerToken}`);
    expect(denied.status).toBe(403);

    const loginEvents = await request(app)
      .get("/api/v1/audit?action_type=UserLoginSucceeded&page_size=100")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(loginEvents.status).toBe(200);
    expect(loginEvents.body.data.items.some((item: { action_type: string }) => item.action_type === "UserLoginSucceeded")).toBe(true);

    const personnelEvents = await request(app)
      .get("/api/v1/audit?action_type=PersonnelCreated&page_size=100")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(personnelEvents.status).toBe(200);
    expect(personnelEvents.body.data.items.some((item: { action_type: string }) => item.action_type === "PersonnelCreated")).toBe(true);
  });

  it("enforces the configured login rate limit after repeated failed attempts", async () => {
    const attempts = await Promise.all(Array.from({ length: 21 }, () => request(app)
      .post("/api/v1/auth/login")
      .set("X-Forwarded-For", "198.51.100.77")
      .send({ username: "missing_rate_test", password: "not-correct" })));
    expect(attempts.slice(0, 20).every((res) => res.status === 401)).toBe(true);
    expect(attempts[20].status).toBe(429);
    expect(attempts[20].body.status).toBe("fail");
  });
});

describe("Phase 3 advanced features", () => {
  it("notifies the requester on transfer accept/reject and officers on sensitive status changes", async () => {
    const source = await prisma.camp.create({ data: { name: "Phase3 Source Camp", capacity: 10 } });
    const destination = await prisma.camp.create({ data: { name: "Phase3 Destination Camp", capacity: 10 } });
    const unit = await prisma.organizationalUnit.create({ data: { name: "Phase3 Unit", camp_id: destination.camp_id } });
    const person = await prisma.personnel.create({ data: { full_name: "Phase3 Person", camp_id: source.camp_id } });

    const failed = await request(app).post("/api/v1/transfers").set("Authorization", `Bearer ${adminToken}`).send({
      personnel_id: person.personnel_id,
      camp_from_id: source.camp_id,
      camp_to_id: destination.camp_id,
      unit_to_id: (await prisma.organizationalUnit.create({ data: { name: "Wrong Unit", camp_id: source.camp_id } })).unit_id,
    });
    expect(failed.status).toBe(400);

    const accepted = await request(app).post("/api/v1/transfers").set("Authorization", `Bearer ${adminToken}`).send({
      personnel_id: person.personnel_id,
      camp_from_id: source.camp_id,
      camp_to_id: destination.camp_id,
      unit_to_id: unit.unit_id,
    });
    expect(accepted.status).toBe(201);

    const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: "admin_t" } });
    const adminNotifications = await prisma.notification.findMany({ where: { user_id: adminUser.user_id } });
    expect(adminNotifications.some((n) => n.title === "رُفض طلب النقل")).toBe(true);
    expect(adminNotifications.some((n) => n.title === "تم قبول طلب النقل")).toBe(true);

    const personId = person.personnel_id;
    const statusChange = await request(app)
      .post(`/api/v1/personnel/${personId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "discharged", notes: "synthetic sensitive status" });
    expect(statusChange.status).toBe(201);

    const officerUser = await prisma.user.findUniqueOrThrow({ where: { username: "officer_t" } });
    const officerNotifications = await prisma.notification.findMany({ where: { user_id: officerUser.user_id } });
    expect(officerNotifications.some((n) => n.title === "تغيير حالة حساس")).toBe(true);
  });

  it("lists and marks notifications read for the current user only", async () => {
    const anonymous = await request(app).get("/api/v1/notifications");
    expect(anonymous.status).toBe(401);

    const officerTokenReq = await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${officerToken}`);
    expect(officerTokenReq.status).toBe(200);
    expect(officerTokenReq.body.data.items.length).toBeGreaterThan(0);
    const first = officerTokenReq.body.data.items[0];
    const mark = await request(app).patch(`/api/v1/notifications/${first.notification_id}/read`).set("Authorization", `Bearer ${officerToken}`);
    expect(mark.status).toBe(200);
    const markAll = await request(app).patch("/api/v1/notifications/read-all").set("Authorization", `Bearer ${officerToken}`);
    expect(markAll.status).toBe(200);
    const after = await request(app).get("/api/v1/notifications?unread=true").set("Authorization", `Bearer ${officerToken}`);
    expect(after.body.data.items.length).toBe(0);
  });

  it("filters the report summary by record date, camp and current status", async () => {
    const camp = await prisma.camp.create({ data: { name: "Filtered Report Camp", capacity: 20 } });
    await prisma.personnel.createMany({
      data: [
        { full_name: "Included Filtered Person", camp_id: camp.camp_id, current_status: "on_leave", created_at: new Date("2025-02-12T12:00:00.000Z") },
        { full_name: "Outside Date Person", camp_id: camp.camp_id, current_status: "on_leave", created_at: new Date("2025-03-12T12:00:00.000Z") },
        { full_name: "Different Status Person", camp_id: camp.camp_id, current_status: "active", created_at: new Date("2025-02-15T12:00:00.000Z") },
      ],
    });

    const response = await request(app)
      .get(`/api/v1/reports/summary?from=2025-02-01T00:00:00.000Z&to=2025-02-28T23:59:59.999Z&camp_id=${camp.camp_id}&status=on_leave`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.total_personnel).toBe(1);
    expect(response.body.data.active_personnel).toBe(0);
    expect(response.body.data.status_breakdown).toEqual([{ status: "on_leave", count: 1 }]);
    expect(response.body.data.by_camp).toEqual([
      expect.objectContaining({ camp_id: camp.camp_id, count: 1 }),
    ]);
    expect(response.body.data.available_camps).toContainEqual({ camp_id: camp.camp_id, name: "Filtered Report Camp" });
    expect(response.body.data.filters.status).toBe("on_leave");

    const invalid = await request(app)
      .get("/api/v1/reports/summary?status=unknown")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
  });

  it("exports the summary report as Excel and PDF", async () => {
    const xlsx = await request(app).get("/api/v1/reports/export?format=xlsx&status=active").set("Authorization", `Bearer ${adminToken}`).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on("data", (c: Buffer) => chunks.push(c)); res.on("end", () => cb(null, Buffer.concat(chunks))); });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers["content-type"]).toContain("spreadsheetml");
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe("PK");

    const pdf = await request(app).get("/api/v1/reports/export?format=pdf").set("Authorization", `Bearer ${adminToken}`).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on("data", (c: Buffer) => chunks.push(c)); res.on("end", () => cb(null, Buffer.concat(chunks))); });
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");

    const bad = await request(app).get("/api/v1/reports/export?format=doc").set("Authorization", `Bearer ${adminToken}`);
    expect(bad.status).toBe(400);

    const exported = await request(app).get("/api/v1/audit?action_type=ReportExported").set("Authorization", `Bearer ${adminToken}`);
    expect(exported.body.data.items.length).toBeGreaterThan(0);
    expect(exported.body.data.items.some((item: { new_value: { format?: string; filters?: { status?: string } } }) =>
      item.new_value?.format === "xlsx" && item.new_value?.filters?.status === "active",
    )).toBe(true);

    const viewerDenied = await request(app).get("/api/v1/reports/export?format=xlsx").set("Authorization", `Bearer ${officerToken}`);
    expect(viewerDenied.status).toBe(403);
  });
});

describe("system settings (FR-16)", () => {
  it("restricts settings, audits changes, enforces password rules, and applies session duration to new tokens", async () => {
    const denied = await request(app).get("/api/v1/settings").set("Authorization", `Bearer ${viewerToken}`);
    expect(denied.status).toBe(403);

    const policyDenied = await request(app).get("/api/v1/settings/password-policy").set("Authorization", `Bearer ${viewerToken}`);
    expect(policyDenied.status).toBe(403);

    const initial = await request(app).get("/api/v1/settings").set("Authorization", `Bearer ${adminToken}`);
    expect(initial.status).toBe(200);
    expect(initial.body.data.settings).toMatchObject({ passwordMinLength: 8, sessionDurationHours: 8 });

    const invalid = await request(app).put("/api/v1/settings").set("Authorization", `Bearer ${adminToken}`).send({
      passwordMinLength: 7,
      requireUppercase: true,
      requireNumber: true,
      requireSymbol: true,
      sessionDurationHours: 8,
    });
    expect(invalid.status).toBe(400);

    const saved = await request(app).put("/api/v1/settings").set("Authorization", `Bearer ${adminToken}`).send({
      passwordMinLength: 12,
      requireUppercase: true,
      requireNumber: true,
      requireSymbol: true,
      sessionDurationHours: 4,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.settings.sessionDurationHours).toBe(4);

    const audit = await prisma.auditLog.findFirst({
      where: { action_type: "SystemSettingChanged", target_table: "SystemSettings" },
      orderBy: { created_at: "desc" },
    });
    expect(audit?.user_id).toBe((await prisma.user.findUniqueOrThrow({ where: { username: "admin_t" } })).user_id);
    expect(audit?.old_value).toMatchObject({ sessionDurationHours: 8 });
    expect(audit?.new_value).toMatchObject({ sessionDurationHours: 4, passwordMinLength: 12 });

    const limitedPolicy = await request(app).get("/api/v1/settings/password-policy").set("Authorization", `Bearer ${adminToken}`);
    expect(limitedPolicy.body.data).toMatchObject({ passwordMinLength: 12, requireSymbol: true });
    expect(limitedPolicy.body.data).not.toHaveProperty("sessionDurationHours");

    const weak = await request(app).post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
      username: "policy_user",
      full_name: "Policy User",
      password: "Weakpass9",
      role_ids: [],
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error.message).toContain("system policy");

    const created = await request(app).post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
      username: "policy_user",
      full_name: "Policy User",
      password: "StrongPass9!",
      role_ids: [],
    });
    expect(created.status).toBe(201);
    expect(created.body.data).not.toHaveProperty("password_hash");

    const loginResult = await request(app).post("/api/v1/auth/login").send({ username: "policy_user", password: "StrongPass9!" });
    expect(loginResult.status).toBe(200);
    const tokenPayload = jwt.decode(loginResult.body.data.token) as { iat: number; exp: number };
    expect(tokenPayload.exp - tokenPayload.iat).toBe(4 * 60 * 60);

    const weakReset = await request(app).put(`/api/v1/users/${created.body.data.user_id}`).set("Authorization", `Bearer ${adminToken}`).send({ password: "Weakpass9" });
    expect(weakReset.status).toBe(400);
  });
});
