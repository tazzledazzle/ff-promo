# Phase 7: Guardrails & Self-Service - Research

**Researched:** 2026-06-22
**Domain:** Pipeline configuration CRUD, server-side guardrail enforcement, platform config dashboard
**Confidence:** HIGH

## Summary

Phase 7 completes the v1 configuration layer on top of models and repositories seeded in Phase 1. The Prisma schema already has `Pipeline`, `Stage`, and `GatePolicy` with the fields needed for PIPE-01, TELE-01, and TELE-02 (`metricType`, `threshold`, `serviceName`, `windowSeconds`, etc.) [VERIFIED: `packages/db/prisma/schema.prisma`]. `PipelineRepository.create()` and `PipelineCreateInputSchema` exist; Phase 6 delivered `GET /v1/pipelines` (list) and `GET /v1/pipelines/:id` (detail without gate policies) [VERIFIED: `apps/api/src/routes/pipelines.ts`]. **Missing:** `POST`/`PATCH` pipeline routes, `GuardrailService`, guardrail checks in `createRun`/`startRun`, extended contracts/responses, pipeline config audit, and dashboard pages `/pipelines`, `/pipelines/new`, `/pipelines/[id]`.

`createRun` today only verifies the pipeline exists — it does not check `isActive`, `flagKey` match, stage completeness, or required gate policies [VERIFIED: `apps/api/src/services/promotion-run.service.ts` lines 48–55]. GRD-03 requires a centralized `GuardrailService.validatePromotionRequest({ pipelineId, flagKey })` called from both `createRun` and `startRun`, returning 403 (policy violation) or 422 (invalid config) before any run is persisted or started.

For v1 guardrail extras (GRD-01), locked context defers `GuardrailPolicy` table complexity — enforce bounds from existing fields: active pipeline, `flagKey` match, non-empty monotonic `dev → staging → prod` stages, and both `error_rate` + `latency_p95` gate policies per stage [CITED: `07-CONTEXT.md` D-10, D-11]. Pipeline updates use immutable versioning: deactivate (`isActive=false`) rather than in-place stage mutation when config changes materially (D-04).

**Primary recommendation:** Wave 0 extends contracts + `GuardrailService` with unit tests; Wave 1 adds pipeline CRUD API + repository methods + config audit; Wave 2 wires guardrails into promotion run service; Wave 3 delivers dashboard UI-04 mirroring `/runs/new` patterns.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Data Model & Contracts
- **D-01:** Reuse `Pipeline` + `Stage` + `GatePolicy` as source of truth for PIPE-01, TELE-01, TELE-02 — gate policies already store `metricType`, `threshold`, `serviceName`
- **D-02:** Add `GuardrailPolicy` JSON or table for GRD-01 extras: `allowedEnvironments`, `requirePreflightPass`, `maxConcurrentRunsPerFlag` (minimal v1: validate flagKey match + active pipeline + ordered environments)
- **D-03:** Extend `packages/contracts/src/pipeline.ts` with `PipelineCreateInput`, `PipelineUpdateInput`, `PipelineResponse`, guardrail schemas; export from index
- **D-04:** Pipeline versioning: new config creates new `version` row or bumps version per `name_version` unique — v1 use immutable create + soft-deactivate (`isActive=false`) for updates

#### API (API-03, GRD-03)
- **D-05:** `POST /v1/pipelines` — create pipeline with stages + gate policies (PIPE-01, TELE-01, TELE-02)
- **D-06:** `PUT /v1/pipelines/:id` or `PATCH` — update metadata/policies (platform engineer); deactivate via `isActive`
- **D-07:** `GET /v1/pipelines/:id` already exists; extend list response if needed
- **D-08:** `GuardrailService.validatePromotionRequest({ pipelineId, flagKey })` called from `createRun` and `startRun` — return 403/422 on violation (GRD-03)
- **D-09:** GRD-02: developers use existing create/start flows when pipeline is active and flagKey matches — no separate endpoint

#### Enforcement Rules (GRD-01, GRD-03)
- **D-10:** Hard rejects: pipeline not found/inactive, `flagKey` mismatch, empty stages, duplicate stage environments, missing required gate policies (error_rate + latency_p95 per stage)
- **D-11:** Soft policy v1: stages must be monotonic dev→staging→prod order (validate `orderIndex` and `StageEnvironmentSchema`)
- **D-12:** Audit pipeline create/update with actor from request body (same actor pattern as Phase 5)

#### Dashboard (UI-04)
- **D-13:** `/pipelines` — list pipelines with stage count and active badge
- **D-14:** `/pipelines/new` — multi-step or single form: name, flagKey, projectKey, stages with gate policy editors (error rate + latency thresholds)
- **D-15:** `/pipelines/[id]` — read-only detail + deactivate button for platform engineers
- **D-16:** Reuse api-client BFF pattern from Phase 6; add pipeline CRUD methods

#### Auth (deferred)
- **D-17:** v1 no Better Auth — optional `X-Platform-Key` vs developer key is out of scope; all authenticated callers can configure until GRD-04
- **D-18:** Actor `actorType: 'user'` with distinct `actorId` for platform vs developer in audit only

#### Testing
- **D-19:** API integration tests: create pipeline, reject createRun with wrong flagKey, accept valid self-service flow
- **D-20:** Web MSW tests for pipeline form validation and submit
- **D-21:** Repository tests for pipeline update/deactivate

### Claude's Discretion
- Separate `GuardrailPolicy` table vs JSON column on `Pipeline`
- PATCH vs PUT for pipeline updates
- Whether pipeline edits create new version row vs in-place update
- Dashboard form UX (single page vs wizard)

### Deferred Ideas (OUT OF SCOPE)
- GRD-04 RBAC / Better Auth — v2
- API-04 CLI — v2
- GRD-05 approval gates, GRD-06 templates — v2
- PIPE-05/06 sub-stage rollouts — v2
- TELE-05/06 alerting and soak time — v2
- Per-role UI hiding (all config UI visible in v1)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | Platform engineer defines multi-environment pipelines (dev → staging → prod) | Reuse `Pipeline` + `Stage`; `POST /v1/pipelines` with `StageInputSchema` + monotonic order validation (D-11); seed pattern in `packages/db/src/seed.ts` |
| TELE-01 | Configure error rate SLO threshold per pipeline stage | `GatePolicy.metricType: 'error_rate'` per stage; form field + `GatePolicyInputSchema`; worker already evaluates via `packages/telemetry` [VERIFIED: `build-promql.ts`] |
| TELE-02 | Configure latency (p95) SLO threshold per pipeline stage | `GatePolicy.metricType: 'latency_p95'` per stage; required alongside error_rate (D-10) |
| GRD-01 | Configure guardrails (allowed environments, promotion policies) | v1 minimal: derive from `flagKey`, `isActive`, stage env order — no separate policy store required; optional `guardrailPolicy Json?` deferred |
| GRD-02 | Developer triggers promotion within guardrail bounds without platform intervention | Existing `POST /v1/promotion-runs` + start; auto-fill flagKey from pipeline in `/runs/new` [VERIFIED: `apps/web/src/app/runs/new/page.tsx`] |
| GRD-03 | System rejects out-of-bounds promotion requests server-side | `GuardrailService` in API layer before persist/start; 403/422 via new `ApiError` helpers |
| API-03 | REST API for pipeline and guardrail configuration | `POST /v1/pipelines`, `PATCH /v1/pipelines/:id`; extend `GET` list/detail responses |
| UI-04 | Dashboard for pipeline/guardrail configuration | `/pipelines`, `/pipelines/new`, `/pipelines/[id]`; extend `api-client.ts` + MSW handlers |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Fastify 5.8.5 + Zod 4.4.3 type provider, Prisma 7.8.0, Next.js 16 dashboard, shared `@ff-promo/contracts` [CITED: CLAUDE.md]
- **Telemetry v1:** Error rate and latency p95 only — gate policies must use `error_rate` and `latency_p95` metric types [CITED: CLAUDE.md]
- **Failure mode:** Pause-and-alert on breach; guardrails reject invalid requests at API boundary [CITED: CLAUDE.md]
- **Do not use:** Next.js as primary backend; middleware-only auth; hand-rolled validation outside Zod [CITED: CLAUDE.md What NOT to Use]
- **Dual user model:** Platform configures; developers self-serve within bounds [CITED: PROJECT.md]
- **GSD workflow:** Plans execute via `/gsd-execute-phase`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pipeline CRUD validation | API / Backend | `packages/contracts` | Zod schemas are single source of truth; API rejects before DB write |
| Guardrail enforcement (GRD-03) | API / Backend | — | Must run server-side before `PromotionRun` create/start; never trust dashboard |
| Pipeline persistence | Database / Storage | API repositories | `PipelineRepository` owns nested stage + gatePolicy creates |
| Config audit (D-12) | Database / Storage | API service | Append-only log separate from promotion-run `AuditEvent` (no `promotionRunId`) |
| Pipeline list/detail UI | Browser / Client | Frontend Server (BFF proxy) | TanStack Query + existing Route Handler proxy pattern from Phase 6 |
| Gate policy editors (TELE-01/02) | Browser / Client | — | Form collects thresholds; API validates completeness |
| Self-service create run (GRD-02) | Browser / Client → API | — | Existing `/runs/new`; guardrails added server-side only |
| Telemetry gate evaluation | Worker | Telemetry package | Unchanged — reads `GatePolicy` rows configured in Phase 7 |
| RBAC / role separation | — (v2 GRD-04) | — | Out of scope; actor metadata only |

## Existing Schema & Code Reuse

### Prisma models (no greenfield unless audit extension) [VERIFIED: schema.prisma]

| Model | Phase 7 use | Notes |
|-------|-------------|-------|
| `Pipeline` | CRUD target | `name`, `version`, `flagKey`, `projectKey`, `isActive`; `@@unique([name, version])` drives versioning |
| `Stage` | Nested create | `orderIndex`, `environment`, `displayName`; unique per pipeline |
| `GatePolicy` | Nested create | `metricType`, `threshold`, `serviceName`, `windowSeconds`, `minSampleSize` |
| `PromotionRun` | Guardrail consumer | `pipelineVersion` snapshotted at create [VERIFIED: `promotion-run.repository.ts`] |
| `AuditEvent` | Promotion runs only | **Not suitable** for pipeline config audit — requires `promotionRunId` |

### Repository gaps [VERIFIED: `pipeline.repository.ts`]

| Method | Status | Phase 7 action |
|--------|--------|----------------|
| `create(input)` | ✅ Exists | Add pre-create validation call from service layer |
| `findById(id)` | ✅ Exists | Used by guardrails + detail |
| `findByFlagKey(flagKey)` | ✅ Exists | Optional for future lookups |
| `listActive()` | ✅ Exists | Extend list route to include `isActive`, `version` |
| `deactivate(id)` | ❌ Missing | `update({ isActive: false })` |
| `listAll()` | ❌ Missing | Platform list shows inactive pipelines with badge |
| `createNextVersion(name, input)` | ❌ Missing | Bump `version` on re-create after deactivate (D-04) |

### Contracts gaps [VERIFIED: `packages/contracts/src/pipeline.ts`, `api.ts`]

| Schema | Status | Phase 7 action |
|--------|--------|----------------|
| `PipelineCreateInputSchema` | ✅ Exists | Add stricter refinements: required metrics, stage count ≥ 1 |
| `PipelineCreateRequestSchema` | ❌ Missing | Extend with `actor`, optional `description` |
| `PipelineUpdateInputSchema` | ❌ Missing | `{ isActive?: boolean; description?: string; actor }` — no in-place stage edit v1 |
| `PipelineResponseSchema` | ❌ Missing | Full nested stages + gatePolicies + metadata |
| `PipelineListItemSchema` | ✅ Partial | Add `isActive`, `version`, `projectKey` |
| `PipelineDetailResponseSchema` | ✅ Partial | Extend with `gatePolicies` per stage, `isActive`, `version` |
| `GuardrailViolationSchema` | ❌ Missing | `{ code, message }` for API error bodies |
| `MetricTypeSchema` | ❌ Missing | `z.enum(['error_rate', 'latency_p95'])` — align with telemetry [VERIFIED: `packages/telemetry/src/query/build-promql.ts`] |

### API routes gaps [VERIFIED: `apps/api/src/routes/pipelines.ts`]

| Route | Status |
|-------|--------|
| `GET /v1/pipelines` | ✅ List active only — extend for platform view |
| `GET /v1/pipelines/:id` | ✅ Stages without gate policies |
| `POST /v1/pipelines` | ❌ |
| `PATCH /v1/pipelines/:id` | ❌ |

### Promotion run hook point [VERIFIED: `promotion-run.service.ts`]

```typescript
// Current createRun — guardrail insertion point (before repos.promotionRun.create)
const pipeline = await repos.pipeline.findById(input.pipelineId);
if (!pipeline) throw notFound(...);
// ADD: GuardrailService.validatePromotionRequest({ pipeline, flagKey: input.flagKey })
```

Same validation in `startRun` before audit append — catches runs created before guardrails existed or race conditions.

## Standard Stack

### Core (existing — no new runtime dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | 5.8.5 | Pipeline CRUD routes | Phase 5 pattern; Zod type provider [VERIFIED: npm registry] [CITED: CLAUDE.md] |
| `zod` | 4.4.3 | Request/response + guardrail schemas | Shared in `@ff-promo/contracts` [VERIFIED: npm registry] |
| `@ff-promo/db` | workspace | `PipelineRepository` extensions | Existing Prisma client |
| `@ff-promo/contracts` | workspace | Pipeline + guardrail types | Single source of truth |
| `next` / `@tanstack/react-query` | 16.2.9 / 5.101.0 | Dashboard pages | Phase 6 patterns [VERIFIED: `apps/web`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `msw` | 2.14.6 | Pipeline form integration tests | D-20 — extend existing handlers |
| `@testing-library/react` | 16.3.2 | Form validation tests | Pipeline create page |
| `vitest` | 4.1.9 | api + web + db projects | D-19, D-20, D-21 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `GuardrailService` module in `apps/api` | Shared `packages/guardrails` package | API-only enforcement in v1; extract package if worker needs same rules later |
| `PipelineConfigAudit` Prisma model | Extend `AuditEvent` with optional `promotionRunId` | Pollutes promotion audit semantics; separate table cleaner |
| `guardrailPolicy Json?` on Pipeline | `GuardrailPolicy` table | JSON sufficient for v1 deferred fields; table when querying by policy rules |
| PATCH in-place stage edit | Deactivate + new version row | In-place edit risks orphan gate policies on active runs; D-04 favors immutable |
| PUT full replacement | PATCH partial | PATCH for `isActive` + metadata only — smaller blast radius |

**Installation:** No new npm packages required for Phase 7 core scope.

## Package Legitimacy Audit

> Phase 7 reuses existing workspace dependencies. slopcheck CLI failed at research time; versions verified via `npm view` where noted.

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `zod` | npm 4.4.3 | unavailable | Approved [VERIFIED: npm registry] |
| `fastify` | npm 5.8.5 | unavailable | Approved [VERIFIED: npm registry] |
| `msw` | npm 2.14.6 | unavailable | Approved — existing devDep |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck unavailable — no new packages introduced; existing pinned versions used.*

## Guardrail Enforcement Design

### GuardrailService location

`apps/api/src/services/guardrail.service.ts` — pure functions + thin factory for testability. Optionally export validation helpers to `packages/contracts` or `packages/db` if repository tests need them (D-21).

### Validation rules (maps to D-10, D-11)

```typescript
// Source: 07-CONTEXT.md D-10, D-11; telemetry metric types
const REQUIRED_METRICS = ['error_rate', 'latency_p95'] as const;
const ENV_ORDER = ['dev', 'staging', 'prod'] as const;

// Pipeline config validation (on POST /v1/pipelines)
validatePipelineConfig(input: PipelineCreateInput): GuardrailViolation[]

// Promotion request validation (on createRun + startRun)
validatePromotionRequest(opts: {
  pipeline: PipelineWithStages | null;
  flagKey: string;
}): GuardrailViolation[]
```

| Rule | Code | HTTP | Trigger |
|------|------|------|---------|
| Pipeline not found | `pipeline_not_found` | 404 | `createRun` — existing behavior |
| Pipeline inactive | `pipeline_inactive` | 403 | `isActive === false` |
| Flag key mismatch | `flag_key_mismatch` | 403 | `input.flagKey !== pipeline.flagKey` |
| No stages | `pipeline_empty` | 422 | `stages.length === 0` |
| Duplicate environment | `duplicate_environment` | 422 | Two stages same `environment` |
| Bad stage order | `invalid_stage_order` | 422 | `orderIndex` not 0..n-1 or env not monotonic dev→staging→prod |
| Missing error_rate | `missing_error_rate_policy` | 422 | Any stage lacks `error_rate` gate |
| Missing latency_p95 | `missing_latency_policy` | 422 | Any stage lacks `latency_p95` gate |

**Recommendation:** 403 for runtime policy violations (inactive, flag mismatch); 422 for malformed pipeline config on create and structural pipeline defects caught at promotion time.

Add to `apps/api/src/errors/api-error.ts`:

```typescript
export function forbidden(message: string) {
  return new ApiError(403, message, 'forbidden');
}

export function unprocessableEntity(message: string) {
  return new ApiError(422, message, 'unprocessable_entity');
}
```

### GRD-02 self-service flow (unchanged surface)

Developers continue using `POST /v1/promotion-runs` and `POST .../start`. `/runs/new` already auto-fills `flagKey` from selected pipeline [VERIFIED: `apps/web/src/app/runs/new/page.tsx`]. Phase 7 adds server rejection when user overrides flagKey to a non-matching value.

### Config audit (D-12)

Current `AuditEvent` requires `promotionRunId` [VERIFIED: schema.prisma]. **Recommend new model:**

```prisma
model PipelineConfigAudit {
  id         String    @id @default(cuid())
  pipelineId String
  pipeline   Pipeline  @relation(fields: [pipelineId], references: [id])
  action     String    // pipeline_created | pipeline_deactivated
  actorType  ActorType
  actorId    String
  displayName String?
  metadata   Json      @default("{}")
  occurredAt DateTime  @default(now())

  @@index([pipelineId, occurredAt])
}
```

Requires one Prisma migration — acceptable for D-12 compliance. Alternative (not recommended): stdout logging only — fails SAFE-01 spirit for config changes.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Platform engineer / Developer browser                                    │
│  /pipelines (list)  /pipelines/new (create)  /pipelines/[id] (detail)    │
│  /runs/new (self-service — existing)                                      │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ fetch via BFF proxy (Phase 6)
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  apps/api (Fastify)                                                       │
│  POST/PATCH /v1/pipelines ──► PipelineService ──► PipelineRepository      │
│  POST /v1/promotion-runs  ──► GuardrailService.validate ──► createRun     │
│  POST .../start           ──► GuardrailService.validate ──► startRun      │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     ┌─────────────────┐           ┌─────────────────┐
     │ PostgreSQL 16  │           │ Temporal worker  │
     │ Pipeline/Stage │           │ reads GatePolicy │
     │ GatePolicy     │           │ rows at runtime  │
     └─────────────────┘           └─────────────────┘
```

### Recommended Project Structure

```
packages/contracts/src/
  pipeline.ts              # extend: MetricType, responses, violations, create request
  api.ts                   # export pipeline response types used by routes

packages/db/
  prisma/schema.prisma     # + PipelineConfigAudit (D-12)
  src/repositories/
    pipeline.repository.ts   # + deactivate, listAll, createNextVersion
    pipeline-audit.repository.ts  # append config audit events

apps/api/src/
  services/
    pipeline.service.ts      # create, deactivate, map responses
    guardrail.service.ts     # validatePipelineConfig, validatePromotionRequest
  routes/pipelines.ts        # + POST, PATCH; extend GET schemas

apps/web/src/
  app/pipelines/
    page.tsx                 # D-13 list
    new/page.tsx             # D-14 create form
    [id]/page.tsx            # D-15 detail + deactivate
  hooks/
    use-pipelines.ts         # extend or add usePipelineMutations
  lib/api-client.ts          # + createPipeline, updatePipeline, listPipelines (all)
  __tests__/integration/
    pipeline-create.test.tsx # D-20
```

### Pattern 1: Pipeline create request (D-05, D-03)

```typescript
// packages/contracts/src/pipeline.ts
export const MetricTypeSchema = z.enum(['error_rate', 'latency_p95']);

export const PipelineCreateRequestSchema = PipelineCreateInputSchema.extend({
  description: z.string().optional(),
  actor: ActorSchema,
});

export const PipelineResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  version: z.number().int(),
  flagKey: z.string(),
  projectKey: z.string(),
  isActive: z.boolean(),
  stages: z.array(z.object({
    id: z.string(),
    orderIndex: z.number().int(),
    environment: StageEnvironmentSchema,
    displayName: z.string(),
    gatePolicies: z.array(z.object({
      id: z.string(),
      metricType: MetricTypeSchema,
      threshold: z.number(),
      serviceName: z.string(),
      windowSeconds: z.number().int(),
    })),
  })),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

### Pattern 2: GuardrailService integration in createRun

```typescript
// apps/api/src/services/promotion-run.service.ts
import { validatePromotionRequest } from './guardrail.service.js';
import { forbidden, unprocessableEntity } from '../errors/api-error.js';

const pipeline = await repos.pipeline.findById(input.pipelineId);
const violations = validatePromotionRequest({
  pipeline,
  flagKey: input.flagKey,
});
if (violations.length > 0) {
  const v = violations[0]!;
  if (v.code === 'pipeline_not_found') throw notFound(v.message);
  if (v.httpStatus === 403) throw forbidden(v.message);
  throw unprocessableEntity(v.message);
}
```

### Pattern 3: Pipeline create route (mirrors promotion-runs)

```typescript
// apps/api/src/routes/pipelines.ts
app.post('/', {
  schema: {
    body: PipelineCreateRequestSchema,
    response: { 201: PipelineResponseSchema },
  },
}, async (request, reply) => {
  const pipeline = await pipelineService.create(request.body);
  return reply.status(201).send(pipeline);
});

app.patch('/:id', {
  schema: {
    params: z.object({ id: z.string() }),
    body: PipelineUpdateRequestSchema,
    response: { 200: PipelineResponseSchema },
  },
}, async (request) => pipelineService.update(request.params.id, request.body));
```

### Pattern 4: Dashboard create form (mirror `/runs/new`)

Reuse: `createApiClient`, `dashboardActor()`, shadcn `Button`, alert regions, `useMutation` + `useRouter` redirect to `/pipelines/[id]` on success [VERIFIED: `apps/web/src/app/runs/new/page.tsx`].

Stage editor v1: fixed 3-row template (dev, staging, prod) with editable `displayName`, `serviceName`, `error_rate` threshold, `latency_p95` threshold — avoids dynamic stage add/remove complexity while satisfying PIPE-01.

### Pattern 5: Versioning on config change (D-04)

1. `PATCH /v1/pipelines/:id` with `{ isActive: false, actor }` — deactivates
2. `POST /v1/pipelines` with same `name`, incremented `version` (repo looks up max version for name) — creates replacement
3. In-flight runs keep `pipelineVersion` snapshot — unaffected

v1 dashboard: **deactivate only** on detail page; "create new version" can be manual via `/pipelines/new` with same name (planner discretion).

### Anti-Patterns to Avoid

- **Client-side-only guardrails:** UI validation is UX; GRD-03 requires API enforcement
- **In-place stage mutation:** Breaks `pipelineVersion` semantics on active runs
- **Reusing `AuditEvent` for pipelines:** Forces fake `promotionRunId` or schema hack
- **Skipping startRun validation:** Pending runs could be started after pipeline deactivated
- **listActive-only for platform list:** Inactive pipelines invisible — violates D-13 active badge

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Manual if-checks | Zod schemas + refinements in contracts | OpenAPI + shared types with dashboard |
| Pipeline nested create | Raw SQL | Prisma nested `create` in repository | Already proven in `PipelineRepository.create` |
| Metric type strings | Freeform input | `MetricTypeSchema` enum | Telemetry only supports `error_rate`, `latency_p95` |
| HTTP error mapping | Ad-hoc status codes | `ApiError` helpers | Consistent `{ error, message }` body |
| Form state for 3 stages | Redux | Local `useState` + single submit | Matches `/runs/new` simplicity |

## Common Pitfalls

### Pitfall 1: GET detail omits gate policies

**What goes wrong:** `/pipelines/[id]` cannot show TELE-01/02 thresholds.
**Why it happens:** Phase 6 detail schema strips `gatePolicies`.
**How to avoid:** Extend `PipelineDetailResponseSchema` and route mapper to include nested policies.
**Warning signs:** UI shows stage names but empty threshold columns.

### Pitfall 2: listActive hides deactivated pipelines

**What goes wrong:** Platform engineer deactivates pipeline; it vanishes from list with no audit trail visibility.
**Why it happens:** `GET /v1/pipelines` calls `listActive()` only.
**How to avoid:** Switch to `listAll()` ordered by `name`, `version desc`; show `isActive` badge (D-13).
**Warning signs:** Deactivate succeeds but pipeline "disappears".

### Pitfall 3: createRun succeeds with wrong flagKey

**What goes wrong:** Developer promotes wrong flag; worker targets mismatched LD flag.
**Why it happens:** No guardrail check today [VERIFIED: `promotion-run.service.ts`].
**How to avoid:** `GuardrailService` before `promotionRun.create` (D-08, D-19 test).
**Warning signs:** Integration test `reject createRun with wrong flagKey` fails.

### Pitfall 4: Unique constraint on pipeline name

**What goes wrong:** `POST` with duplicate `name` + same `version` throws Prisma P2002 → 500.
**Why it happens:** `@@unique([name, version])` without version bump logic.
**How to avoid:** Repository `resolveNextVersion(name)` before create; return 409 conflict if active duplicate name exists.
**Warning signs:** 500 on second pipeline with same name.

### Pitfall 5: Integration test pipeline missing both metrics

**What goes wrong:** Pipeline created in test with only `error_rate`; passes API create if validation omitted; worker gate evaluation incomplete.
**Why it happens:** Phase 1 tests used single-metric stages [VERIFIED: `pipeline.integration.test.ts`].
**How to avoid:** D-10 enforcement on create; update tests to include both metrics per stage.
**Warning signs:** Worker tests pass but API allows incomplete config.

### Pitfall 6: Dashboard form allows invalid env order

**What goes wrong:** User submits staging before dev; API 422 with unclear message.
**Why it happens:** Client does not pre-validate monotonic order.
**How to avoid:** Fixed dev/staging/prod rows in v1 form; disable env dropdown reordering.
**Warning signs:** MSW test submits out-of-order stages.

## Code Examples

### Required gate policies per stage

```typescript
// apps/api/src/services/guardrail.service.ts
const REQUIRED_METRICS = ['error_rate', 'latency_p95'] as const;

function validateStageGatePolicies(
  stage: { environment: string; gatePolicies: { metricType: string }[] },
): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  for (const metric of REQUIRED_METRICS) {
    if (!stage.gatePolicies.some((p) => p.metricType === metric)) {
      violations.push({
        code: `missing_${metric}`,
        message: `Stage ${stage.environment} missing required ${metric} gate policy`,
        httpStatus: 422,
      });
    }
  }
  return violations;
}
```

### Monotonic environment order

```typescript
const ENV_RANK = { dev: 0, staging: 1, prod: 2 } as const;

function validateStageOrder(
  stages: { orderIndex: number; environment: keyof typeof ENV_RANK }[],
): GuardrailViolation[] {
  const sorted = [...stages].sort((a, b) => a.orderIndex - b.orderIndex);
  let lastRank = -1;
  for (const stage of sorted) {
    const rank = ENV_RANK[stage.environment];
    if (rank <= lastRank) {
      return [{
        code: 'invalid_stage_order',
        message: 'Stages must follow dev → staging → prod order',
        httpStatus: 422,
      }];
    }
    lastRank = rank;
  }
  return [];
}
```

### API integration test sketch (D-19)

```typescript
// apps/api/src/__tests__/pipelines.guardrails.test.ts
it('rejects createRun when flagKey does not match pipeline', async () => {
  const pipeline = await createTestPipeline({ flagKey: 'correct-flag' });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/promotion-runs',
    payload: {
      pipelineId: pipeline.id,
      flagKey: 'wrong-flag',
      actor: { actorType: 'user', actorId: 'dev' },
    },
  });
  expect(response.statusCode).toBe(403);
  expect(response.json().error).toBe('forbidden');
});
```

### MSW handler extension (D-20)

```typescript
// apps/web/src/__tests__/mocks/handlers.ts
http.post('/api/ff-promo/v1/pipelines', async ({ request }) => {
  const body = await request.json();
  if (!body.stages?.every((s) => s.gatePolicies?.length >= 2)) {
    return HttpResponse.json({ error: 'unprocessable_entity', message: 'Missing gate policies' }, { status: 422 });
  }
  return HttpResponse.json(mockPipelineResponse, { status: 201 });
}),
```

## Recommended Plan Wave Breakdown

Four plans in four waves — matches Phase 6 cadence.

### Wave 0 — Contracts + GuardrailService

**07-01-PLAN.md — Schema extensions, validation module, unit tests**
- Extend `packages/contracts/src/pipeline.ts` (D-03): `MetricTypeSchema`, `PipelineCreateRequestSchema`, `PipelineUpdateRequestSchema`, `PipelineResponseSchema`, `GuardrailViolationSchema`
- Extend `PipelineListItemSchema` / `PipelineDetailResponseSchema` in `api.ts`
- Implement `apps/api/src/services/guardrail.service.ts` with `validatePipelineConfig` + `validatePromotionRequest`
- Add `forbidden()` + `unprocessableEntity()` to `api-error.ts`
- Unit tests: `apps/api/src/__tests__/guardrail.service.test.ts` (all D-10/D-11 rules)
- Maps to **GRD-01**, **GRD-03** (logic only)

### Wave 1 — API CRUD + Repository + Config Audit

**07-02-PLAN.md — Pipeline service, migration, POST/PATCH routes**
- Prisma: `PipelineConfigAudit` model + migration (D-12)
- `PipelineRepository`: `deactivate`, `listAll`, `resolveNextVersion`
- `PipelineAuditRepository` + `PipelineService.create/deactivate`
- `POST /v1/pipelines`, `PATCH /v1/pipelines/:id`; extend `GET` list/detail with gate policies + `isActive`
- API integration tests: create pipeline with 3 stages + both metrics (D-19 partial)
- Repository tests: deactivate (D-21)
- Maps to **PIPE-01**, **TELE-01**, **TELE-02**, **API-03**

### Wave 2 — Enforcement in Promotion Flow

**07-03-PLAN.md — Wire guardrails into createRun/startRun**
- Call `GuardrailService` from `promotion-run.service.ts` (D-08)
- Integration tests: wrong flagKey → 403; inactive pipeline → 403; valid self-service → 201 + start (D-19)
- Maps to **GRD-02**, **GRD-03**

### Wave 3 — Dashboard UI-04

**07-04-PLAN.md — Pipeline pages + client tests**
- `api-client.ts`: `createPipeline`, `updatePipeline` (deactivate), `listPipelines` (all)
- `/pipelines` list with active badge + stage count (D-13)
- `/pipelines/new` form — 3 fixed stages, gate editors (D-14)
- `/pipelines/[id]` read-only detail + deactivate (D-15)
- Nav link from layout or `/runs` header (discretion)
- MSW tests: form validation + submit (D-20)
- Maps to **UI-04**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Seed-only pipeline config | API + dashboard CRUD | Phase 7 | Platform self-service |
| createRun accepts any flagKey | GuardrailService enforcement | Phase 7 | GRD-03 satisfied |
| GET pipelines without policies | Full nested response | Phase 7 | UI-04 detail |
| Single-metric test pipelines | Both metrics required per stage | Phase 7 | Aligns with TELE-01/02 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Skip `GuardrailPolicy` table in v1 — existing fields sufficient for GRD-01 minimal | Guardrail design | Low — D-02 allows minimal path; JSON column easy add later |
| A2 | New `PipelineConfigAudit` model required for D-12 | Config audit | Medium — if user prefers logging-only, migration can be dropped |
| A3 | PATCH (not PUT) for deactivate/metadata only | API | Low — D-06 allows either; PATCH is smaller scope |
| A4 | Fixed 3-stage form (dev/staging/prod) for dashboard v1 | UI | Low — matches seed pattern and D-11 |
| A5 | `listAll` replaces `listActive` on GET /v1/pipelines | API gaps | Medium — `/runs/new` may show inactive pipelines unless filtered client-side to `isActive` |

## Open Questions (RESOLVED)

1. **Pipeline config audit storage?** — RESOLVED: `PipelineConfigAudit` table with dedicated migration (07-02 Task 1). `AuditEvent` remains promotion-scoped only.

2. **Show inactive pipelines in `/runs/new` picker?** — RESOLVED: `GET /v1/pipelines` uses `listAll` for platform list; `/runs/new` filters `isActive` client-side (07-03 Task 3); API returns 403 if bypassed (07-03 guardrails).

3. **In-place metadata edit vs version bump?** — RESOLVED: PATCH allows `description` + `isActive` only; structural changes require new `POST` with bumped version via `resolveNextVersion` (07-01, 07-02).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API + web | ✓ | v25.9.0 (≥24) | — |
| pnpm | Monorepo | ✓ | 10.33.0 | — |
| PostgreSQL | Pipeline CRUD | ✓ (docker compose) | 16 | testcontainers in CI |
| Phase 6 web app | UI-04 | ✓ | Next.js 16 | — |
| slopcheck | Package audit | ✗ | — | npm view used |

**Missing dependencies with no fallback:** None for local dev.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` (api, web, db projects exist) |
| Quick run command | `pnpm exec vitest run --project api -t guardrail` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | Create 3-env pipeline via API | integration | `vitest run --project api -t "creates pipeline"` | ❌ Wave 1 |
| TELE-01 | error_rate policy persisted per stage | integration | `vitest run --project db -t pipeline` | ✅ partial — update for both metrics |
| TELE-02 | latency_p95 policy persisted per stage | integration | same as TELE-01 | ❌ Wave 1 |
| GRD-03 | Reject wrong flagKey on createRun | integration | `vitest run --project api -t "wrong flagKey"` | ❌ Wave 2 |
| GRD-02 | Valid create + start self-service | integration | `vitest run --project api -t "valid self-service"` | ❌ Wave 2 |
| GRD-01 | Reject pipeline missing gate policies | unit | `vitest run --project api -t guardrail` | ❌ Wave 0 |
| API-03 | POST/PATCH pipelines | integration | `vitest run --project api -t pipelines` | ❌ Wave 1 |
| UI-04 | Pipeline form submit navigates to detail | integration (MSW) | `vitest run --project web -t pipeline` | ❌ Wave 3 |
| D-21 | Repository deactivate | integration | `vitest run --project db -t deactivate` | ❌ Wave 1 |

### Sampling Rate

- **Per task commit:** `pnpm exec vitest run --project api` (or `web` for UI tasks)
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/services/guardrail.service.ts`
- [ ] `apps/api/src/__tests__/guardrail.service.test.ts`
- [ ] `packages/contracts/src/pipeline.ts` — response + request extensions
- [ ] `forbidden` / `unprocessableEntity` in `api-error.ts`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | Optional `API_KEY` — no RBAC until GRD-04 (D-17) |
| V3 Session Management | No | N/A |
| V4 Access Control | Partial | GuardrailService server-side bounds; all callers can configure in v1 |
| V5 Input Validation | Yes | Zod on pipeline create; GuardrailService structural checks |
| V6 Cryptography | No | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client bypasses flagKey check | Elevation | GuardrailService on API createRun/startRun (GRD-03) |
| Inactive pipeline promotion | Elevation | `pipeline_inactive` → 403 |
| Mass assignment on pipeline PATCH | Tampering | Allowlist `isActive`, `description` only in v1 |
| Threshold injection (negative/NaN) | Tampering | Zod `z.number().positive()` on thresholds |
| Unauthorized config change | Elevation | API_KEY when set; RBAC deferred GRD-04 |

## Sources

### Primary (HIGH confidence)

- Codebase: `packages/db/prisma/schema.prisma`, `packages/contracts/src/pipeline.ts`, `packages/db/src/repositories/pipeline.repository.ts`, `apps/api/src/services/promotion-run.service.ts`, `apps/api/src/routes/pipelines.ts`, `apps/web/src/app/runs/new/page.tsx`, `packages/telemetry/src/query/build-promql.ts`, `packages/db/src/seed.ts`
- `.planning/phases/07-guardrails-self-service/07-CONTEXT.md` — locked decisions
- `.planning/phases/06-operator-dashboard/06-RESEARCH.md` — dashboard patterns
- `.planning/ROADMAP.md` — Phase 7 requirements and success criteria

### Secondary (MEDIUM confidence)

- npm registry: `zod@4.4.3` verified 2026-06-22

### Tertiary (LOW confidence)

- Whether `PipelineConfigAudit` vs JSON metadata is preferred by user — flagged in Open Questions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; patterns copied from Phases 5–6
- Architecture: HIGH — clear gaps identified in routes, service, schema
- Pitfalls: HIGH — root causes verified in current `createRun` and list route code

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (30 days)
