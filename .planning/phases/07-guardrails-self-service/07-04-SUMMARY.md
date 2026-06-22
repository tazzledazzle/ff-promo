---
phase: 07-guardrails-self-service
plan: 04
subsystem: ui
tags: [nextjs, dashboard, pipelines, msw]
requires:
  - phase: 07-03
    provides: pipeline API and guardrails
provides:
  - /pipelines list, create, detail dashboard routes
  - api-client pipeline CRUD methods
  - MSW pipeline form tests
  - README Phase 7 documentation
affects: []
tech-stack:
  added: []
  patterns: [fixed 3-stage pipeline form, deactivate via PATCH]
key-files:
  created:
    - apps/web/src/app/pipelines/page.tsx
    - apps/web/src/app/pipelines/new/page.tsx
    - apps/web/src/app/pipelines/[id]/page.tsx
    - apps/web/src/components/pipelines/pipeline-form.tsx
    - apps/web/src/__tests__/integration/pipeline-form.test.tsx
  modified:
    - apps/web/src/lib/api-client.ts
    - README.md
requirements-completed: [UI-04]
duration: 35min
completed: 2026-06-22
---

# Phase 7 Plan 04: Pipeline Dashboard UI Summary

**Platform engineer pipeline configuration UI with gate policy editors, deactivate flow, and MSW tests.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Added `/pipelines`, `/pipelines/new`, `/pipelines/[id]` with table, form, and detail components
- Extended api-client with `createPipeline`, `updatePipeline`, `deactivatePipeline`
- Added nav links in layout; MSW handlers and pipeline-form integration tests
- Documented Phase 7 in README with curl example

## Task Commits

1. **Tasks 1–3 (combined):** `400c222` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing shadcn Input/Label components**
- **Fix:** Used native inputs matching runs/new styling
- **Commit:** `400c222`

**2. [Rule 3 - Blocking] MetricType narrowing in worker stage-targeting**
- **Fix:** Cast DB metricType to `MetricType` after contracts enum tightening
- **Commit:** `400c222`

## Self-Check: PASSED

- apps/web/src/app/pipelines/page.tsx — FOUND
- apps/web/src/__tests__/integration/pipeline-form.test.tsx — FOUND
- Commit 400c222 — FOUND
