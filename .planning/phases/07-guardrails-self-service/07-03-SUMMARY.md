---
phase: 07-guardrails-self-service
plan: 03
subsystem: api
tags: [guardrails, promotion-runs, self-service]
requires:
  - phase: 07-02
    provides: pipeline CRUD and active/inactive state
provides:
  - Server-side guardrail enforcement on createRun/startRun
  - guardrails.integration.test.ts
  - Active-only pipeline picker for developers
affects: [07-04]
tech-stack:
  added: []
  patterns: [throwOnViolation at promotion trust boundary]
key-files:
  created:
    - apps/api/src/__tests__/guardrails.integration.test.ts
  modified:
    - apps/api/src/services/promotion-run.service.ts
    - apps/web/src/hooks/use-pipelines.ts
    - apps/web/src/app/runs/new/page.tsx
requirements-completed: [GRD-02, GRD-03]
duration: 25min
completed: 2026-06-22
---

# Phase 7 Plan 03: Guardrail Enforcement Summary

**Promotion create/start reject out-of-bounds requests; developer picker shows active pipelines only.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Wired `validatePromotionRequest` into `createRun` and `startRun` with 403/422/404 mapping
- Added integration tests for flagKey mismatch, inactive pipeline, startRun guard, valid flow
- Extended `usePipelines({ activeOnly: true })` on `/runs/new`

## Task Commits

1. **Tasks 1–3 (combined):** `f1b21e7` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Legacy API test fixtures missing latency_p95**
- **Found during:** Full API test run
- **Fix:** Updated promotion-runs test seeds to use `standardStages()[0]` with both metrics
- **Commit:** `f1b21e7`

## Self-Check: PASSED

- apps/api/src/__tests__/guardrails.integration.test.ts — FOUND
- Commit f1b21e7 — FOUND
