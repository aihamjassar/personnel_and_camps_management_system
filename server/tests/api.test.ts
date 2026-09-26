import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();

let adminToken = "";
let officerToken = "";

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
  await prisma.user.createMany({
    data: [
      { username: "admin_t", password_hash: await bcrypt.hash("Admin@1234", 10), full_name: "Admin" },
      { username: "officer_t", password_hash: await bcrypt.hash("Off@12345", 10), full_name: "Officer" },
      { username: "disabled_t", password_hash: await bcrypt.hash("Dis@12345", 10), full_name: "Disabled", is_active: false },
    ],
  });
  await prisma.userRole.createMany({
    data: [
      { user_id: (await prisma.user.findUniqueOrThrow({ where: { username: "admin_t" } })).user_id, role_id: adminRole.role_id },
      { user_id: (await prisma.user.findUniqueOrThrow({ where: { username: "officer_t" } })).user_id, role_id: officerRole.role_id },
    ],
  });
  adminToken = await login("admin_t", "Admin@1234");
  officerToken = await login("officer_t", "Off@12345");
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

describe("RBAC coverage", () => {
  it("requires the resource permission for every reference-data and assignment list", async () => {
    const endpoints = ["/camps", "/units", "/ranks", "/positions", "/assignments"];
    for (const endpoint of endpoints) {
      const res = await request(app)
        .get(`/api/v1${endpoint}`)
        .set("Authorization", `Bearer ${officerToken}`);
      expect(res.status, endpoint).toBe(403);
      expect(res.body.status, endpoint).toBe("fail");
    }
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
  it("validates updates and never exposes password hashes", async () => {
    const listed = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.items.every((user: { password_hash?: string }) => !("password_hash" in user))).toBe(true);

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

    const res = await request(app).get("/api/v1/audit").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const types = res.body.data.items.map((i: { action_type: string }) => i.action_type);
    expect(types).toContain("UserLoginSucceeded");
    expect(types).toContain("PersonnelCreated");
  });
});
