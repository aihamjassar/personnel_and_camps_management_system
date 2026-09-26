import { beforeAll } from "vitest";

// Must run before app modules load: dotenv won't override an existing DATABASE_URL,
// so pinning it here routes Prisma to the test database.
process.env.DATABASE_URL =
  "postgresql://postgres:admin@127.0.0.1:5432/personnel_camps_test?schema=public";

beforeAll(async () => {
  const { prisma } = await import("../src/lib/prisma.js");
  // Delete in FK-safe order — schema has no onDelete: Cascade.
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.personnelStatus.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.personnel.deleteMany();
  await prisma.position.deleteMany();
  await prisma.organizationalUnit.deleteMany();
  await prisma.camp.deleteMany();
  await prisma.rank.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
});
