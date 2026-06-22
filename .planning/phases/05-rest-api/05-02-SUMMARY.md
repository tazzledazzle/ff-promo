---
phase: 05-rest-api
plan: 02
subsystem: promotion-control
tags: [temporal, shared-package, worker-refactor]
requires:
  - phase: 04-promotion-engine
    provides: startPromotionRun, workflow signals
provides:
  - @ff-promo/promotion-control package
  - Canonical signal/query definitions
  - Worker re-exports from shared package
affects: [05-03, worker]
tech-stack:
  added: [@ff-promo/promotion-control workspace package]
  patterns: [workflow type string, API/worker shared control layer]
key-files:
  created:
    - packages/promotion-control/src/signals.ts
    - packages/promotion-control/src/start-promotion-run.ts
    - packages/promotion-control/src/signal-promotion-run.ts
    - packages/promotion-control/src/index.ts
  modified:
    - apps/worker/src/workflows/signals.ts
    - apps/worker/src/lib/start-promotion-run.ts
    - apps/worker/package.json
requirements-completed: []
duration: 25min
completed: 2026-06-22
---

# Phase 5 Plan 02 Summary

**Extracted promotion control (start/signal/query) into a shared package used by API and worker.**

## Accomplishments

- Created `@ff-promo/promotion-control` with `PROMOTION_WORKFLOW_TYPE`, signal/query defs
- Moved `startPromotionRun`, `signalPromotionRun`, `queryPromotionStatus` from worker
- Worker now re-exports from promotion-control (no behavior change intended)

## Verification

- `pnpm --filter @ff-promo/promotion-control run build` — pass
- `pnpm --filter @ff-promo/worker run build` — pass
