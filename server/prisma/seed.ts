import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Canonical permission keys — RBAC is enforced with these on every route.
const PERMISSIONS = [
  { permission_key: "personnel.manage", description: "Create/update/deactivate personnel" },
  { permission_key: "camps.manage", description: "Manage camps" },
  { permission_key: "units.manage", description: "Manage organizational units" },
  { permission_key: "ranks.manage", description: "Manage ranks" },
  { permission_key: "positions.manage", description: "Manage positions" },
  { permission_key: "assignments.manage", description: "Manage assignments" },
  { permission_key: "transfers.manage", description: "Request/process transfers" },
  { permission_key: "users.manage", description: "Manage user accounts and roles" },
  { permission_key: "reports.view", description: "View dashboard and reports" },
  { permission_key: "audit.view", description: "View audit logs" },
  { permission_key: "system.admin", description: "Full system administration" },
];

const ROLES = [
  { role_name: "System Administrator", description: "Full access", all: true },
  { role_name: "Personnel Officer", description: "Manages personnel, assignments, ranks, and academic transfers", perms: ["personnel.manage", "ranks.manage", "positions.manage", "assignments.manage", "transfers.manage", "reports.view"] },
  { role_name: "Camp Manager", description: "Manages camp units, personnel status, and academic transfers", perms: ["camps.manage", "units.manage", "personnel.manage", "transfers.manage", "reports.view"] },
  { role_name: "Report Viewer", description: "Read-only reports", perms: ["reports.view"] },
];

async function main() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { permission_key: p.permission_key },
      update: { description: p.description },
      create: p,
    });
  }
  const allPerms = await prisma.permission.findMany();

  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { role_name: r.role_name },
      update: { description: r.description },
      create: { role_name: r.role_name, description: r.description },
    });
    const keys = r.all ? allPerms.map((p) => p.permission_id) : allPerms.filter((p) => r.perms?.includes(p.permission_key)).map((p) => p.permission_id);
    for (const permission_id of keys) {
      await prisma.rolePermission.upsert({
        where: { role_id_permission_id: { role_id: role.role_id, permission_id } },
        update: {},
        create: { role_id: role.role_id, permission_id },
      });
    }
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { role_name: "System Administrator" } });
  const existingAdmin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!existingAdmin) {
    const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD ??
      (process.env.NODE_ENV === "production" ? undefined : "Admin@1234");
    if (!bootstrapPassword || bootstrapPassword.length < 8) {
      throw new Error("Set BOOTSTRAP_ADMIN_PASSWORD to a secret of at least 8 characters before creating the production administrator.");
    }
    await prisma.user.create({
      data: {
        username: "admin",
        password_hash: await bcrypt.hash(bootstrapPassword, 10),
        full_name: "System Administrator",
        roles: { create: [{ role_id: adminRole.role_id }] },
      },
    });
    if (process.env.NODE_ENV === "production" || process.env.BOOTSTRAP_ADMIN_PASSWORD) {
      console.log("Administrator created; credential output is suppressed.");
    } else {
      console.log("Default local admin login: admin / Admin@1234 (change before any shared environment).");
    }
  }

  // Sample reference data so the UI isn't empty on first run (all fake/academic).
  // Arabic camp and unit names are fictional demonstration data, not real formations.
  const campCount = await prisma.camp.count();
  if (campCount === 0) {
    const regionOne = await prisma.camp.create({
      data: { name: "معسكر المنطقة الأولى (افتراضي)", capacity: 800, location: "قطاع تجريبي أ" },
    });
    const regionTwo = await prisma.camp.create({
      data: { name: "معسكر المنطقة الثانية (افتراضي)", capacity: 600, location: "قطاع تجريبي ب" },
    });

    // Demonstrate parent-child unit management with invented sample records.
    const chains = [
      { camp: regionOne, region: "الأولى", axis: "الشمالي", brigade: "الأول" },
      { camp: regionTwo, region: "الثانية", axis: "الجنوبي", brigade: "الثاني" },
    ];
    for (const chain of chains) {
      const region = await prisma.organizationalUnit.create({
        data: { name: `قيادة المنطقة ${chain.region} (افتراضية)`, camp_id: chain.camp.camp_id },
      });
      const axis = await prisma.organizationalUnit.create({
        data: { name: `المحور ${chain.axis} (افتراضي)`, camp_id: chain.camp.camp_id, parent_unit_id: region.unit_id },
      });
      const brigade = await prisma.organizationalUnit.create({
        data: { name: `اللواء ${chain.brigade} (افتراضي)`, camp_id: chain.camp.camp_id, parent_unit_id: axis.unit_id },
      });
      const battalion = await prisma.organizationalUnit.create({
        data: { name: "الكتيبة الأولى (افتراضية)", camp_id: chain.camp.camp_id, parent_unit_id: brigade.unit_id },
      });
      await prisma.organizationalUnit.create({
        data: { name: "السرية الأولى (افتراضية)", camp_id: chain.camp.camp_id, parent_unit_id: battalion.unit_id },
      });
    }

    await prisma.rank.createMany({
      data: [
        { name: "عقيد (افتراضي)", level: 1 },
        { name: "مقدم (افتراضي)", level: 2 },
        { name: "رائد (افتراضي)", level: 3 },
        { name: "نقيب (افتراضي)", level: 4 },
        { name: "ملازم (افتراضي)", level: 5 },
        { name: "رقيب (افتراضي)", level: 6 },
        { name: "عريف (افتراضي)", level: 7 },
        { name: "جندي (افتراضي)", level: 8 },
      ],
    });
    await prisma.position.createMany({
      data: [
        { name: "قائد لواء (تجريبي)" },
        { name: "قائد كتيبة (تجريبي)" },
        { name: "قائد سرية (تجريبي)" },
        { name: "ضابط إداري (تجريبي)" },
      ],
    });
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
