# Phase 5: REST API - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Mode:** Yolo (recommended defaults auto-selected)

<domain>
## Phase Boundary

Expose programmatic promotion control via Fastify REST API (API-01, API-02). Operators create pending promotion runs, start workflows, send pause/resume/abort signals, and query run status plus gate evaluation history with structured forensics when paused (roadmap SC-3).

Phase 5 is the **control plane HTTP layer** over existing Postgres state and Temporal workflows from Phase 4. It does NOT implement pipeline/guardrail configuration (API-03 → Phase 7), CLI (API-04 → v2/Phase 5+), dashboard UI (Phase 6), RBAC enforcement (GRD-04 → Phase 7), or direct LD/Prometheus calls.

</domain>

<decisions>
## Implementation Decisions

### API Surface (API-01 / API-02)
- **D-01:** Resource-oriented routes under `/v1/promotion-runs` — separate create (pending) and start (Temporal) operations
- **D-02:** Control actions as POST sub-resources: `/start`, `/pause`, `/resume`, `/abort`
- **D-03:** Read endpoints: `GET /v1/promotion-runs/:id` (status), `GET .../gate-results`, `GET .../audit-events`
- **D-04:** Read-only `GET /v1/pipelines/:id` for pipeline context when creating runs (no pipeline mutation)
- **D-05:** Gate forensics embedded in status response when `status === 'paused'` — latest failing gate results + stage context + `pauseReason` (SC-3)

### Temporal Integration
- **D-06:** Extract `@ff-promo/promotion-control` package — shared `startPromotionRun`, signal helpers, re-export workflow signals
- **D-07:** Workflow handle ID = `promotionRun.temporalWorkflowId ?? promotionRun.id` (Phase 4 convention)
- **D-08:** API sends Temporal signals only; gate evaluation and LD writes remain worker activities
- **D-09:** Optional live overlay via `statusQuery` on GET status when workflow is running

### Stack & Validation
- **D-10:** Fastify 5.8.5 + `@fastify/type-provider-zod` + `@fastify/swagger` per project stack
- **D-11:** Request/response Zod schemas in `packages/contracts/src/api.ts`; routes use type provider
- **D-12:** Standard error mapping: 404 not found, 409 invalid state transition, 400 validation

### Actor & Auth (deferred enforcement)
- **D-13:** Accept `actor` object in create/start/control request bodies; persist `actorType: api_key` when using API key header
- **D-14:** v1 auth = optional `API_KEY` env check (preHandler); no RBAC until Phase 7
- **D-15:** Audit on workflow start uses request actor; signal-initiated audits remain workflow/system (no workflow change in v1)

### Testing
- **D-16:** `fastify.inject()` route tests + testcontainers PostgreSQL (reuse `packages/db` setup)
- **D-17:** Injectable mock Temporal `Client` for control route unit tests (mirror Phase 4 `temporalClient` injection)
- **D-18:** Integration test: create → start (mock temporal) → GET status; abort path for SAFE-02 via API

### Claude's Discretion
- Exact OpenAPI path prefix (`/v1` vs unversioned)
- Whether `GET /v1/promotion-runs` list endpoint ships in Phase 5 or defers to Phase 6
- `promotion-control` package vs worker re-export for `startPromotionRun`
- Combined create+start convenience endpoint
- Swagger UI mount path (`/documentation` vs `/docs`)

</decisions>

<canonical_refs>
## Canonical References

### Project & Requirements
- `.planning/PROJECT.md` — pause-and-alert, dual user model
- `.planning/REQUIREMENTS.md` — API-01, API-02
- `.planning/ROADMAP.md` — Phase 5 goal and success criteria

### Prior Phase Context
- `.planning/phases/04-promotion-engine/04-CONTEXT.md` — D-15/D-16 deferred REST to Phase 5
- `.planning/phases/04-promotion-engine/04-04-SUMMARY.md` — `startPromotionRun` deliverable

### Stack
- `CLAUDE.md` — Fastify, Zod, Temporal client, monorepo layout

### Integration Points
- `apps/worker/src/lib/start-promotion-run.ts` — extract to promotion-control
- `apps/worker/src/workflows/signals.ts` — pause/resume/abort/statusQuery
- `packages/db/src/repositories/*.ts` — PromotionRun, GateResult, Audit, Pipeline
- `packages/contracts/src/promotion-run.ts` — create/state schemas

</canonical_refs>

<deferred>
## Deferred Ideas

- API-03 pipeline/guardrail configuration REST — Phase 7
- API-04 CLI — separate app shell; shares routes conceptually
- GRD-04 RBAC — Phase 7
- `GET /v1/promotion-runs` list with filters — Phase 6 dashboard needs
- Webhook/alerting on pause — TELE-05

</deferred>

---

*Phase: 05-rest-api*
*Context gathered: 2026-06-22 via yolo defaults*
