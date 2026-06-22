---
phase: 07-guardrails-self-service
plan: 01
subsystem: api
tags: [zod, guardrails, pipeline, contracts]
requires:
  - phase: 06-operator-dashboard
    provides: dashboard and API patterns
provides:
  - Pipeline CRUD contracts with guardrail refinements
  - Pure GuardrailService validation module
  - PipelineRepository deactivate/listAll/resolveNextVersion
affects: [07-02, 07-03, 07-04]
tech-stack:
  added: []
  patterns: [Zod superRefine at contract boundary, pure validation service]
key-files:
  created:
    - apps/api/src/services/guardrail.service.ts
    - apps/api/src/__tests__/guardrail.service.test.ts
    - packages/db/src/__tests__/pipeline-fixtures.ts
  modified:
    - packages/contracts/src/pipeline.ts
    - packages/contracts/src/api.ts
    - apps/api/src/errors/api-error.ts
    - packages/db/src/repositories/pipeline.repository.ts
key-decisions:
  - "MetricTypeSchema restricted to error_rate and latency_p95"
  - "validatePromotionRequest is pure — callers fetch pipeline from DB"
  - "Immutable versioning via resolveNextVersion on create"
requirements-completed: [GRD-01, GRD-03]
duration: 45min
completed: 2026-06-22
---

# Phase 7 Plan 01: Contracts & Guardrail Foundation Summary

**Shared Zod contracts, pure GuardrailService, and repository versioning/deactivate support for pipeline guardrails.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Extended `pipeline.ts` and `api.ts` with create/update/response schemas, `GuardrailViolationSchema`, and stage refinements
- Implemented `validatePipelineConfig` and `validatePromotionRequest` with unit tests for all D-10/D-11 rules
- Added `forbidden()` and `unprocessableEntity()` API error helpers
- Extended `PipelineRepository` with `deactivate`, `listAll`, `resolveNextVersion`

## Task Commits

1. **Task 1–3 (combined):** `74e3349` (feat)

## Deviations from Plan

None — plan executed as written.

## Self-Check: PASSED

- apps/api/src/services/guardrail.service.ts — FOUND
- packages/contracts/src/pipeline.ts — FOUND
- Commit 74e3349 — FOUND
