# Phase 5: REST API - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 28 new/modified files (Phase 5 scope)
**Analogs found:** 22 / 28
**Upstream context:** No `CONTEXT.md` or `RESEARCH.md` in phase dir yet — scope inferred from `.planning/ROADMAP.md` (API-01, API-02), `.planning/REQUIREMENTS.md`, Phase 4 worker deliverables, and `apps/api` shell.

## Recommended `apps/api` Layout

Phase 5 turns the API shell into a Fastify control plane that **delegates orchestration to existing worker/Temporal primitives** — do not reimplement promotion logic in route handlers. Repositories stay in `@ff-promo/db`; request/response shapes live in `@ff-promo/contracts`; Temporal signals reuse `apps/worker/src/workflows/signals.ts`.

```
apps/api/src/
  index.ts                          # MODIFY: load env, build server, listen, graceful shutdown
  app.ts                            # NEW: buildApp() — register plugins + routes (testable)
  plugins/
    auth.ts                         # NEW: API-key preHandler (v1: env API_KEY, actorType api_key)
    swagger.ts                      # NEW: @fastify/swagger + swagger-ui from Zod schemas
  lib/
    env.ts                          # NEW: parse PORT, DATABASE_URL, TEMPORAL_*, API_KEY via Zod
    db.ts                           # NEW: createPrismaClient singleton / request-scoped factory
    temporal-client.ts              # NEW: Connection.connect + Client factory (mirror worker)
  routes/
    health.ts                       # NEW: GET /health (db ping optional)
    pipelines.ts                    # NEW: GET /pipelines, GET /pipelines/:id (read-only v1)
    promotion-runs.ts               # NEW: CRUD + start/pause/resume/abort + status/history
  services/
    promotion-run.service.ts        # NEW: orchestration — repos + startPromotionRun + signals
  errors/
    api-error.ts                    # NEW: HttpError + map domain errors → status codes
  __tests__/
    helpers/
      test-server.ts                # NEW: injectable deps (db, temporalClient) for route tests
    promotion-runs.routes.test.ts   # NEW: supertest-style via app.inject()
    pipelines.routes.test.ts        # NEW: read-only pipeline routes
vitest.config.ts                    # MODIFY: add `api` vitest project
apps/api/package.json               # MODIFY: fastify, zod type-provider, workspace deps
```

**Endpoint sketch (API-01 / API-02):**

| Method | Path | Service action | Primary analog |
|--------|------|----------------|----------------|
| `POST` | `/promotion-runs` | `PromotionRunRepository.create` + audit | `packages/db/src/repositories/promotion-run.repository.ts` |
| `POST` | `/promotion-runs/:id/start` | `startPromotionRun` | `apps/worker/src/lib/start-promotion-run.ts` |
| `POST` | `/promotion-runs/:id/pause` | `handle.signal(pauseSignal)` | `apps/worker/src/__tests__/promotion.signals.test.ts` |
| `POST` | `/promotion-runs/:id/resume` | `handle.signal(resumeSignal)` | same |
| `POST` | `/promotion-runs/:id/abort` | `handle.signal(abortSignal)` | same |
| `GET` | `/promotion-runs/:id` | DB run + `handle.query(statusQuery)` | `start-promotion-run.ts` load + signals test query |
| `GET` | `/promotion-runs/:id/gate-results` | `GateResultRepository.findByRunId` | `packages/db/src/repositories/gate-result.repository.ts` |
| `GET` | `/promotion-runs/:id/audit-events` | `AuditRepository.findByRunId` | `packages/db/src/repositories/audit.repository.ts` |
| `GET` | `/pipelines` | `PipelineRepository.findByFlagKey` or list | `packages/db/src/repositories/pipeline.repository.ts` |
| `GET` | `/pipelines/:id` | `PipelineRepository.findById` | same |

**New API dependencies** (from CLAUDE.md / STACK.md):

```json
{
  "dependencies": {
    "@ff-promo/contracts": "workspace:*",
    "@ff-promo/db": "workspace:*",
    "@temporalio/client": "1.18.1",
    "fastify": "5.8.5",
    "@fastify/swagger": "9.7.0",
    "@fastify/swagger-ui": "latest",
    "@fastify/type-provider-zod": "1.0.0",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@temporalio/testing": "1.18.1"
  }
}
```

**Cross-package wiring decision (planner discretion):**

- **Preferred:** Move or re-export `startPromotionRun` from a shared location (`apps/worker/src/lib/start-promotion-run.ts` exported via worker package `"exports"` field, or extracted to `packages/promotion-engine` later). API imports the function — do not duplicate Temporal start logic in routes.
- **Signals:** API imports named exports from `apps/worker/src/workflows/signals.ts` (`pauseSignal`, `resumeSignal`, `abortSignal`, `statusQuery`). Workflow ID = `promotionRun.temporalWorkflowId ?? promotionRun.id` (set in Phase 4).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/index.ts` | config | request-response | `apps/worker/src/worker.ts` | role-match |
| `apps/api/src/app.ts` | config | request-response | — (greenfield Fastify) | no analog |
| `apps/api/src/plugins/auth.ts` | middleware | request-response | — (greenfield) | no analog |
| `apps/api/src/plugins/swagger.ts` | middleware | request-response | — (greenfield) | no analog |
| `apps/api/src/lib/env.ts` | utility | transform | `apps/worker/src/lib/clients.ts` | partial |
| `apps/api/src/lib/db.ts` | utility | CRUD | `packages/db/src/client.ts` | exact |
| `apps/api/src/lib/temporal-client.ts` | utility | request-response | `apps/worker/src/lib/start-promotion-run.ts` | exact |
| `apps/api/src/routes/health.ts` | route | request-response | — (greenfield) | no analog |
| `apps/api/src/routes/pipelines.ts` | route | CRUD | `packages/db/src/repositories/pipeline.repository.ts` | role-match |
| `apps/api/src/routes/promotion-runs.ts` | route | request-response | `apps/worker/src/scripts/start-run.ts` | partial |
| `apps/api/src/services/promotion-run.service.ts` | service | request-response | `apps/worker/src/lib/start-promotion-run.ts` + signal tests | role-match |
| `apps/api/src/errors/api-error.ts` | utility | transform | `packages/ld-adapter/src/errors/ld-adapter-error.ts` | partial |
| `apps/api/package.json` | config | — | `apps/worker/package.json` | partial |
| `apps/api/src/__tests__/helpers/test-server.ts` | test | request-response | `apps/worker/src/__tests__/helpers/mock-activities.ts` | partial |
| `apps/api/src/__tests__/promotion-runs.routes.test.ts` | test | request-response | `apps/worker/src/__tests__/start-promotion-run.test.ts` | role-match |
| `apps/api/src/__tests__/pipelines.routes.test.ts` | test | CRUD | `packages/db/src/__tests__/pipeline.integration.test.ts` | role-match |
| `vitest.config.ts` | config | batch | self (worker/db projects) | exact (extend) |
| `packages/contracts/src/api.ts` | model | transform | `packages/contracts/src/promotion-run.ts` | exact |
| `packages/contracts/src/index.ts` | utility | transform | self | exact |
| `packages/db/src/repositories/promotion-run.repository.ts` | service | CRUD | self | exact (extend) |
| `packages/db/src/repositories/index.ts` | utility | CRUD | self | exact |
| `apps/worker/src/lib/start-promotion-run.ts` | service | event-driven | self | exact (reuse/export) |
| `apps/worker/src/workflows/signals.ts` | utility | event-driven | self | exact |
| `apps/worker/package.json` | config | — | self | exact (optional exports) |
| `README.md` | config | — | Phase 4 README section | partial |
| `.env.example` | config | — | self | exact (extend) |

---

## Pattern Assignments

### `apps/api/src/lib/db.ts` (utility, CRUD)

**Analog:** `packages/db/src/client.ts` + `apps/worker/src/activities/persist-run-state.ts`

**Client factory** (`packages/db/src/client.ts` lines 1-7):

```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/index.js';

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
```

**Activity disconnect pattern** — apply in service layer, not routes (`persist-run-state.ts` lines 27-33):

```typescript
const db = createPrismaClient(databaseUrl);
try {
  const repo = new PromotionRunRepository(db);
  return await repo.updateState(input);
} finally {
  await db.$disconnect();
}
```

**Repository bundle** (`packages/db/src/repositories/index.ts` lines 12-19):

```typescript
export function createRepositories(db: PrismaClient) {
  return {
    pipeline: new PipelineRepository(db),
    promotionRun: new PromotionRunRepository(db),
    gateResult: new GateResultRepository(db),
    audit: new AuditRepository(db),
  };
}
```

---

### `apps/api/src/lib/temporal-client.ts` (utility, request-response)

**Analog:** `apps/worker/src/lib/start-promotion-run.ts`

**Connection + client factory** (lines 57-64, 78-80):

```typescript
const address =
  input.temporalAddress ??
  process.env.TEMPORAL_ADDRESS ??
  'localhost:7233';
ownedConnection = await Connection.connect({ address });
client = new TemporalClient({ connection: ownedConnection });
// ...
await ownedConnection?.close();
```

**Workflow handle by run id** — workflowId equals promotion run id in Phase 4:

```typescript
await client.workflow.start(promotionWorkflow, {
  workflowId: run.id,
  taskQueue,
  args: [{ promotionRunId: run.id, stageCount: run.pipeline.stages.length, actor }],
});
```

API control routes use `client.workflow.getHandle(workflowId)` then `.signal()` / `.query()`.

---

### `apps/api/src/services/promotion-run.service.ts` (service, request-response)

**Analog:** `apps/worker/src/lib/start-promotion-run.ts` + `apps/worker/src/__tests__/promotion.signals.test.ts`

**Start run — reuse Phase 4 helper** (`start-promotion-run.ts` lines 19-82):

```typescript
export async function startPromotionRun(input: StartPromotionRunInput) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for startPromotionRun');
  }

  const db = createPrismaClient(databaseUrl);
  try {
    const run = await db.promotionRun.findUniqueOrThrow({
      where: { id: input.promotionRunId },
      include: {
        pipeline: {
          include: { stages: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });

    if (run.status !== 'pending') {
      throw new Error(
        `Promotion run ${input.promotionRunId} must be pending (current: ${run.status})`,
      );
    }

    const repo = new PromotionRunRepository(db);
    await repo.updateState({
      promotionRunId: run.id,
      status: 'active',
      temporalWorkflowId: run.id,
    });

    // ... connect client, workflow.start, return { workflowId, runId }
  } finally {
    await db.$disconnect();
  }
}
```

**Signal delivery — copy from signal tests** (`promotion.signals.test.ts` lines 105-110, 151-152):

```typescript
import {
  abortSignal,
  pauseSignal,
  resumeSignal,
  statusQuery,
} from '../workflows/signals.js';

const handle = client.workflow.getHandle(run.id);
await handle.signal(pauseSignal);
const pausedStatus = await handle.query(statusQuery);
// pausedStatus: { status, currentStageIndex, isPaused }

await handle.signal(resumeSignal);
await handle.signal(abortSignal);
```

**Create run + audit** — compose repository calls (`promotion-run.repository.ts` lines 13-26, `audit.repository.ts` lines 10-24):

```typescript
const run = await promotionRunRepo.create({ pipelineId, flagKey });
await auditRepo.append({
  promotionRunId: run.id,
  action: 'run_started', // or separate create action if added to contracts
  actorType: actor.actorType,
  actorId: actor.actorId,
  displayName: actor.displayName,
});
```

Pass `actor: { actorType: 'api_key', actorId: keyId }` from auth plugin.

---

### `apps/worker/src/workflows/signals.ts` (utility, event-driven)

**Analog:** self (exact — import into API, do not duplicate)

**Signal/query definitions** (lines 1-17):

```typescript
import * as wf from '@temporalio/workflow';

export const pauseSignal = wf.defineSignal('pause');
export const resumeSignal = wf.defineSignal('resume');
export const abortSignal = wf.defineSignal('abort');
export const gatePassedSignal = wf.defineSignal<
  [{ stageIndex: number }]
>('gatePassed');
export const gateFailedSignal = wf.defineSignal<
  [{ stageIndex: number; reason: string }]
>('gateFailed');

export const statusQuery = wf.defineQuery<{
  status: string;
  currentStageIndex: number;
  isPaused: boolean;
}>('status');
```

API v1 uses `pauseSignal`, `resumeSignal`, `abortSignal`, `statusQuery` only. Gate signals remain worker-internal.

---

### `apps/api/src/routes/promotion-runs.ts` (route, request-response)

**Analog:** `apps/worker/src/scripts/start-run.ts` (thin entry) + repository integration tests (assertions)

**Thin route pattern** — delegate to service; parse actor from request context:

```typescript
// Conceptual shape — Fastify + Zod type provider (no existing codebase analog)
app.post('/promotion-runs/:id/start', {
  schema: { params: PromotionRunIdParamsSchema, response: { 200: StartRunResponseSchema } },
  preHandler: [authenticateApiKey],
}, async (request, reply) => {
  const result = await promotionRunService.start(request.params.id, request.actor);
  return reply.status(200).send(result);
});
```

**CLI entry analog** (`start-run.ts` lines 10-20):

```typescript
startPromotionRun({
  promotionRunId,
  actor: { actorType: 'user', actorId: process.env.USER ?? 'cli' },
})
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

Routes map `.catch` semantics to `HttpError` / Fastify error handler instead of `process.exit`.

---

### `apps/api/src/routes/pipelines.ts` (route, CRUD)

**Analog:** `packages/db/src/repositories/pipeline.repository.ts`

**Read patterns** (lines 42-63):

```typescript
async findById(id: string) {
  return this.db.pipeline.findUnique({
    where: { id },
    include: {
      stages: {
        orderBy: { orderIndex: 'asc' },
        include: { gatePolicies: true },
      },
    },
  });
}

async findByFlagKey(flagKey: string) {
  return this.db.pipeline.findMany({
    where: { flagKey, isActive: true },
    include: {
      stages: {
        orderBy: { orderIndex: 'asc' },
        include: { gatePolicies: true },
      },
    },
  });
}
```

Pipeline **create/configure** is Phase 7 (API-03) — Phase 5 read-only only.

---

### `packages/contracts/src/api.ts` (model, transform)

**Analog:** `packages/contracts/src/promotion-run.ts`

**Schema + type export pattern** (promotion-run.ts lines 4-34):

```typescript
import { z } from 'zod';
import { ActorTypeSchema } from './audit.js';

export const PromotionStatusSchema = z.enum([
  'pending', 'active', 'paused', 'completed', 'aborted',
]);

export const ActorSchema = z.object({
  actorType: ActorTypeSchema,
  actorId: z.string(),
  displayName: z.string().optional(),
});

export const PromotionRunCreateInputSchema = z.object({
  pipelineId: z.string(),
  flagKey: z.string(),
  actor: ActorSchema,
});
```

**Add for Phase 5:** `PromotionRunIdParamsSchema`, `PromotionRunResponseSchema` (status, currentStageIndex, pauseReason, temporalWorkflowId, workflow query merge), `GateResultResponseSchema` (forensics from metadata), `StartRunResponseSchema`, list pagination schemas. Reuse `ActorSchema`, `PromotionStatusSchema`, `GateVerdictSchema` — do not redefine enums.

**Barrel export** (`packages/contracts/src/index.ts`):

```typescript
export * from './api.js';
```

---

### `packages/db/src/repositories/promotion-run.repository.ts` (service, CRUD)

**Analog:** self + `pipeline.repository.ts` include pattern

**Existing patterns to preserve** (lines 13-80):

```typescript
export class PromotionRunRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: { pipelineId: string; flagKey: string }) {
    const { pipelineId, flagKey } = PromotionRunCreateSchema.parse(input);
    const pipeline = await this.db.pipeline.findUniqueOrThrow({ where: { id: pipelineId } });
    return this.db.promotionRun.create({
      data: { pipelineId, flagKey, pipelineVersion: pipeline.version },
    });
  }

  async updateState(input: { /* ... */ }) {
    const parsed = PersistRunStateInputSchema.parse({ /* ... */ });
    // ...
  }

  async findById(id: string) {
    return this.db.promotionRun.findUnique({ where: { id } });
  }
}
```

**Likely Phase 5 extension:** `findByIdWithDetails(id)` with pipeline stages + recent gate results for GET `/promotion-runs/:id` (API-02 forensics). Follow `load-run-context.ts` include shape (lines 39-50):

```typescript
include: {
  pipeline: {
    include: {
      stages: {
        orderBy: { orderIndex: 'asc' },
        include: { gatePolicies: true },
      },
    },
  },
  gateResults: { orderBy: { evaluatedAt: 'desc' }, take: 20 },
}
```

---

### `packages/db/src/repositories/gate-result.repository.ts` + `audit.repository.ts` (service, CRUD)

**Analog:** self (exact for history endpoints)

**Gate history** (gate-result.repository.ts lines 26-31):

```typescript
async findByRunId(promotionRunId: string) {
  return this.db.gateResult.findMany({
    where: { promotionRunId },
    orderBy: { evaluatedAt: 'desc' },
  });
}
```

**Audit trail** (audit.repository.ts lines 26-40):

```typescript
async findByRunId(
  promotionRunId: string,
  opts?: { limit?: number; cursor?: string },
) {
  return this.db.auditEvent.findMany({
    where: { promotionRunId },
    orderBy: { occurredAt: 'asc' },
    take: opts?.limit ?? 100,
    ...(opts?.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
    include: { gateResult: true },
  });
}
```

API-02 gate forensics: return `metadata` JSON from GateResult rows (Phase 4 D-13 stores treatmentValue, controlValue, observedDelta).

---

### `apps/api/src/errors/api-error.ts` (utility, transform)

**Analog:** `packages/ld-adapter/src/errors/ld-adapter-error.ts` + `packages/telemetry/src/errors/telemetry-adapter-error.ts`

**Domain error base class** (ld-adapter-error.ts lines 1-9):

```typescript
export class LdAdapterError extends Error {
  constructor(
    message: string,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'LdAdapterError';
  }
}
```

**HTTP mapping pattern for API:**

```typescript
export class HttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// Map: pending→409 on start, not found→404, invalid transition→409, Temporal not found→404
```

Register Fastify `setErrorHandler` to serialize `{ error: message, code, details }`.

---

### `apps/api/src/index.ts` (config, request-response)

**Analog:** `apps/worker/src/worker.ts`

**Bootstrap + graceful shutdown** (worker.ts lines 8-40):

```typescript
async function run(): Promise<void> {
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'promotion';
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const connection = await NativeConnection.connect({ address });
  // ...
  const shutdown = async () => {
    console.log('Shutting down worker...');
    worker.shutdown();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

API equivalent: `buildApp()` → `app.listen({ port })` → `app.close()` on SIGINT/SIGTERM. Log `ff-promo API listening on :PORT`.

---

### `apps/api/src/lib/env.ts` (utility, transform)

**Analog:** `apps/worker/src/lib/clients.ts`

**Env guard at boundary** (clients.ts lines 4-8):

```typescript
export function createWorkerLdProvider() {
  const accessToken = process.env.LD_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('LD_ACCESS_TOKEN is required for LaunchDarkly activities');
  }
  // ...
}
```

API env schema (Zod): `DATABASE_URL`, `TEMPORAL_ADDRESS`, `TEMPORAL_TASK_QUEUE`, `PORT` (default 3000), `API_KEY` (required in prod). Fail fast at startup like worker.

---

### `apps/api/src/__tests__/promotion-runs.routes.test.ts` (test, request-response)

**Analog:** `apps/worker/src/__tests__/start-promotion-run.test.ts` + `promotion.signals.test.ts`

**DB harness** (start-promotion-run.test.ts lines 6-15, 56-67):

```typescript
import {
  createPrismaClient,
  PipelineRepository,
  PromotionRunRepository,
} from '@ff-promo/db';
import {
  getTestDatabaseUrl,
  startTestDatabase,
  stopTestDatabase,
} from '../../../../packages/db/src/__tests__/setup.js';

beforeAll(async () => {
  await startTestDatabase();
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
}, 120_000);
```

**Route test strategy:** Use `app.inject()` with injected `temporalClient: testEnv.client` and testcontainers DB — mirror worker E2E but assert HTTP status/body. For signal routes, reuse `Worker.create` + `runUntil` pattern from signal tests when testing full stack; unit-test service with mocked `Client`.

**Vitest project** — extend `vitest.config.ts` like worker project:

```typescript
{
  extends: true,
  test: {
    name: 'api',
    root: './apps/api',
    include: ['src/**/*.test.ts'],
  },
}
```

---

## Shared Patterns

### Zod validation at boundaries

**Source:** `packages/db/src/repositories/*.ts` + `packages/contracts/src/*.ts`
**Apply to:** All route inputs, service inputs, repository methods

```typescript
const data = PipelineCreateInputSchema.parse(input);
// Repository throws ZodError — map to 400 in error handler
```

### Actor propagation (audit trail)

**Source:** `packages/contracts/src/promotion-run.ts` + `packages/contracts/src/audit.ts`
**Apply to:** All mutating API endpoints

```typescript
export const ActorSchema = z.object({
  actorType: ActorTypeSchema,
  actorId: z.string(),
  displayName: z.string().optional(),
});
```

API auth plugin sets `request.actor = { actorType: 'api_key', actorId: '...' }` for `start`, `pause`, `resume`, `abort`, `create`.

### Dual source of truth (Postgres + Temporal)

**Source:** Phase 4 CONTEXT D-07 / ROADMAP Phase 4
**Apply to:** GET status, all control endpoints

- **Canonical run state:** `PromotionRun` row (`status`, `currentStageIndex`, `pauseReason`)
- **Live execution state:** `statusQuery` when `temporalWorkflowId` present
- Merge in service response: `{ ...run, workflow: await handle.query(statusQuery).catch(() => null) }`

### Prisma client lifecycle

**Source:** All worker activities
**Apply to:** All API services

Create client per request or per service call; always `$disconnect()` in `finally`. Do not hold Prisma client across Fastify plugin lifetime without shutdown hook.

### Integration test seeding

**Source:** `packages/db/src/__tests__/promotion-run.integration.test.ts` + worker signal tests
**Apply to:** API route integration tests

```typescript
const pipeline = await pipelineRepo.create({
  name: `api-test-${randomUUID()}`,
  flagKey: 'api-test-flag',
  projectKey: 'default',
  stages: [{ orderIndex: 0, environment: 'dev', displayName: 'Dev', gatePolicies: [...] }],
});
const run = await runRepo.create({ pipelineId: pipeline.id, flagKey: 'api-test-flag' });
```

### Error class hierarchy

**Source:** `packages/ld-adapter/src/errors/ld-adapter-error.ts`, `packages/telemetry/src/errors/telemetry-adapter-error.ts`
**Apply to:** `apps/api/src/errors/api-error.ts`

Named errors with `context`/`status` fields; HTTP layer maps to status codes — do not leak stack traces in production responses.

---

## No Analog Found

Files with no close match in the codebase (planner should use CLAUDE.md / STACK.md Fastify patterns):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/api/src/app.ts` | config | request-response | No Fastify server exists yet; greenfield per STACK.md |
| `apps/api/src/plugins/auth.ts` | middleware | request-response | No auth middleware in repo; v1 API-key-only per STACK.md variant |
| `apps/api/src/plugins/swagger.ts` | middleware | request-response | No OpenAPI setup; use `@fastify/swagger` + `@fastify/type-provider-zod` |
| `apps/api/src/routes/health.ts` | route | request-response | Standard Fastify health route — no prior art |
| `packages/contracts/src/api.ts` | model | transform | No HTTP DTO schemas yet; follow existing Zod contract files |

**STACK.md reference for Fastify bootstrap (planner copy-from):**

```typescript
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from '@fastify/type-provider-zod';

const app = Fastify().withTypeProvider<ZodTypeProvider>();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
```

---

## Phase 4 Worker Patterns to Reuse Directly

| Phase 4 artifact | Phase 5 usage |
|------------------|---------------|
| `start-promotion-run.ts` | `POST .../start` — import, do not rewrite |
| `signals.ts` | pause/resume/abort routes + status query |
| `promotion.workflow.ts` | No changes; API only signals existing workflow |
| `load-run-context.ts` | Optional: service loads run+pipeline for response shaping |
| `persist-run-state.ts` activity | Unchanged; workflow still owns state transitions |
| Signal test patterns | Template for API integration tests with Temporal test env |

---

## Metadata

**Analog search scope:** `apps/api/`, `apps/worker/src/`, `packages/db/src/`, `packages/contracts/src/`, `.planning/phases/04-promotion-engine/`
**Files scanned:** ~45 source files
**Pattern extraction date:** 2026-06-22
