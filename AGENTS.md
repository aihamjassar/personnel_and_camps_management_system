# AGENTS.md

## Repo status

- **Phase 1 in progress:** root workspace + full `server/` (Express/Prisma/TS) are written; the `client/` SPA does **not exist yet**. The server has **never been installed, compiled, or tested** — first `npm install` + test run will likely surface fixes. Resume state + exact next steps: `docs/memory.md` §9.
- Project: Integrated Personnel and Camps Management System — graduation project, **fully fake/academic data only**. Requests that fall under the "Won't-Have" scope in `docs/memory.md` §3 must be declined or noted as future work, never implemented.

## Git

- **Always use git.** Commit at each meaningful milestone (after install/migrations/tests pass, after fixing errors, after finishing a feature). Never leave working code uncommitted across sessions.
- `.env` is git-ignored (holds local DB credentials) — never commit it or put real secrets in tracked files; `.env.example` is the tracked template.
- Branch: `main`. Small, descriptive commits (existing convention: `feat: …` / docs commits).

## Read first

- `docs/memory.md` — designated session context file (per its own instructions): fixed architecture decisions (§2), scope (§3), phase status (§4), hard rules (§7), **resume state (§9) — read this first to continue where the last session stopped**.
- `docs/mindmap.md` — one-page overview of the whole project.
- Work is tracked per phase in `docs/Todo-Phase-1.md` … `Todo-Phase-4.md`; current phase status lives in `docs/memory.md` §4 (update it manually when a phase completes or a decision changes).

## Commands (npm workspaces root; server = `server/`)

- `npm install` — install root workspaces (server; client workspace doesn't exist yet).
- `npm run dev -w server` — start API (needs `server/.env`, copied from `.env.example`; local DB `personnel_camps`, postgres/admin).
- `npm run db:migrate -w server` — apply Prisma schema; `npm run db:seed -w server` — seed roles/permissions/admin/sample data (`admin / Admin@1234`).
- `npm run test -w server` — integration tests (Vitest + Supertest). They auto-create/reset a **separate** DB `personnel_camps_test`; runs serially; never touches dev data.
- `npm run typecheck -w server` / `npm run build -w server` — `tsc --noEmit` / build.
- Commands above are as-declared in `package.json` but **not yet verified by a successful run** — trust actual output over this list if they fail.

## Non-negotiable rules (from `docs/memory.md` §7)

- **No real deletes** of personnel records — logical delete (soft delete) only.
- `PersonnelStatus` is **append-only history** — never overwrite old rows.
- Transfers between camps must run in a **single DB transaction** (no partial states).
- Audit logging happens in the **integration layer**, never triggered from the frontend UI.
- **Every** API endpoint enforces RBAC — no exceptions, even for seemingly harmless routes.
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
