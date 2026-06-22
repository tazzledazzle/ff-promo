---
phase: 04-promotion-engine
plan: 04
subsystem: worker
tags: [pipe-02, safe-02, integration-tests, start-run]
requires:
  - phase: 04-03
    provides: full workflow + activities
provides:
  - startPromotionRun helper (PIPE-02)
  - start-run CLI script
  - E2E promotion-engine integration tests
  - SAFE-02 abort signal test
  - README Phase 4 section
affects: [05-rest-api]
tech-stack:
  added: []
  patterns: [temporalClient injection for tests, nock E2E at HTTP boundary]
key-files:
  created:
    - apps/worker/src/lib/start-promotion-run.ts
    - apps/worker/src/scripts/start-run.ts
    - apps/worker/src/__tests__/promotion-engine.integration.test.ts
    - apps/worker/src/__tests__/start-promotion-run.test.ts
  modified:
    - apps/worker/src/__tests__/promotion.signals.test.ts
    - README.md
requirements-completed: [PIPE-02, PIPE-03, PIPE-04, SAFE-02]
duration: 30min
completed: 2026-06-22
---

# Phase 4 Plan 04 Summary

**Delivered worker-side run starter, E2E nock integration tests, abort coverage, and Phase 4 documentation.**

## Accomplishments

- `startPromotionRun`: pending → active, sets `temporalWorkflowId`, starts `promotionWorkflow`
- `pnpm --filter @ff-promo/worker start-run <id>` dev script
- `promotion-engine.integration.test.ts`: PIPE-02/03/04 + D-12 with real activities + nock
- SAFE-02 abort-during-processing test in `promotion.signals.test.ts`
- README documents promotion engine flow, env vars, test command

## Verification

- `vitest run --project worker stage-targeting` — 3/3 pass
- `vitest run --project telemetry` — 30/30 pass
- `vitest run --project ld-adapter` — 30/30 pass
- Full worker suite requires Docker testcontainers (CI)
