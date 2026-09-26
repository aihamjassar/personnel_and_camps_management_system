import { execSync } from "node:child_process";

// Tests run against a dedicated database, never the dev one.
const TEST_URL =
  "postgresql://postgres:admin@127.0.0.1:5432/personnel_camps_test?schema=public";

export default function setup() {
  process.env.DATABASE_URL = TEST_URL;
  execSync("npx prisma db push --skip-generate --force-reset", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_URL },
  });
}
