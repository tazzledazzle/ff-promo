# Phase 5: REST API - Research

**Researched:** 2026-06-22
**Domain:** Fastify 5 REST control plane over PostgreSQL + Temporal promotion workflows
**Confidence:** HIGH

## Summary

Phase 5 turns the existing worker-only promotion control path into a REST API. The codebase already has durable run state (`PromotionRun`, `GateResult`, `AuditEvent`), Zod contracts for create/update inputs, and a proven `startPromotionRun` helper that starts `promotionWorkflow` with `workflowId === run.id`. Signal handlers (`pause`, `resume`, `abort`) and `statusQuery` are defined in the worker but not yet callable from outside the test suite.

The primary architectural work is extracting **shared Temporal control** from `apps/worker` into a workspace package both the API and worker import, then layering Fastify routes that validate with existing `@ff-promo/contracts` schemas, persist via `@ff-promo/db` repositories, and delegate lifecycle mutations to Temporal. Read paths assemble status from PostgreSQL (source of truth for gate history) and optionally enrich with live `statusQuery` from Temporal when a workflow handle exists.

Gate forensics for roadmap success criterion 3 should be a **structured sub-object on status responses when `status === 'paused'`**, built from the latest failing `GateResult` rows plus stage context (`environment`, `orderIndex`, `displayName`) and run-level `pauseReason`. The data already exists in `GateResult.metadata` (treatment/control values, delta, reason) populated by `evaluateGate` — the API only needs a response mapper, not new telemetry logic.

Auth, pipeline configuration, and guardrail enforcement are explicitly deferred to Phase 7 (API-03, GRD-*). Phase 5 accepts actor metadata in request bodies and records audit events but does not validate API keys or RBAC.

**Primary recommendation:** Extract `@ff-promo/promotion-control` (Temporal client + shared signals), build a `buildApp()` Fastify factory with `@fastify/type-provider-zod` + Swagger, implement resource-oriented `/v1/promotion-runs` routes, and test with `fastify.inject` + testcontainers PostgreSQL + injectable Temporal client mocks.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | Operator can create, start, pause, resume, and abort promotion runs via REST API | Route design table; shared `startPromotionRun` + new signal helpers; state-transition matrix; `PromotionRunRepository` + audit append pattern |
| API-02 | Operator can query promotion run status and gate evaluation history via REST API | `GET /v1/promotion-runs/:id` + `GET /v1/promotion-runs/:id/gates`; `GateResultRepository.findByRunId`; optional Temporal `statusQuery` enrichment |
| Roadmap SC-3 | API responses include structured gate forensics on pause events | `GateForensicsSchema` derived from existing `GateResult` + stage join; surfaced on status when paused |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Fastify 5.8.5, `@fastify/type-provider-zod` 1.0.0, `@fastify/swagger` 9.7.0, Zod 4.4.3, `@temporalio/client` 1.18.1, PostgreSQL 16+ via Prisma, pnpm monorepo [CITED: CLAUDE.md stack table]
- **Integration model:** LaunchDarkly REST adapter and Prometheus gates are worker activities — API must not call LD/Prometheus directly for promotion control [CITED: CLAUDE.md]
- **Failure mode:** Pause-and-alert on gate breach; no auto-rollback in v1 [CITED: CLAUDE.md]
- **Interfaces:** API required in v1; CLI also listed for Phase 5 in README but out of scope for this phase's REST work [CITED: CLAUDE.md]
- **Auth note:** Better Auth deferred initially; API-key-only acceptable behind VPN until enterprise SSO [CITED: CLAUDE.md stack patterns] — Phase 7 owns enforcement
- **Do not use:** Express 4, Next.js API routes as primary backend, `@launchdarkly/node-server-sdk` for orchestration [CITED: CLAUDE.md What NOT to Use]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP routing & validation | API / Backend | — | Fastify owns request/response schemas and error mapping |
| Run CRUD (create pending run) | API / Backend | Database | `PromotionRunRepository.create`; no Temporal until start |
| Workflow start / signals | API / Backend | Temporal service | API is the control-plane entry point; worker executes activities |
| Gate evaluation & LD writes | Worker | — | Already implemented as Temporal activities; API must not duplicate |
| Status & gate history reads | API / Backend | Database | PostgreSQL is durable source; Temporal query is optional live overlay |
| Gate forensics assembly | API / Backend | Database | Map `GateResult` + `Stage` rows into response DTO |
| OpenAPI spec | API / Backend | — | Generated from Zod route schemas via `@fastify/type-provider-zod` |
| Authentication / guardrails | — (Phase 7) | API / Backend | Deferred; Phase 5 uses passthrough actor metadata only |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | 5.8.5 | HTTP server | Project stack; schema-first, low overhead [VERIFIED: npm registry] |
| `@fastify/type-provider-zod` | 1.0.0 | Zod validator/serializer + OpenAPI transform | Official Zod type provider; integrates with Zod 4.x [VERIFIED: npm registry] [CITED: github.com/fastify/fastify-type-provider-zod] |
| `@fastify/swagger` | 9.7.0 | OpenAPI 3 spec generation | Project stack; works with `jsonSchemaTransform` [VERIFIED: npm registry] |
| `@fastify/swagger-ui` | 6.0.0 | Interactive docs at `/documentation` | Standard companion to swagger plugin [VERIFIED: npm registry] |
| `zod` | 4.4.3 | Shared request/response schemas | Already in `@ff-promo/contracts` [VERIFIED: npm registry] |
| `@temporalio/client` | 1.18.1 | Start workflows, send signals, query status | Same version as worker; proven in Phase 4 tests [VERIFIED: npm registry] |
| `@ff-promo/contracts` | workspace | Input/output Zod schemas | Single source of truth across API, worker, dashboard |
| `@ff-promo/db` | workspace | Prisma client + repositories | Existing persistence layer |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testcontainers/postgresql` | 12.0.3 | Ephemeral Postgres in tests | Already used in `packages/db` setup — reuse for API integration tests [VERIFIED: root package.json] |
| `vitest` | 4.1.9 | Test runner | Add `api` vitest project alongside `worker`, `db` |
| `tsx` | ^4.20.3 | Dev watch for API | Match worker dev pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `@ff-promo/promotion-control` package | Duplicate Temporal helpers in `apps/api` | Duplication breaks CLI Phase 5 parity; shared package is correct |
| `@fastify/type-provider-typebox` | Zod provider | Contracts package is Zod-native; switching splits schema sources |
| Supertest / undici against listening server | `fastify.inject()` | Inject is faster, no port binding, official Fastify testing pattern [CITED: fastify.dev/docs/latest/Guides/Testing/] |
| Live Temporal in all API tests | Injectable mock `Client` | Worker already uses `temporalClient` injection; API tests stay fast without requiring worker process |

**Installation (apps/api):**

```bash
pnpm --filter @ff-promo/api add fastify@5.8.5 @fastify/type-provider-zod@1.0.0 @fastify/swagger@9.7.0 @fastify/swagger-ui@6.0.0 @temporalio/client@1.18.1 @ff-promo/contracts@workspace:* @ff-promo/db@workspace:*
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `fastify` | npm | 8+ yrs | ~10M/wk | github.com/fastify/fastify | OK | Approved |
| `@fastify/type-provider-zod` | npm | ~2 mo (pkg); Fastify org | growing | github.com/fastify/fastify-type-provider-zod | OK | Approved — verify Zod 4 encode/decode behavior in spike |
| `@fastify/swagger` | npm | 6+ yrs | ~1M/wk | github.com/fastify/fastify-swagger | OK | Approved |
| `@fastify/swagger-ui` | npm | 4+ yrs | ~500K/wk | github.com/fastify/fastify-swagger-ui | OK | Approved |
| `@temporalio/client` | npm | 4+ yrs | ~200K/wk | github.com/temporalio/sdk-typescript | OK | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**Postinstall scripts:** none on recommended packages [VERIFIED: npm view scripts.postinstall]

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │           Operator / Dashboard          │
                    │         (CLI deferred same routes)      │
                    └────────────────────┬────────────────────┘
                                         │ HTTP
                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         apps/api (Fastify 5)                           │
│  ┌──────────────┐   ┌─────────────────┐   ┌────────────────────────┐ │
│  │ Zod schemas  │──▶│ Route handlers  │──▶│ PromotionControlService  │ │
│  │ (contracts)  │   │ /v1/promotion-  │   │ create/start/signal/     │ │
│  └──────────────┘   │     runs/*      │   │ query/status assembly    │ │
│                     └────────┬────────┘   └───────────┬────────────┘   │
└──────────────────────────────┼────────────────────────┼────────────────┘
                               │                         │
              ┌────────────────┴────────────┐   ┌────────┴────────┐
              │     @ff-promo/db            │   │ @ff-promo/      │
              │  PromotionRunRepository     │   │ promotion-control│
              │  GateResultRepository       │   │ Temporal Client  │
              │  AuditRepository            │   │ shared signals   │
              └──────────────┬──────────────┘   └────────┬────────┘
                             │                           │ gRPC
                             ▼                           ▼
                    ┌────────────────┐        ┌─────────────────┐
                    │  PostgreSQL 16 │        │ Temporal Server │
                    └────────────────┘        └────────┬────────┘
                                                         │ task queue
                                                         ▼
                                                ┌─────────────────┐
                                                │  apps/worker    │
                                                │ promotionWorkflow│
                                                │ + LD/telemetry  │
                                                │   activities    │
                                                └─────────────────┘
```

### Recommended Project Structure

```
packages/
  promotion-control/          # NEW — shared Temporal control (extract from worker)
    src/
      signals.ts              # pauseSignal, resumeSignal, abortSignal, statusQuery
      temporal-client.ts      # connect helper, singleton factory
      start-promotion-run.ts  # moved from apps/worker
      signal-promotion-run.ts # pause/resume/abort wrappers
      index.ts
  contracts/
    src/
      api.ts                  # NEW — API request/response Zod schemas + OpenAPI ids

apps/
  api/
    src/
      app.ts                  # buildApp(opts) factory — no listen()
      server.ts               # listen entrypoint for dev/prod
      plugins/
        db.ts                 # decorate fastify with prisma + repos
        temporal.ts           # decorate with promotion-control client
        swagger.ts            # register swagger + UI
      routes/
        promotion-runs/
          index.ts            # route registration
          create.ts
          start.ts
          pause.ts
          resume.ts
          abort.ts
          get-status.ts
          list-gates.ts
      services/
        promotion-run.service.ts   # orchestrates repo + temporal + audit
        gate-forensics.mapper.ts   # SC-3 response builder
      errors/
        problem-details.ts         # 404/409/503 mapping
    src/__tests__/
      helpers/
        build-test-app.ts
        mock-temporal-client.ts
      promotion-runs.integration.test.ts
```

### Pattern 1: Fastify App Factory + Zod Type Provider

**What:** Separate `buildApp()` from `server.ts` so tests call `app.inject()` without binding a port.
**When to use:** All route tests and OpenAPI generation.
**Example:**

```typescript
// Source: https://github.com/fastify/fastify-type-provider-zod/blob/main/README.md
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';

export function buildApp() {
  const app = Fastify({ logger: false })
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler);

  return app.withTypeProvider<ZodTypeProvider>();
}
```

[CITED: github.com/fastify/fastify-type-provider-zod]

### Pattern 2: Route Schema from Shared Contracts

**What:** Define API DTOs in `packages/contracts/src/api.ts`; routes reference the same schemas the CLI/dashboard will consume later.
**When to use:** Every route body, params, and response.
**Example:**

```typescript
// apps/api/src/routes/promotion-runs/create.ts
import { PromotionRunCreateInputSchema, PromotionRunResponseSchema } from '@ff-promo/contracts';

app.post('/v1/promotion-runs', {
  schema: {
    body: PromotionRunCreateInputSchema,
    response: { 201: PromotionRunResponseSchema },
  },
  handler: async (req, reply) => {
    const run = await promotionRunService.create(req.body);
    return reply.code(201).send(run);
  },
});
```

Existing `PromotionRunCreateInputSchema` already includes `pipelineId`, `flagKey`, `actor` [VERIFIED: packages/contracts/src/promotion-run.ts].

### Pattern 3: Extract Shared Temporal Control

**What:** Move `startPromotionRun` and signal definitions out of `apps/worker` into `packages/promotion-control` so API, worker scripts, and future CLI share one implementation.
**When to use:** Any code that starts or signals `promotionWorkflow`.
**Example:**

```typescript
// packages/promotion-control/src/signal-promotion-run.ts
// Source: pattern from apps/worker/src/__tests__/promotion.signals.test.ts [VERIFIED: codebase]
import type { Client } from '@temporalio/client';
import { pauseSignal, resumeSignal, abortSignal } from './signals.js';

export async function signalPromotionRun(
  client: Client,
  workflowId: string,
  signal: 'pause' | 'resume' | 'abort',
) {
  const handle = client.workflow.getHandle(workflowId);
  const signalDef =
    signal === 'pause' ? pauseSignal :
    signal === 'resume' ? resumeSignal : abortSignal;
  await handle.signal(signalDef);
}
```

[CITED: docs.temporal.io/develop/typescript/temporal-client — `client.workflow.getHandle(workflowId)`]

**Critical:** Signal definitions (`defineSignal`, `defineQuery`) must live in the shared package, imported by both `promotion.workflow.ts` and the API client. Do not import from `apps/worker/src/workflows/` in the API — that couples API to worker bundle paths.

### Pattern 4: Injectable Temporal Client for Tests

**What:** Accept optional `Client` in service constructor / `buildApp({ temporalClient })`, mirroring `StartPromotionRunInput.temporalClient` [VERIFIED: apps/worker/src/lib/start-promotion-run.ts].
**When to use:** All API integration tests; optional in dev when Temporal is down.

### Pattern 5: OpenAPI via jsonSchemaTransform

**What:** Register `@fastify/swagger` with `transform: jsonSchemaTransform` from `@fastify/type-provider-zod`.
**When to use:** Phase 5 deliverable for dashboard/CLI code generation in Phase 6+.
**Example:**

```typescript
// Source: https://github.com/fastify/fastify-type-provider-zod/blob/main/README.md
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { jsonSchemaTransform } from '@fastify/type-provider-zod';

app.register(fastifySwagger, {
  openapi: {
    info: { title: 'ff-promo API', version: '1.0.0' },
  },
  transform: jsonSchemaTransform,
});
app.register(fastifySwaggerUI, { routePrefix: '/documentation' });
```

Register routes inside `app.after()` or before `app.ready()` per plugin docs [CITED: github.com/fastify/fastify-type-provider-zod].

### REST Route Design

| Method | Path | Action | Preconditions | Side effects |
|--------|------|--------|---------------|--------------|
| `POST` | `/v1/promotion-runs` | Create pending run | Pipeline exists | DB insert; audit `run_created` (new action) or reuse pattern |
| `POST` | `/v1/promotion-runs/:id/start` | Start workflow | `status === pending` | `startPromotionRun`; DB → active; Temporal start |
| `POST` | `/v1/promotion-runs/:id/pause` | Pause | `status === active`, workflow exists | Signal `pause`; DB → paused via workflow handler |
| `POST` | `/v1/promotion-runs/:id/resume` | Resume | `status === paused` | Signal `resume` |
| `POST` | `/v1/promotion-runs/:id/abort` | Emergency stop (SAFE-02) | `status ∈ {active, paused}` | Signal `abort` |
| `GET` | `/v1/promotion-runs/:id` | Status + forensics | Run exists | Read DB; optional Temporal `statusQuery` overlay |
| `GET` | `/v1/promotion-runs/:id/gates` | Gate history | Run exists | `GateResultRepository.findByRunId` |

Use **POST for actions** (start/pause/resume/abort) rather than PATCH on status — matches operator intent, avoids accidental state mutation, aligns with SAFE-02 "emergency stop" semantics.

**Actor handling (auth deferred):** Accept `actor` in create/start/action request bodies using existing `ActorSchema`. Until Phase 7, default to `{ actorType: 'api_key', actorId: 'anonymous' }` when omitted. Record audit events with the provided actor before signaling.

### Gate Forensics Response Shape (Roadmap SC-3)

When `status === 'paused'`, include `gateForensics` on `GET /v1/promotion-runs/:id`:

```typescript
// packages/contracts/src/api.ts (recommended)
export const GateForensicsSchema = z.object({
  pauseReason: z.string().nullable(),           // PromotionRun.pauseReason
  stageIndex: z.number().int(),
  stageId: z.string(),
  environment: z.string(),
  displayName: z.string(),
  evaluatedAt: z.string().datetime().optional(),
  gates: z.array(z.object({
    gateResultId: z.string(),
    metricType: z.string(),
    verdict: GateVerdictSchema,
    observedValue: z.number().nullable(),
    threshold: z.number(),
    treatmentValue: z.number().optional(),
    controlValue: z.number().optional(),
    observedDelta: z.number().optional(),
    reason: z.string().optional(),              // from metadata.reason
    metadata: z.record(z.string(), z.unknown()),
  })),
});

export const PromotionRunStatusResponseSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  flagKey: z.string(),
  status: PromotionStatusSchema,
  currentStageIndex: z.number().int(),
  temporalWorkflowId: z.string().nullable(),
  pauseReason: z.string().nullable(),
  temporal: z.object({                          // optional live overlay
    status: z.string(),
    isPaused: z.boolean(),
    currentStageIndex: z.number().int(),
  }).optional(),
  gateForensics: GateForensicsSchema.nullable(), // populated when paused
});
```

**Assembly logic:**
1. Load run with pipeline stages (new repo method or Prisma `include`).
2. If `status !== 'paused'`, set `gateForensics: null`.
3. If paused, fetch latest gate results for current stage via `findByRunAndStage(runId, stageId)`.
4. Prefer `verdict === 'fail'` rows; if multiple metrics failed in same evaluation window, return all fail rows from the latest `evaluatedAt` timestamp cluster.
5. Map `metadata.treatmentValue`, `metadata.controlValue`, `metadata.observedDelta`, `metadata.reason` from `evaluateGate` activity [VERIFIED: apps/worker/src/activities/evaluate-gate.ts].

Manual pause (operator signal) may have `gateForensics: null` with `pauseReason: null` — distinguish `pauseReason` starting with gate failure text vs operator pause via audit (`run_paused` actor ≠ workflow).

### Anti-Patterns to Avoid

- **Importing worker activities in API:** Activities require LD/Prometheus env; keep them worker-only.
- **Mutating run status in API without Temporal signal:** For pause/resume/abort, signal first (or use idempotent DB guard); workflow handlers persist canonical state.
- **Global Fastify type provider without re-scoping in plugins:** Re-call `withTypeProvider<ZodTypeProvider>()` inside each route plugin [CITED: fastify.dev/docs/latest/Reference/Type-Providers/].
- **Starting workflow before DB run is pending:** Reuse existing guard in `startPromotionRun` [VERIFIED: apps/worker/src/lib/start-promotion-run.ts].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Custom JSON parsers | `@fastify/type-provider-zod` + contracts | Automatic 400 responses, typed handlers |
| OpenAPI generation | Manual YAML | `@fastify/swagger` + `jsonSchemaTransform` | Stays in sync with Zod schemas |
| HTTP testing | Spin up real ports | `fastify.inject()` | Official pattern; faster CI [CITED: fastify.dev] |
| Temporal connection | Raw gRPC | `@temporalio/client` Connection.connect | Handles retries, namespaces, TLS |
| Gate history queries | Raw SQL | `GateResultRepository` | Existing ordering and validation |
| Problem+json errors | Ad-hoc `{ error: string }` | Fastify error handler + consistent `{ statusCode, error, message, details }` | Dashboard/CLI need predictable shapes |

**Key insight:** The API is a thin control plane over existing persistence and Temporal signals — most complexity lives in Phase 4 worker code already.

## Common Pitfalls

### Pitfall 1: Signal Definition Drift Between API and Worker

**What goes wrong:** API sends signal name string `'pause'` that doesn't match workflow handler registration.
**Why it happens:** Signal defs duplicated or imported from wrong module path.
**How to avoid:** Single `packages/promotion-control/src/signals.ts` imported by both sides.
**Warning signs:** Signals succeed in tests but silently no-op in integration.

### Pitfall 2: Zod 4 Response Serialization Surprises

**What goes wrong:** Response schema strips fields or fails serialization after upgrade.
**Why it happens:** `@fastify/type-provider-zod` v0+ uses Zod `.encode()`/`.decode()` — response types are `z.output` not `z.input` [CITED: fastify-type-provider-zod README].
**How to avoid:** Use `z.coerce.date()` or ISO string dates in response schemas; test with `fastify.inject` asserting full JSON body.
**Warning signs:** 500 "Response doesn't match the schema" in dev.

### Pitfall 3: Missing Workflow Handle on Pause/Resume

**What goes wrong:** 409/503 when signaling a run whose `temporalWorkflowId` is null (created but never started).
**Why it happens:** API doesn't validate lifecycle preconditions.
**How to avoid:** Check `temporalWorkflowId` and `status` before signal; return `409 Conflict` with `{ code: 'INVALID_STATE' }`.
**Warning signs:** Temporal `WorkflowNotFoundError`.

### Pitfall 4: Gate Forensics Shows Stale Stage After Resume-Fail Cycle

**What goes wrong:** Forensics from previous stage shown after advancement then re-pause.
**Why it happens:** Using run-level latest gate results without stage filter.
**How to avoid:** Filter by `currentStageIndex` → `stageId` mapping from pipeline stages.
**Warning signs:** SC-3 verification fails — wrong environment in forensics block.

### Pitfall 5: Per-Request Prisma Connect Storm

**What goes wrong:** `startPromotionRun` opens/closes DB each call; API under load exhausts connections.
**Why it happens:** Copied worker helper verbatim without app-scoped client.
**How to avoid:** Fastify plugin decorates singleton `PrismaClient`; refactor shared lib to accept injected `db`.
**Warning signs:** Integration tests pass but dev server hits connection limit.

## Code Examples

### fastify.inject Integration Test

```typescript
// Source: https://fastify.dev/docs/latest/Guides/Testing/
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { startTestDatabase, stopTestDatabase } from '@ff-promo/db/test-setup';

describe('POST /v1/promotion-runs', () => {
  beforeAll(() => startTestDatabase(), 120_000);
  afterAll(() => stopTestDatabase());

  it('creates a pending run', async () => {
    const app = buildApp({ temporalClient: mockTemporalClient });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/promotion-runs',
      payload: { pipelineId: '...', flagKey: 'my-flag', actor: { actorType: 'user', actorId: 'op-1' } },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });
});
```

### Temporal Status Query Overlay

```typescript
// Source: apps/worker/src/__tests__/promotion.signals.test.ts [VERIFIED: codebase]
const handle = temporalClient.workflow.getHandle(run.temporalWorkflowId!);
const live = await handle.query(statusQuery);
// Merge live.isPaused with DB status for response.temporal field
```

### State Transition Guard

```typescript
const ALLOWED: Record<string, PromotionStatus[]> = {
  start: ['pending'],
  pause: ['active'],
  resume: ['paused'],
  abort: ['active', 'paused'],
};

function assertTransition(action: string, current: PromotionStatus) {
  if (!ALLOWED[action]?.includes(current)) {
    throw new ConflictError(`Cannot ${action} run in status ${current}`);
  }
}
```

## Recommended Plan Wave Breakdown

Four plans in three waves — matches Phase 4 granularity and dependency order.

### Wave 0 — Scaffold & Shared Control

**05-01-PLAN.md — API scaffold + OpenAPI + vitest project**
- Add Fastify dependencies to `apps/api`
- Implement `buildApp()`, swagger plugin, health route
- Add `api` vitest project to root `vitest.config.ts`
- Smoke test: `inject GET /health` → 200
- Add `packages/contracts/src/api.ts` response schemas (stubs OK)

**05-02-PLAN.md — Extract `@ff-promo/promotion-control`**
- Create `packages/promotion-control` with signals, `startPromotionRun` (moved), `signalPromotionRun`, `queryPromotionStatus`
- Refactor worker imports; verify existing worker tests still pass
- Accept injected `PrismaClient` / `Client` for testability

### Wave 1 — Write Routes (API-01)

**05-03-PLAN.md — Promotion run control endpoints**
- `POST /v1/promotion-runs` (create)
- `POST /v1/promotion-runs/:id/start|pause|resume|abort`
- Fastify plugins: db, temporal
- Audit append on API-initiated actions
- Unit/integration tests with mock Temporal + testcontainers DB
- Maps to **API-01**, **SAFE-02** (abort)

### Wave 2 — Read Routes + Forensics (API-02, SC-3)

**05-04-PLAN.md — Status, gate history, forensics, E2E tests**
- `GET /v1/promotion-runs/:id` with `gateForensics` when paused
- `GET /v1/promotion-runs/:id/gates`
- `gate-forensics.mapper.ts` + contract schemas finalized
- Integration test: seed run → mock gate fail pause → GET status asserts forensics shape
- OpenAPI snapshot or `/documentation/json` smoke test
- Maps to **API-02**, roadmap **SC-3**

**Optional stretch (same plan or Phase 6 prep):** Export OpenAPI JSON artifact for dashboard client generation — not blocking.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual JSON Schema in Fastify routes | Zod type provider with shared contracts | `@fastify/type-provider-zod` 1.0.0 (2026) | Single schema source; OpenAPI auto-generated |
| Worker script `start-run` only | REST control plane | Phase 5 | Operators/dashboard get HTTP surface |
| Express default for Node APIs | Fastify 5 for new services | Project stack 2025–2026 | Use Fastify patterns from day one |

**Deprecated/outdated:**
- Defining API schemas separately from `@ff-promo/contracts` — duplicates Phase 6/7 consumers

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | New package named `@ff-promo/promotion-control` | Project Structure | Low — name adjustable; extraction pattern still required |
| A2 | Action routes use POST sub-resources (`/:id/pause`) | REST Route Design | Medium — PATCH purists may prefer different shape; discuss-phase can lock |
| A3 | Phase 5 adds `run_created` audit action | REST Route Design | Low — may reuse existing actions only; verify audit enum |
| A4 | Full E2E API tests mock Temporal, not TestWorkflowEnvironment | Integration Tests | Medium — optional second test tier with real Temporal for confidence |

## Open Questions

1. **Should `POST /v1/promotion-runs` combine create+start in one call?**
   - What we know: Worker helper separates create (repo) from start; roadmap lists both capabilities.
   - What's unclear: Whether operators want atomic "create and start" for CLI ergonomics.
   - Recommendation: Keep separate endpoints (explicit state machine); add `?start=true` query param only if discuss-phase requests it.

2. **List endpoint (`GET /v1/promotion-runs`)?**
   - What we know: API-02 mentions status query, not list; UI-01 in Phase 6 needs list.
   - Recommendation: Defer list to Phase 6 unless dashboard planning blocks — add filter by `status` then.

3. **Audit action for API create?**
   - What we know: `AuditActionSchema` has no `run_created` [VERIFIED: packages/contracts/src/audit.ts].
   - Recommendation: Add `run_created` to enum + migration in Wave 1, or append create audit only on `start` — planner should pick one and stay consistent with SAFE-01.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API runtime | ✓ | v25.9.0 (engine requires ≥24) | — |
| pnpm | Monorepo install | ✓ | 10.33.0 | — |
| Docker | testcontainers PostgreSQL | ✓ | 27.0.3 | `SKIP_TESTCONTAINERS=1` + `DATABASE_URL` [VERIFIED: packages/db setup] |
| PostgreSQL (via testcontainers) | Integration tests | ✓ (when Docker running) | 16-alpine image | External DATABASE_URL |
| Temporal Server | Start/signal integration | ✗ (not probed running) | — | Mock `Client` in API tests; manual dev via `docker compose` stack |
| ctx7 CLI | Doc lookup | ✗ | — | Used WebFetch for official docs instead |

**Missing dependencies with no fallback:**
- None for Phase 5 CI if Temporal is mocked in API tests (matches worker unit test strategy).

**Missing dependencies with fallback:**
- Live Temporal — mock client injection; full stack verification remains in worker E2E tests.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` (add `api` project — Wave 0 gap) |
| Quick run command | `pnpm exec vitest run --project api` |
| Full suite command | `pnpm test` (turbo all packages) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | Create pending run | integration | `vitest run --project api -t "creates a pending run"` | ❌ Wave 0 |
| API-01 | Start run | integration | `vitest run --project api -t "starts pending run"` | ❌ Wave 1 |
| API-01 | Pause/resume | integration | `vitest run --project api -t "pause and resume"` | ❌ Wave 1 |
| API-01 / SAFE-02 | Abort | integration | `vitest run --project api -t "abort"` | ❌ Wave 1 |
| API-02 | GET status | integration | `vitest run --project api -t "returns run status"` | ❌ Wave 2 |
| API-02 | Gate history | integration | `vitest run --project api -t "gate history"` | ❌ Wave 2 |
| SC-3 | Gate forensics on pause | integration | `vitest run --project api -t "gate forensics"` | ❌ Wave 2 |

### Sampling Rate

- **Per task commit:** `pnpm exec vitest run --project api`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — add `api` project root `./apps/api`
- [ ] `apps/api/src/app.ts` — `buildApp()` factory
- [ ] `apps/api/src/__tests__/helpers/build-test-app.ts` — inject mocks
- [ ] `apps/api/package.json` — real test script (currently no-op exit 0) [VERIFIED: apps/api/package.json]
- [ ] `packages/promotion-control/` — shared Temporal package
- [ ] `packages/contracts/src/api.ts` — response schemas

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Deferred (Phase 7) | Document `auth: none` in OpenAPI; no bypass in Phase 5 |
| V3 Session Management | No | N/A until Phase 7 |
| V4 Access Control | Deferred (Phase 7) | Actor metadata accepted but not enforced |
| V5 Input Validation | Yes | Zod via `@fastify/type-provider-zod` on all routes |
| V6 Cryptography | No | No secrets in Phase 5 API surface |

### Known Threat Patterns for Fastify + Temporal Control Plane

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated promotion control | Spoofing/Tampering | Phase 7 API keys/RBAC; network-level VPN per stack guidance |
| Invalid state transition abuse | Tampering | Server-side precondition checks + 409 responses |
| SQL injection via run IDs | Tampering | Prisma parameterized queries via repositories |
| Oversized JSON bodies | DoS | Fastify `bodyLimit` (default 1MB — sufficient) |
| Error leakage (Temporal internals) | Info Disclosure | Map Temporal errors to generic 503 in production error handler |

## Sources

### Primary (HIGH confidence)

- [github.com/fastify/fastify-type-provider-zod](https://github.com/fastify/fastify-type-provider-zod) — Zod validator/serializer, Swagger transform, plugin patterns
- [fastify.dev/docs/latest/Guides/Testing/](https://fastify.dev/docs/latest/Guides/Testing/) — `buildApp` + `inject()` testing
- [fastify.dev/docs/latest/Reference/Type-Providers/](https://fastify.dev/docs/latest/Reference/Type-Providers/) — scoped type provider in plugins
- [docs.temporal.io/develop/typescript/temporal-client](https://docs.temporal.io/develop/typescript/temporal-client) — Client connect, workflow start, getHandle
- Codebase: `apps/worker/src/lib/start-promotion-run.ts`, `workflows/signals.ts`, `activities/evaluate-gate.ts`, `packages/db/src/repositories/*`

### Secondary (MEDIUM confidence)

- npm registry version verification for fastify 5.8.5, @fastify/type-provider-zod 1.0.0 (2026-04-19)
- slopcheck OK verdicts for all recommended packages

### Tertiary (LOW confidence)

- Exact audit action for create endpoint — enum gap needs planner decision

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pinned in CLAUDE.md, verified on npm, official Fastify docs fetched
- Architecture: HIGH — maps directly to existing worker/DB code with clear extraction point
- Pitfalls: MEDIUM-HIGH — Temporal signal sharing and Zod 4 serialization verified in docs; audit enum gap remains

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (30 days — stable stack)
