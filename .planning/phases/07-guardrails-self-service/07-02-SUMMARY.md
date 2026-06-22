---
phase: 07-guardrails-self-service
plan: 02
subsystem: api
tags: [fastify, prisma, pipeline-crud, audit]
requires:
  - phase: 07-01
    provides: contracts and GuardrailService
provides:
  - POST/PATCH /v1/pipelines
  - PipelineConfigAudit persistence
  - Extended GET list/detail with gate policies
affects: [07-03, 07-04]
tech-stack:
  added: [PipelineConfigAudit model]
  patterns: [PipelineService request-scoped DB, config audit append]
key-files:
  created:
    - apps/api/src/services/pipeline.service.ts
    - apps/api/src/__tests__/pipelines.create.test.ts
    - packages/db/src/repositories/pipeline-audit.repository.ts
  modified:
    - apps/api/src/routes/pipelines.ts
    - apps/api/src/app.ts
    - packages/db/prisma/schema.prisma
requirements-completed: [PIPE-01, TELE-01, TELE-02, GRD-01, API-03]
duration: 40min
completed: 2026-06-22
---

# Phase 7 Plan 02: Pipeline CRUD API Summary

**REST pipeline configuration with nested stages/gate policies, config audit, and integration tests.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added `PipelineConfigAudit` model + migration and `PipelineAuditRepository`
- Implemented `PipelineService` with create/update/list/detail and audit on create/deactivate
- Refactored pipeline routes for POST/PATCH and extended GET responses
- Added `pipelines.create.test.ts`; updated `pipelines.list.test.ts`

## Task Commits

1. **Tasks 1–3 (combined):** `d16f3b7` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing metric validation returns 400 not 422**
- **Found during:** Task 2 tests
- **Issue:** Zod route validation rejects incomplete gate policies before service layer
- **Fix:** Test expects 400 `validation_error` (schema layer is authoritative)
- **Commit:** `d16f3b7`

## Self-Check: PASSED

- apps/api/src/services/pipeline.service.ts — FOUND
- packages/db/prisma/migrations/20260622222931_add_pipeline_config_audit — FOUND
- Commit d16f3b7 — FOUND
