---
phase: 01-foundation-data-layer
plan: 02
subsystem: database
tags: [prisma, postgresql, zod, schema, migration, driver-adapter]

requires:
  - phase: 01-01
    provides: Monorepo scaffold with packages/db and packages/contracts shells
  - phase: 01-06
    provides: Docker Compose Postgres service and Vitest harness
provides:
  - Full Prisma 7 domain schema (Pipeline, Stage, GatePolicy, PromotionRun, GateResult, AuditEvent)
  - Initial migration applied to Postgres
  - createPrismaClient factory with @prisma/adapter-pg
  - Shared Zod contracts mirroring Prisma enums
affects: [01-03, 01-05, apps/worker activities, SAFE-01 audit repository]

tech-stack:
  added: [prisma@7.8.0, @prisma/adapter-pg@7.8.0, dotenv, tsx]
  patterns: [Prisma 7 defineConfig, driver adapter client bootstrap, enum parity in contracts]

key-files:
  created:
    - packages/db/prisma/schema.prisma
    - packages/db/prisma.config.ts
    - packages/db/prisma/migrations/20260622052811_init/migration.sql
    - packages/db/src/client.ts
    - packages/contracts/src/audit.ts
    - packages/contracts/src/pipeline.ts
    - packages/contracts/src/promotion-run.ts
    - packages/contracts/src/gate-result.ts
  modified:
    - packages/db/package.json
    - packages/db/src/index.ts
    - packages/contracts/src/index.ts
    - .gitignore

key-decisions:
  - "Prisma client generated to packages/db/generated/ (gitignored, built via prisma generate)"
  - "DATABASE_URL fallback in prisma.config.ts for build-time generate without env"
  - "Append-only AuditEvent with no updatedAt per D-04"

patterns-established:
  - "Pattern: createPrismaClient(connectionString) factory — no global singleton with hardcoded URL"
  - "Pattern: Zod enum schemas in contracts mirror Prisma enums for validation boundaries"
  - "Pattern: Normalized Pipeline → Stage → GatePolicy relational model per D-06"

requirements-completed: [SAFE-01]

duration: 25min
completed: 2026-06-22
---

# Phase 1 Plan 2: Prisma Schema & Contracts Summary

**Full Prisma 7 domain schema with driver-adapter client bootstrap, init migration, and Zod contracts mirroring all four Prisma enums**

## Performance

- **Duration:** 25 min
- **Started:** 2026-06-22T05:04:00Z
- **Completed:** 2026-06-22T05:29:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Six core models and four enums defined in Prisma schema per D-05/D-06/D-07/D-08
- Initial migration `20260622052811_init` applied to Postgres with all tables and indexes
- `createPrismaClient` uses `@prisma/adapter-pg` (Prisma 7 pattern, not bare PrismaClient)
- Zod contracts export validation schemas for pipeline, promotion run, audit, and gate result inputs
- `PersistRunStateInputSchema` exported for worker activity contract per D-07

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema and Prisma 7 config** - `9e56e2a` (feat)
2. **Task 2: Shared Zod contracts mirroring schema** - `87726f5` (feat)
3. **Task 3: Prisma client bootstrap and initial migration** - `f1b9efc` (feat)

## Files Created/Modified

- `packages/db/prisma/schema.prisma` - Full normalized domain schema with six models and four enums
- `packages/db/prisma.config.ts` - Prisma 7 defineConfig with migrations, seed, and datasource URL
- `packages/db/prisma/migrations/20260622052811_init/migration.sql` - Initial migration SQL
- `packages/db/src/client.ts` - createPrismaClient factory with PrismaPg adapter
- `packages/db/src/index.ts` - Exports client factory and generated enum/model types
- `packages/contracts/src/audit.ts` - ActorType, AuditAction, AuditEventInput Zod schemas
- `packages/contracts/src/pipeline.ts` - PipelineCreateInputSchema with stage/gate policy shapes
- `packages/contracts/src/promotion-run.ts` - PromotionStatus and PersistRunStateInput schemas
- `packages/contracts/src/gate-result.ts` - GateVerdict and GateResultCreateInput schemas

## Decisions Made

- Generated Prisma client output to `packages/db/generated/client` (gitignored; produced by build)
- DATABASE_URL fallback in prisma.config.ts so `turbo run build` works without env injection
- Stub seed.ts placeholder — full seed implementation deferred to plan 01-05 per roadmap

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] DATABASE_URL fallback for build-time generate**
- **Found during:** Task 3 (turbo build verification)
- **Issue:** Prisma 7 `env('DATABASE_URL')` in prisma.config.ts caused `prisma generate` to fail when DATABASE_URL unset, breaking `pnpm turbo run build --filter=@ff-promo/db`
- **Fix:** Use `process.env.DATABASE_URL ?? 'postgresql://ffpromo:ffpromo@localhost:5432/ffpromo'` fallback in prisma.config.ts
- **Files modified:** packages/db/prisma.config.ts
- **Committed in:** f1b9efc

**2. [Rule 3 - Blocking] Docker daemon unavailable; used local Homebrew Postgres**
- **Found during:** Task 3 (migration apply)
- **Issue:** Docker Desktop socket not available; `docker compose up postgres` failed
- **Fix:** Started Homebrew postgresql@14 locally, created ffpromo role/database, granted CREATEDB for Prisma shadow database
- **Verification:** `prisma migrate dev --name init` exited 0; `prisma migrate deploy` confirmed applied
- **Committed in:** f1b9efc (migration files)

**3. [Rule 3 - Blocking] Prisma 7 removed --skip-seed flag**
- **Found during:** Task 3 (migrate dev command)
- **Issue:** Plan specified `--skip-seed` but Prisma 7.8.0 does not support it
- **Fix:** Ran `prisma migrate dev --name init` without flag; stub seed.ts is no-op export
- **Committed in:** f1b9efc

---

**Total deviations:** 3 auto-fixed (1 Rule 2, 2 Rule 3)
**Impact on plan:** All fixes required for migration and build to succeed. No scope creep.

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| `packages/db/prisma/seed.ts` | 1-2 | Placeholder export — full dev→staging→prod seed deferred to plan 01-05 |

## Issues Encountered

- Docker Desktop daemon not running on execution host — worked around with local Homebrew PostgreSQL 14
- Homebrew postgres data directory had invalid permissions — fixed with `chmod 700` before pg_ctl start

## User Setup Required

None for schema/migration artifacts. Local migration apply requires Postgres reachable at `postgresql://ffpromo:ffpromo@localhost:5432/ffpromo` (Docker Compose or local install).

## Next Phase Readiness

- Schema and migration ready for plan 01-03 repository implementations
- Contracts ready for activity input validation in worker
- `@ff-promo/db` exports `createPrismaClient` and enum types for repositories

## Self-Check: PASSED

- FOUND: packages/db/prisma/schema.prisma
- FOUND: packages/db/prisma.config.ts
- FOUND: packages/contracts/src/audit.ts
- FOUND: packages/db/src/client.ts
- FOUND: packages/db/prisma/migrations/20260622052811_init/migration.sql
- FOUND: 9e56e2a, 87726f5, f1b9efc (git log)

---
*Phase: 01-foundation-data-layer*
*Completed: 2026-06-22*
