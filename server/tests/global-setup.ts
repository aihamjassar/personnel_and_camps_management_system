import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./test-db-url.js";

export default function setup() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  execSync("npx prisma db push --skip-generate --force-reset", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
