# AGENTS.md

## Repo status

- **Phase 1 complete locally (2026-09-26):** root workspace includes `server/` (Express/Prisma/TypeScript) and `client/` (React/Vite/TypeScript/Tailwind, Arabic RTL). Root `npm run typecheck`, `npm run build`, and `npm test` have passed; 16 server integration tests pass against isolated `personnel_camps_test`. Browser smoke-test notes: `docs/browser-verification.md`. Resume state and next phase: `docs/memory.md` §9.
- Project: Integrated Personnel and Camps Management System — graduation project, **fully fake/academic data only**. Requests that fall under the "Won't-Have" scope in `docs/memory.md` §3 must be declined or noted as future work, never implemented.

## Git

- **Always use git.** Commit at each meaningful milestone (after install/migrations/tests pass, after fixing errors, after finishing a feature). Never leave working code uncommitted across sessions.
- `.env` is git-ignored (holds local DB credentials) — never commit it or put real secrets in tracked files; `.env.example` is the tracked template.
- Branch: `main`. Small, descriptive commits (existing convention: `feat: …` / docs commits).

## Read first

- `docs/memory.md` — designated session context file (per its own instructions): fixed architecture decisions (§2), scope (§3), phase status (§4), hard rules (§7), **resume state (§9) — read this first to continue where the last session stopped**.
- `docs/mindmap.md` — one-page overview of the whole project.
- Work is tracked per phase in `docs/Todo-Phase-1.md` … `Todo-Phase-4.md`; current phase status lives in `docs/memory.md` §4 (update it manually when a phase completes or a decision changes).

## Commands (npm workspaces root; `server/` and `client/`)

- `npm ci` — install the locked server and client workspaces.
- `cp server/.env.example server/.env` — create local server configuration, then set a local PostgreSQL URL and a strong private JWT secret.
- `npm run db:deploy -w server` — apply tracked Prisma migrations; `npm run db:seed -w server` — seed roles/permissions/admin and fictional sample data (`admin / Admin@1234`, development only).
- `npm run dev` — run API and Vite client together; client defaults to port 5173 and proxies `/api` to the server.
- `npm run typecheck`, `npm run build`, and `npm test` — root scripts for both workspaces and the integration suite. These commands were verified successfully on 2026-09-26.
- Tests target a dedicated `personnel_camps_test` PostgreSQL database and run `prisma db push --force-reset`; never point this test configuration at a development or production database containing important data.

## Non-negotiable rules (from `docs/memory.md` §7)

- **No real deletes** of personnel records — logical delete (soft delete) only.
- `PersonnelStatus` is **append-only history** — never overwrite old rows.
- Transfers between camps must run in a **single DB transaction** (no partial states).
- Audit logging happens in the **integration layer**, never triggered from the frontend UI.
- Every API endpoint enforces RBAC except public `POST /api/v1/auth/login` and minimal `GET /api/v1/health` liveness check; the health response must not expose sensitive details. See `docs/memory.md` §2 and §7.
- Architectural changes must be recorded in `docs/memory.md` §2 *before* implementing.

## Architecture (verified against `docs/Architecture.md`)

- Modular Monolith, layered: React SPA → REST API → business logic → integration layer → database.
- **Database is PostgreSQL (13 tables, 3NF)** — note the directory name says "MERN", but it is *not* MongoDB.
- All endpoints are versioned under `/api/v1/...` (auth, personnel, camps, units, ranks, positions, assignments, transfers, users, reports, audit).
- Unified response shape for **every** endpoint: `{"status": "success|fail", "data": {}, "error": null}`.
- Auth: JWT + bcrypt; tokens must not be stored in `localStorage`.

## Conventions that differ from defaults

- Documentation is written in **Arabic**; the UI spec (`docs/UI-UX-Specification.md`) requires **full RTL layout** with localized Arabic numerals/dates.
- Follow the MoSCoW phase discipline: implement only the current phase's `Todo-Phase-N.md` items — no Should/Could-Have features leaking into earlier phases.
- Acceptance targets (from `docs/Implement-Plan.md` §6): <2s response for 95% of requests, ≥70% test coverage, HTTPS everywhere.
