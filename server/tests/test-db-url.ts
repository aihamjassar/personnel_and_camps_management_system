import "dotenv/config";

// Tests always run against a dedicated database, never the dev one.
// Credentials are derived from the local DATABASE_URL so the test database
// stays in sync with whatever credentials the developer's Postgres uses.
function buildTestUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL must be set (see server/.env) to derive the test database URL.");
  }
  const url = new URL(base);
  url.pathname = "/personnel_camps_test";
  return url.toString();
}

export const TEST_DATABASE_URL = buildTestUrl();
