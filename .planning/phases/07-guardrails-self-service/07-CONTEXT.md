# Phase 7: Guardrails & Self-Service - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Mode:** Yolo (recommended defaults auto-selected)

<domain>
## Phase Boundary

Deliver platform configuration and server-side guardrail enforcement (PIPE-01, TELE-01, TELE-02, GRD-01–03, API-03, UI-04). Platform engineers define multi-environment pipelines with per-stage SLO thresholds; developers self-serve promotions within those bounds; the API rejects out-of-bounds requests.

Phase 7 completes the v1 milestone configuration layer. It builds on existing `Pipeline`, `Stage`, and `GatePolicy` Prisma models (seeded in Phase 1) — not greenfield schema unless guardrail metadata requires extension.

Phase 7 does NOT implement GRD-04 RBAC/Better Auth, API-04 CLI, PIPE-05/06 sub-stages, TELE-05 alerting, or GRD-05/06 approval/templates (v2).

</domain>

<decisions>
## Implementation Decisions

### Data Model & Contracts
- **D-01:** Reuse `Pipeline` + `Stage` + `GatePolicy` as source of truth for PIPE-01, TELE-01, TELE-02 — gate policies already store `metricType`, `threshold`, `serviceName`
- **D-02:** Add `GuardrailPolicy` JSON or table for GRD-01 extras: `allowedEnvironments`, `requirePreflightPass`, `maxConcurrentRunsPerFlag` (minimal v1: validate flagKey match + active pipeline + ordered environments)
- **D-03:** Extend `packages/contracts/src/pipeline.ts` with `PipelineCreateInput`, `PipelineUpdateInput`, `PipelineResponse`, guardrail schemas; export from index
- **D-04:** Pipeline versioning: new config creates new `version` row or bumps version per `name_version` unique — v1 use immutable create + soft-deactivate (`isActive=false`) for updates

### API (API-03, GRD-03)
- **D-05:** `POST /v1/pipelines` — create pipeline with stages + gate policies (PIPE-01, TELE-01, TELE-02)
- **D-06:** `PUT /v1/pipelines/:id` or `PATCH` — update metadata/policies (platform engineer); deactivate via `isActive`
- **D-07:** `GET /v1/pipelines/:id` already exists; extend list response if needed
- **D-08:** `GuardrailService.validatePromotionRequest({ pipelineId, flagKey })` called from `createRun` and `startRun` — return 403/422 on violation (GRD-03)
- **D-09:** GRD-02: developers use existing create/start flows when pipeline is active and flagKey matches — no separate endpoint

### Enforcement Rules (GRD-01, GRD-03)
- **D-10:** Hard rejects: pipeline not found/inactive, `flagKey` mismatch, empty stages, duplicate stage environments, missing required gate policies (error_rate + latency_p95 per stage)
- **D-11:** Soft policy v1: stages must be monotonic dev→staging→prod order (validate `orderIndex` and `StageEnvironmentSchema`)
- **D-12:** Audit pipeline create/update with actor from request body (same actor pattern as Phase 5)

### Dashboard (UI-04)
- **D-13:** `/pipelines` — list pipelines with stage count and active badge
- **D-14:** `/pipelines/new` — multi-step or single form: name, flagKey, projectKey, stages with gate policy editors (error rate + latency thresholds)
- **D-15:** `/pipelines/[id]` — read-only detail + deactivate button for platform engineers
- **D-16:** Reuse api-client BFF pattern from Phase 6; add pipeline CRUD methods

### Auth (deferred)
- **D-17:** v1 no Better Auth — optional `X-Platform-Key` vs developer key is out of scope; all authenticated callers can configure until GRD-04
- **D-18:** Actor `actorType: 'user'` with distinct `actorId` for platform vs developer in audit only

### Testing
- **D-19:** API integration tests: create pipeline, reject createRun with wrong flagKey, accept valid self-service flow
- **D-20:** Web MSW tests for pipeline form validation and submit
- **D-21:** Repository tests for pipeline update/deactivate

### Claude's Discretion
- Separate `GuardrailPolicy` table vs JSON column on `Pipeline`
- PATCH vs PUT for pipeline updates
- Whether pipeline edits create new version row vs in-place update
- Dashboard form UX (single page vs wizard)

</decisions>

<canonical_refs>
## Canonical References

### Project & Requirements
- `.planning/PROJECT.md` — dual user model (platform + developers)
- `.planning/REQUIREMENTS.md` — PIPE-01, TELE-01, TELE-02, GRD-01–03, API-03, UI-04
- `.planning/ROADMAP.md` — Phase 7 goal (final v1 phase)

### Prior Phase Context
- `.planning/phases/06-operator-dashboard/06-CONTEXT.md` — deferred UI-04, GRD-04
- `.planning/phases/05-rest-api/05-CONTEXT.md` — API patterns, actor, auth deferral
- `packages/contracts/src/pipeline.ts` — existing create input schemas
- `packages/db/prisma/schema.prisma` — Pipeline, Stage, GatePolicy models
- `packages/db/src/repositories/pipeline.repository.ts` — create/findById/listActive
- `apps/api/src/services/promotion-run.service.ts` — createRun hook point for guardrails

### Stack
- `CLAUDE.md` — Fastify, Zod, Next.js dashboard

</canonical_refs>

<deferred>
## Deferred Ideas

- GRD-04 RBAC / Better Auth — v2
- API-04 CLI — v2
- GRD-05 approval gates, GRD-06 templates — v2
- PIPE-05/06 sub-stage rollouts — v2
- TELE-05/06 alerting and soak time — v2
- Per-role UI hiding (all config UI visible in v1)

</deferred>

---

*Phase: 07-guardrails-self-service*
*Context gathered: 2026-06-22 via yolo defaults*
