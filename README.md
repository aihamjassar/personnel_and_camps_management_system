# Integrated Personnel and Camps Management System

**Language:** [English](README.md) · [العربية](README.ar.md)

An academic full-stack system for managing fictional personnel records and camp facilities. The application uses React, TypeScript, Express, Prisma, and PostgreSQL, with an Arabic right-to-left interface. **Use fictional academic data only—never enter real personnel, military, or sensitive information.**

> **Project status:** Phase 1 is complete. The Phase 2 implementation (cross-module integration, transfers, and dynamic RBAC) is built and verified; the team code review is still pending. See [Phase 2 checklist](docs/Todo-Phase-2.md).

## Features

- Session-based sign-in, JWT authentication, and API-side role-based access control (RBAC).
- Arabic RTL interface and dashboard summaries.
- Personnel management with append-only status history and logical deletion.
- Camps, organizational units, ranks, positions, and assignments.
- Camp-to-camp transfers with destination-unit and capacity checks; personnel, transfer, and audit records are committed atomically.
- User, role, and permission administration, with permission changes applied dynamically.
- Audit history and basic reports.

## Technology

- **Client:** React 18, TypeScript, Vite, Tailwind CSS, Lucide icons.
- **Server:** Node.js, Express, TypeScript, Zod.
- **Data:** PostgreSQL and Prisma ORM.
- **Tests:** Vitest and Supertest against a dedicated PostgreSQL test database.

## Requirements

- Node.js 20 or newer and npm.
- A local PostgreSQL server for development and integration tests.

## Local setup

Run commands from the repository root unless noted otherwise.

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a development database and local server environment:

   ```bash
   createdb personnel_camps
   cp server/.env.example server/.env
   ```

   Edit `server/.env`: set `DATABASE_URL` to your PostgreSQL connection string and replace `JWT_SECRET` with a strong private value. Do not commit `server/.env` or share secrets.

3. Apply migrations and add fictional demo data:

   ```bash
   npm run db:deploy -w server
   npm run db:seed -w server
   ```

   Prisma CLI configuration, including the seed command, lives in [`server/prisma.config.ts`](server/prisma.config.ts).

4. Start the API server and web client:

   ```bash
   npm run dev
   ```

   - Web client: <http://localhost:5173>
   - API base: <http://localhost:4000/api/v1>
   - Public liveness check: <http://localhost:4000/api/v1/health>

   The Vite development server proxies `/api` requests to the API server.

## Demo account

After seeding, use `admin` / `Admin@1234` for local academic demonstrations. This is a development-only credential: **change or remove it before any deployment**. Do not use real credentials or real personal data in demos.

## Checks and builds

```bash
npm run typecheck
npm test
npm run build
```

The integration-test setup targets the dedicated `personnel_camps_test` database and force-resets its schema. **Never point it at a development or production database containing data you need.** If your local PostgreSQL credentials differ from the test setup, update the test connection in `server/tests/global-setup.ts` before running tests. All test fixtures are synthetic.

## API and access notes

Versioned API routes are under `/api/v1`. Protected application routes use JWT authentication and server-side RBAC. Two endpoints are intentionally public: `POST /api/v1/auth/login` and the minimal `GET /api/v1/health` liveness check. The health response only reports `{ "ok": true }`; it does not expose database or operational details.

## Repository guide

- [`AGENTS.md`](AGENTS.md) — development rules and commands.
- [`docs/memory.md`](docs/memory.md) — architecture decisions, scope, and current resume state.
- [`docs/Architecture.md`](docs/Architecture.md) — system architecture and security model.
- [`docs/Data-Flow.md`](docs/Data-Flow.md) and [`docs/Flow-of-Action.md`](docs/Flow-of-Action.md) — integration and transfer flows.
- [`docs/Todo-Phase-1.md`](docs/Todo-Phase-1.md) and [`docs/Todo-Phase-2.md`](docs/Todo-Phase-2.md) — delivery checklists.
- [`docs/browser-verification.md`](docs/browser-verification.md) — manual browser smoke-test notes.

## Deployment caution

Before any deployment, configure a separate PostgreSQL database, a strong private JWT secret, HTTPS, and production-appropriate CORS settings. Replace development credentials and use only data authorized for the intended environment; this project is scoped to fictional academic data.
