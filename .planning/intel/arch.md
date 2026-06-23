---
updated_at: "2026-06-20T00:00:00.000Z"
---

## Architecture Overview

**Pattern:** Horizontal-layer monorepo — shared contracts at the center, adapters on the sides, Temporal orchestration for promotion lifecycle, Fastify REST for control plane, Next.js dashboard for operators.

```
packages/contracts  ← Zod schemas (single validation source)
        ↓
packages/db         ← Prisma + repositories
packages/ld-adapter ← LaunchDarkly REST
packages/telemetry  ← Prometheus PromQL gates
packages/promotion-control ← Temporal signals/start
        ↓
apps/worker         ← promotionWorkflow + activities
apps/api            ← REST control + guardrails
apps/web            ← Dashboard + BFF proxy
```

## Key Components

| Component | Path | Responsibility |
|-----------|------|----------------|
| Contracts | `packages/contracts/src/` | Shared Zod schemas for API, pipeline, promotion, telemetry |
| Database layer | `packages/db/src/repositories/` | Prisma repositories: Pipeline, PromotionRun, GateResult, Audit, PipelineConfigAudit |
| LD adapter | `packages/ld-adapter/src/` | Flag read/write, semantic patch, variation resolution, rate limiting |
| Telemetry adapter | `packages/telemetry/src/` | PromQL builder, gate evaluation, preflight checks |
| Promotion control | `packages/promotion-control/src/` | Temporal workflow start, pause/resume/abort signals |
| Promotion workflow | `apps/worker/src/workflows/promotion.workflow.ts` | Multi-stage dev→staging→prod progression with gate waits |
| Worker activities | `apps/worker/src/activities/` | persistRunState, evaluateGate, runPreflight, applyStageTargeting, recordAuditEvent |
| REST API | `apps/api/src/app.ts` | Fastify app: promotion runs, pipelines, health, Swagger |
| Guardrail service | `apps/api/src/services/guardrail.service.ts` | Pure validation: pipeline config + promotion request bounds |
| Pipeline service | `apps/api/src/services/pipeline.service.ts` | Pipeline CRUD with audit and guardrail pre-check |
| Promotion run service | `apps/api/src/services/promotion-run.service.ts` | Run lifecycle + Temporal integration + guardrail enforcement |
| Dashboard | `apps/web/src/app/` | `/runs`, `/pipelines` pages; React Query hooks; MSW tests |
| BFF proxy | `apps/web/src/app/api/ff-promo/[[...path]]/route.ts` | Proxies browser requests to Fastify with API key |

## Data Flow

**Promotion create/start:**
`Dashboard POST /api/ff-promo/v1/promotion-runs` → BFF proxy → `promotion-run.service.createRun` → `validatePromotionRequest` → `PromotionRunRepository.create` → `POST .../start` → `startPromotionRun` (Temporal) → `promotionWorkflow` → activities (preflight → gate eval → LD targeting)

**Pipeline configuration:**
`Dashboard POST /api/ff-promo/v1/pipelines` → `pipeline.service.createPipeline` → `validatePipelineConfig` → `PipelineRepository.create` → `PipelineAuditRepository.append(pipeline_created)`

**Gate evaluation:**
`evaluateGate` activity → `@ff-promo/telemetry.evaluateStageGates` → Prometheus instant query → verdict persisted via `GateResultRepository`

## Conventions

- **Package naming:** `@ff-promo/<name>` workspace packages; apps under `apps/`, libraries under `packages/`
- **Module system:** ESM (`"type": "module"`), `.js` extensions in TypeScript imports
- **Validation:** Zod schemas in `@ff-promo/contracts`; route validation via `@fastify/type-provider-zod`
- **Service factories:** `createPromotionRunService`, `createPipelineService` — request-scoped DB via try/finally
- **Repository pattern:** One repository per aggregate in `packages/db/src/repositories/`
- **Testing:** Vitest multi-project (`db`, `api`, `web`, `worker`, `ld-adapter`, `telemetry`); testcontainers for API/DB integration; MSW for web integration tests
- **Lint/format:** Biome (`biome check`)
- **Build:** Turbo pipeline with `dependsOn: ["^build"]`
- **Guardrails:** Required metrics `error_rate` + `latency_p95` per stage; env order dev→staging→prod; immutable pipeline config (deactivate + new version)

## Dashboard Routes

| Route | File | Purpose |
|-------|------|---------|
| `/runs` | `apps/web/src/app/runs/page.tsx` | Active/historical promotion runs |
| `/runs/[id]` | `apps/web/src/app/runs/[id]/page.tsx` | Run detail, forensics, controls |
| `/runs/new` | `apps/web/src/app/runs/new/page.tsx` | Create run (active pipelines only) |
| `/pipelines` | `apps/web/src/app/pipelines/page.tsx` | Pipeline list with active/inactive badges |
| `/pipelines/new` | `apps/web/src/app/pipelines/new/page.tsx` | 3-stage pipeline form |
| `/pipelines/[id]` | `apps/web/src/app/pipelines/[id]/page.tsx` | Read-only detail + deactivate |
