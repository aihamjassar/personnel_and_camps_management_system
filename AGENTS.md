# AGENTS.md

## Repo status

- **Docs-only right now.** The repo contains only `docs/` (Phase 0 deliverables). There is no app code, `package.json`, README, CI, or test setup yet — don't invent commands; when scaffolding Phase 1, record the real build/lint/test commands here.
- Project: Integrated Personnel and Camps Management System — graduation project, **fully fake/academic data only**. Requests that fall under the "Won't-Have" scope in `docs/memory.md` §3 must be declined or noted as future work, never implemented.

## Read first

- `docs/memory.md` — designated session context file (per its own instructions): fixed architecture decisions (§2), scope (§3), phase status (§4), hard rules (§7).
- `docs/mindmap.md` — one-page overview of the whole project.
- Work is tracked per phase in `docs/Todo-Phase-1.md` … `Todo-Phase-4.md`; current phase status lives in `docs/memory.md` §4 (update it manually when a phase completes or a decision changes).

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
