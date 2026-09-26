import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
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

  it("restricts health status to authenticated system administrators", async () => {
    const anonymous = await request(app).get("/api/v1/health");
    expect(anonymous.status).toBe(401);
    const officer = await request(app).get("/api/v1/health").set("Authorization", `Bearer ${officerToken}`);
    expect(officer.status).toBe(403);
    const admin = await request(app).get("/api/v1/health").set("Authorization", `Bearer ${adminToken}`);
    expect(admin.status).toBe(200);
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
});
