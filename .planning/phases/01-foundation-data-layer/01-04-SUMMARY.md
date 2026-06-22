---
phase: 01-foundation-data-layer
plan: 04
subsystem: worker
tags: [temporal, workflow, activities, fsm, signals, vitest, testcontainers]

requires:
  - phase: 01-03
    provides: Prisma repositories and createRepositories factory
  - phase: 01-06
    provides: Monorepo scaffold, vitest worker project
provides:
  - Temporal promotion workflow FSM skeleton with stage loop
  - Stub activities bridging workflow to Postgres via repositories
  - Worker bootstrap on promotion task queue
  - Workflow and signal integration tests with real activities
affects: [phase-4-gates, phase-5-api]

tech-stack:
  added: []
  patterns:
    - "Activity-only DB access from workflow sandbox (D-07)"
    - "persistRunState before advancing currentStageIndex (split-brain prevention)"
    - "workflowId equals promotionRunId for correlation"
    - "require.resolve for Temporal workflowsPath in ESM projects"

key-files:
  created:
    - apps/worker/src/activities/persist-run-state.ts
    - apps/worker/src/activities/record-audit-event.ts
    - apps/worker/src/activities/evaluate-gate.ts
    - apps/worker/src/activities/index.ts
    - apps/worker/src/workflows/signals.ts
    - apps/worker/src/workflows/promotion.workflow.ts
    - apps/worker/src/worker.ts
    - apps/worker/src/__tests__/promotion.workflow.test.ts
    - apps/worker/src/__tests__/promotion.signals.test.ts
  modified:
    - apps/worker/package.json
    - apps/worker/tsconfig.json

key-decisions:
  - "Activities create/disconnect PrismaClient per invocation for test isolation"
  - "Signal tests use immediate signal delivery (time-skipping completes fast)"
  - "Worker tsc excludes __tests__ to avoid cross-package rootDir errors"

patterns-established:
  - "promotionWorkflow FSM: stage loop → evaluateGate stub → persist → audit milestones"
  - "Five signals per D-10 with statusQuery for dashboard/API future use"

requirements-completed: [SAFE-01]

duration: 12min
completed: 2026-06-21
---

# Phase 1 Plan 4: Temporal Worker Skeleton Summary

**Promotion workflow FSM with stub activities, five signals, and integration tests proving real activity → repository → Postgres path**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-21T22:32:00Z
- **Completed:** 2026-06-21T22:44:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Three stub activities (`persistRunState`, `recordAuditEvent`, `evaluateGate`) bridge Temporal to `@ff-promo/db` repositories — no Prisma in workflow sandbox
- `promotionWorkflow` loops through stages with stub gate pass, persists state before index advance (D-07), writes audit milestones (SAFE-01)
- Five signals defined: pause, resume, abort, gatePassed, gateFailed; `statusQuery` exposes run state
- Worker boots on task queue `promotion` with graceful SIGINT shutdown
- Three integration tests pass: full stage completion, pause/resume, abort with `workflowId === promotionRunId`

## Task Commits

Each task was committed atomically (TDD RED → GREEN for Task 2):

1. **Task 1: Stub activities bridging to repositories** — `86cf7f8` (feat)
2. **Task 2: Promotion workflow FSM (RED)** — `a5196fd` (test)
3. **Task 2: Promotion workflow FSM (GREEN)** — `f71521b` (feat)
4. **Task 3: Worker bootstrap and package wiring** — `9b1b83a` (feat)

## Files Created/Modified

- `apps/worker/src/activities/*.ts` — DB bridge activities per D-11
- `apps/worker/src/workflows/signals.ts` — D-10 signal and query definitions
- `apps/worker/src/workflows/promotion.workflow.ts` — D-09 FSM skeleton
- `apps/worker/src/worker.ts` — Temporal worker bootstrap
- `apps/worker/src/__tests__/promotion.*.test.ts` — E2E workflow tests with real activities
- `apps/worker/package.json` — vitest test script, tsx dev entrypoint
- `apps/worker/tsconfig.json` — exclude `__tests__` from production build

## Decisions Made

- Activities use per-call PrismaClient lifecycle (create/disconnect in finally) rather than singleton — simplifies test isolation
- ESM projects use `createRequire(import.meta.url).resolve()` for `workflowsPath` — Temporal webpack cannot bundle directory paths alone
- Signal integration tests signal immediately after workflow start — time-skipping environment completes multi-stage runs before timed sleeps

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Temporal workflowsPath must resolve to workflow file**
- **Found during:** Task 2 (workflow integration tests)
- **Issue:** `workflowsPath` pointing at directory caused webpack "Module not found" bundle error
- **Fix:** Use `createRequire(import.meta.url).resolve('../workflows/promotion.workflow.ts')`
- **Files modified:** `apps/worker/src/__tests__/promotion.workflow.test.ts`, `apps/worker/src/__tests__/promotion.signals.test.ts`, `apps/worker/src/worker.ts`
- **Committed in:** `f71521b`, `9b1b83a`

**2. [Rule 1 - Bug] Signal tests failed with "Completed workflow"**
- **Found during:** Task 2 (pause/abort signal tests)
- **Issue:** Time-skipping test env completed 3-stage workflow before pause/abort signals delivered
- **Fix:** Signal immediately after `workflow.start`; use high `stageCount` for abort test
- **Files modified:** `apps/worker/src/__tests__/promotion.signals.test.ts`
- **Committed in:** `f71521b`

**3. [Rule 3 - Blocking] Worker tsc failed on cross-package test imports**
- **Found during:** Task 3 (turbo build)
- **Issue:** Test imports from `packages/db/src/__tests__/setup.ts` violated worker `rootDir`
- **Fix:** Exclude `src/**/__tests__/**` from worker tsconfig
- **Files modified:** `apps/worker/tsconfig.json`
- **Committed in:** `9b1b83a`

**4. [Rule 1 - Bug] TypeScript narrowing blocked abort checks in workflow loop**
- **Found during:** Task 3 (tsc build)
- **Issue:** `status !== 'aborted'` while-condition caused TS2367 errors inside loop after signal handlers
- **Fix:** `hasAborted()` helper function to avoid control-flow narrowing
- **Files modified:** `apps/worker/src/workflows/promotion.workflow.ts`
- **Committed in:** `9b1b83a`

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs)
**Impact on plan:** All fixes required for build correctness and test reliability. No scope creep.

## TDD Gate Compliance

- RED commit `a5196fd` — failing tests (workflow module missing)
- GREEN commit `f71521b` — workflow implementation, tests pass
- No separate refactor commit needed

## Issues Encountered

- Docker daemon was not running in execution environment; integration tests verified via `SKIP_TESTCONTAINERS=1` with local Postgres on port 5432 (docker-compose credentials). CI with Docker should use testcontainers as planned.

## User Setup Required

None for code — local dev requires:
- `DATABASE_URL` pointing at Postgres (docker compose `postgres` service)
- Temporal dev server on `localhost:7233` for `pnpm --filter @ff-promo/worker dev`

## Next Phase Readiness

- Worker skeleton ready for Phase 4 to replace `evaluateGate` stub with real PromQL telemetry
- API layer can start workflows with `workflowId: promotionRun.id` and send signals
- Audit milestones written at all transitions for dashboard timeline (Phase 6)

## Self-Check: PASSED

- FOUND: apps/worker/src/worker.ts
- FOUND: apps/worker/src/workflows/promotion.workflow.ts
- FOUND: apps/worker/src/workflows/signals.ts
- FOUND: apps/worker/src/activities/index.ts
- FOUND: 86cf7f8
- FOUND: a5196fd
- FOUND: f71521b
- FOUND: 9b1b83a

---
*Phase: 01-foundation-data-layer*
*Completed: 2026-06-21*
