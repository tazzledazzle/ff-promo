# Phase 7: Guardrails & Self-Service - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 28 new/modified files (Phase 7 scope)
**Analogs found:** 22 / 28
**Upstream context:** `07-CONTEXT.md` (D-01–D-21); no `07-RESEARCH.md` yet — patterns from Phase 5 API, Phase 6 dashboard, existing pipeline repository.

## Recommended Layout

Phase 7 extends the existing pipeline stack (Prisma models, repository, read-only routes, dashboard pipeline picker) with **write APIs**, **server-side guardrail enforcement**, and **platform-engineer UI**. No new apps — all changes land in `packages/contracts`, `packages/db`, `apps/api`, and `apps/web`.

```
packages/contracts/src/
  pipeline.ts                           # MODIFY: PipelineUpdateInput, GuardrailPolicySchema, response types
  api.ts                                # MODIFY: full PipelineDetailResponse with gatePolicies, list isActive
packages/db/
  prisma/schema.prisma                  # MODIFY (optional): guardrailPolicy Json? on Pipeline
  src/repositories/pipeline.repository.ts # MODIFY: deactivate, updateMetadata, listAll
  src/__tests__/pipeline.integration.test.ts # MODIFY: deactivate + update tests
apps/api/src/
  errors/api-error.ts                   # MODIFY: forbidden(), unprocessable()
  services/guardrail.service.ts         # NEW: validatePromotionRequest
  services/pipeline.service.ts          # NEW: create, update, deactivate, map responses
  routes/pipelines.ts                   # MODIFY: POST, PATCH, extend GET detail
  services/promotion-run.service.ts     # MODIFY: call guardrails in createRun + startRun
  __tests__/pipelines.create.test.ts    # NEW: POST pipeline
  __tests__/guardrails.integration.test.ts # NEW: reject wrong flagKey, accept valid flow
apps/web/src/
  app/pipelines/page.tsx                # NEW: list (UI-04)
  app/pipelines/new/page.tsx            # NEW: create form (UI-04)
  app/pipelines/[id]/page.tsx           # NEW: detail + deactivate (UI-04)
  components/pipelines/
    pipelines-page-header.tsx           # NEW: mirror runs-page-header
    pipelines-table.tsx                 # NEW: mirror runs-table
    pipeline-form.tsx                   # NEW: stages + gate policy editors
    pipeline-detail.tsx                 # NEW: read-only stages/policies + deactivate
  hooks/use-pipeline-mutations.ts       # NEW: create, deactivate
  lib/api-client.ts                     # MODIFY: createPipeline, updatePipeline, deactivatePipeline
  lib/api-errors.ts                     # MODIFY: isGuardrailError (403/422)
  __tests__/integration/pipeline-form.test.tsx # NEW: MSW form submit
  __tests__/mocks/handlers.ts           # MODIFY: POST/PATCH pipeline handlers
```

**REST surface Phase 7 adds or extends:**

| Method | Path | Use | Contracts type |
|--------|------|-----|----------------|
| `POST` | `/v1/pipelines` | Create pipeline + stages + gate policies (D-05) | `PipelineCreateInput` → `PipelineResponse` |
| `PATCH` | `/v1/pipelines/:id` | Update metadata / deactivate (D-06) | `PipelineUpdateInput` → `PipelineResponse` |
| `GET` | `/v1/pipelines` | List (extend with `isActive`) | `PipelineListResponse` |
| `GET` | `/v1/pipelines/:id` | Detail with gate policies (extend) | `PipelineDetailResponse` |
| `POST` | `/v1/promotion-runs` | Self-service create (guardrail hook) | existing + 403/422 on violation |
| `POST` | `/v1/promotion-runs/:id/start` | Start (guardrail hook) | existing + 403/422 on violation |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/contracts/src/pipeline.ts` | model | transform | self (existing `PipelineCreateInputSchema`) | exact (extend) |
| `packages/contracts/src/api.ts` | model | transform | self (`PipelineListResponseSchema`) | exact (extend) |
| `packages/db/src/repositories/pipeline.repository.ts` | service | CRUD | self + `promotion-run.repository.ts` | exact (extend) |
| `packages/db/src/__tests__/pipeline.integration.test.ts` | test | batch | self | exact (extend) |
| `apps/api/src/errors/api-error.ts` | utility | transform | self (`conflict`, `notFound`) | exact (extend) |
| `apps/api/src/services/guardrail.service.ts` | service | transform | `promotion-run.service.ts` `createRun` checks | role-match |
| `apps/api/src/services/pipeline.service.ts` | service | CRUD | `promotion-run.service.ts` + `pipeline.repository.ts` | role-match |
| `apps/api/src/routes/pipelines.ts` | route | CRUD | `promotion-runs.ts` POST + existing GET | exact (extend) |
| `apps/api/src/services/promotion-run.service.ts` | service | request-response | self `createRun`/`startRun` | exact (extend) |
| `apps/api/src/__tests__/pipelines.list.test.ts` | test | request-response | self | exact (extend) |
| `apps/api/src/__tests__/guardrails.integration.test.ts` | test | request-response | `promotion-runs.control.test.ts` seed helpers | role-match |
| `apps/web/src/app/pipelines/page.tsx` | component | request-response | `apps/web/src/app/runs/page.tsx` | exact |
| `apps/web/src/app/pipelines/new/page.tsx` | component | CRUD | `apps/web/src/app/runs/new/page.tsx` | exact |
| `apps/web/src/app/pipelines/[id]/page.tsx` | component | request-response | `apps/web/src/app/runs/[id]/run-detail.tsx` | role-match |
| `apps/web/src/components/pipelines/pipelines-table.tsx` | component | transform | `components/runs/runs-table.tsx` | exact |
| `apps/web/src/components/pipelines/pipeline-form.tsx` | component | CRUD | `runs/new/page.tsx` form + seed gate policy shape | role-match |
| `apps/web/src/hooks/use-pipeline-mutations.ts` | hook | request-response | `hooks/use-run-mutations.ts` | exact |
| `apps/web/src/hooks/use-pipelines.ts` | hook | pub-sub | self | exact (extend invalidate) |
| `apps/web/src/lib/api-client.ts` | service | request-response | self (`listPipelines`, `createPromotionRun`) | exact (extend) |
| `apps/web/src/lib/api-errors.ts` | utility | transform | self (`isConflictError`) | exact (extend) |
| `apps/web/src/__tests__/integration/pipeline-form.test.tsx` | test | request-response | `create-run.test.tsx` | exact |
| `apps/web/src/__tests__/mocks/handlers.ts` | test | request-response | self (pipeline GET handlers) | exact (extend) |
| `packages/db/prisma/schema.prisma` | model | CRUD | self (`Pipeline.isActive`) | partial |
| `apps/web/src/components/pipelines/pipelines-page-header.tsx` | component | — | `runs-page-header.tsx` | exact |
| `apps/web/src/components/pipelines/pipeline-detail.tsx` | component | transform | `mockPipelineDetail` in handlers | partial |
| `apps/api/src/__tests__/pipelines.create.test.ts` | test | CRUD | `pipelines.list.test.ts` | exact |
| `apps/web/src/lib/query-keys.ts` | utility | — | self | exact (no change likely) |
| `apps/web/src/lib/actor.ts` | utility | transform | self | exact (platform actorId) |

---

## Pattern Assignments

### `packages/contracts/src/pipeline.ts` (model, transform)

**Analog:** self — existing create input schemas (lines 1-31)

**Extend, do not duplicate** — `PipelineCreateInputSchema`, `StageInputSchema`, `GatePolicyInputSchema` already match repository + seed:

```typescript
import { z } from 'zod';

export const StageEnvironmentSchema = z.enum(['dev', 'staging', 'prod']);

export const GatePolicyInputSchema = z.object({
  metricType: z.string(),
  threshold: z.number(),
  serviceName: z.string(),
  comparisonMode: z.string().optional(),
  windowSeconds: z.number().int().optional(),
  minSampleSize: z.number().int().optional(),
});

export const StageInputSchema = z.object({
  orderIndex: z.number().int(),
  environment: StageEnvironmentSchema,
  displayName: z.string(),
  gatePolicies: z.array(GatePolicyInputSchema),
});

export const PipelineCreateInputSchema = z.object({
  name: z.string(),
  flagKey: z.string(),
  projectKey: z.string(),
  stages: z.array(StageInputSchema),
});
```

**Add for Phase 7:**

```typescript
export const GuardrailPolicySchema = z.object({
  allowedEnvironments: z.array(StageEnvironmentSchema).optional(),
  requirePreflightPass: z.boolean().optional(),
  maxConcurrentRunsPerFlag: z.number().int().positive().optional(),
});

export const PipelineUpdateInputSchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
  actor: ActorSchema, // from promotion-run.ts — audit (D-12)
});

export const PipelineResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  flagKey: z.string(),
  projectKey: z.string(),
  isActive: z.boolean(),
  version: z.number().int(),
  stages: z.array(StageInputSchema.extend({ id: z.string() })),
});
```

Export inferred types; barrel via `packages/contracts/src/index.ts` (already re-exports `./pipeline.js`).

**Validation rules to encode in schema or service (D-10, D-11):**

- Each stage must include `error_rate` and `latency_p95` gate policies
- Stages ordered dev → staging → prod by `orderIndex`
- No duplicate `environment` per pipeline

---

### `packages/contracts/src/api.ts` (model, transform)

**Analog:** self — `PipelineListResponseSchema`, `PipelineDetailResponseSchema` (lines 112-136)

**Extend list item** with active badge field:

```typescript
export const PipelineListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  flagKey: z.string(),
  stageCount: z.number().int(),
  isActive: z.boolean(), // NEW for D-13
});
```

**Extend detail** with gate policies (currently stages omit policies — routes return stage metadata only):

```typescript
export const PipelineStageDetailSchema = z.object({
  id: z.string(),
  orderIndex: z.number().int(),
  environment: z.string(),
  displayName: z.string(),
  gatePolicies: z.array(GatePolicyInputSchema.extend({ id: z.string() })),
});
```

Reuse `GatePolicyInputSchema` from `pipeline.ts` — import, do not redefine metric types.

---

### `packages/db/src/repositories/pipeline.repository.ts` (service, CRUD)

**Analog:** self — `create`, `findById`, `listActive` (lines 7-76)

**Create pattern** — Zod parse at boundary, nested Prisma create (lines 7-39):

```typescript
async create(input: PipelineCreateInput) {
  const data = PipelineCreateInputSchema.parse(input);

  return this.db.pipeline.create({
    data: {
      name: data.name,
      flagKey: data.flagKey,
      projectKey: data.projectKey,
      stages: {
        create: data.stages.map((stage) => ({
          orderIndex: stage.orderIndex,
          environment: stage.environment,
          displayName: stage.displayName,
          gatePolicies: {
            create: stage.gatePolicies.map((policy) => ({
              metricType: policy.metricType,
              threshold: policy.threshold,
              serviceName: policy.serviceName,
              comparisonMode: policy.comparisonMode ?? 'absolute',
              windowSeconds: policy.windowSeconds ?? 300,
              minSampleSize: policy.minSampleSize ?? 0,
            })),
          },
        })),
      },
    },
    include: {
      stages: {
        orderBy: { orderIndex: 'asc' },
        include: { gatePolicies: true },
      },
    },
  });
}
```

**Add deactivate** — mirror `isActive` filter in `listActive` (lines 66-75):

```typescript
async deactivate(id: string) {
  return this.db.pipeline.update({
    where: { id },
    data: { isActive: false },
    include: {
      stages: {
        orderBy: { orderIndex: 'asc' },
        include: { gatePolicies: true },
      },
    },
  });
}

async listAll() {
  return this.db.pipeline.findMany({
    orderBy: { name: 'asc' },
    include: {
      stages: { select: { id: true } },
    },
  });
}
```

**Prisma model** (`schema.prisma` lines 42-57): `isActive`, `version`, `@@unique([name, version])` — v1 deactivate = soft-delete; new config = new `create` row (D-04).

**Repository test fixture** — copy 3-stage dev→staging→prod from `pipeline.integration.test.ts` (lines 26-68):

```typescript
stages: [
  { orderIndex: 0, environment: 'dev', displayName: 'Development', gatePolicies: [...] },
  { orderIndex: 1, environment: 'staging', displayName: 'Staging', gatePolicies: [...] },
  { orderIndex: 2, environment: 'prod', displayName: 'Production', gatePolicies: [...] },
],
```

Each stage needs both `error_rate` and `latency_p95` per seed (`seed.ts` lines 14-27).

---

### `apps/api/src/services/guardrail.service.ts` (service, transform)

**Analog:** `apps/api/src/services/promotion-run.service.ts` `createRun` (lines 41-59) + `errors/api-error.ts`

**Factory pattern** — same as `createPromotionRunService`:

```typescript
import type { PipelineRepository } from '@ff-promo/db';
import { forbidden, notFound, unprocessable } from '../errors/api-error.js';

const REQUIRED_METRICS = ['error_rate', 'latency_p95'] as const;
const ENV_ORDER = ['dev', 'staging', 'prod'] as const;

export function createGuardrailService(repos: { pipeline: PipelineRepository }) {
  return {
    async validatePromotionRequest(input: { pipelineId: string; flagKey: string }) {
      const pipeline = await repos.pipeline.findById(input.pipelineId);
      if (!pipeline) {
        throw notFound(`Pipeline ${input.pipelineId} not found`);
      }
      if (!pipeline.isActive) {
        throw forbidden(`Pipeline ${pipeline.name} is inactive`);
      }
      if (pipeline.flagKey !== input.flagKey) {
        throw forbidden(
          `Flag key "${input.flagKey}" does not match pipeline flag "${pipeline.flagKey}"`,
        );
      }
      if (!pipeline.stages.length) {
        throw unprocessable('Pipeline has no stages');
      }
      // D-11: monotonic environment order
      const envs = pipeline.stages.map((s) => s.environment);
      // D-10: required gate policies per stage
      for (const stage of pipeline.stages) {
        const metrics = new Set(stage.gatePolicies.map((p) => p.metricType));
        for (const required of REQUIRED_METRICS) {
          if (!metrics.has(required)) {
            throw unprocessable(
              `Stage ${stage.displayName} missing required gate policy: ${required}`,
            );
          }
        }
      }
      return pipeline;
    },
  };
}
```

**Add error helpers** to `api-error.ts` (alongside `conflict`, `notFound` lines 12-18):

```typescript
export function forbidden(message: string) {
  return new ApiError(403, message, 'forbidden');
}

export function unprocessable(message: string) {
  return new ApiError(422, message, 'unprocessable');
}
```

Call from `createRun` and `startRun` before persisting / starting workflow (D-08).

---

### `apps/api/src/services/pipeline.service.ts` (service, CRUD)

**Analog:** `promotion-run.service.ts` + `pipeline.repository.ts`

**Request DB lifecycle** — copy `createRun` try/finally pattern (promotion-run.service.ts lines 46-59):

```typescript
async createPipeline(input: PipelineCreateInput & { actor: Actor }) {
  const { repos, dispose } = createRequestDb(deps.databaseUrl);
  try {
    // validate stages (D-10, D-11) before create
    const pipeline = await repos.pipeline.create(input);
    // audit: pipeline_created (extend AuditActionSchema or use metadata)
    return mapPipelineResponse(pipeline);
  } finally {
    await dispose();
  }
}

async deactivatePipeline(id: string, actor: Actor) {
  const { repos, dispose } = createRequestDb(deps.databaseUrl);
  try {
    const existing = await repos.pipeline.findById(id);
    if (!existing) throw notFound(`Pipeline ${id} not found`);
    const pipeline = await repos.pipeline.deactivate(id);
    return mapPipelineResponse(pipeline);
  } finally {
    await dispose();
  }
}
```

**Response mapper** — mirror list route projection (`pipelines.ts` lines 22-27) plus nested gate policies:

```typescript
function mapPipelineResponse(pipeline: PipelineWithStages) {
  return {
    id: pipeline.id,
    name: pipeline.name,
    flagKey: pipeline.flagKey,
    projectKey: pipeline.projectKey,
    isActive: pipeline.isActive,
    version: pipeline.version,
    stages: pipeline.stages.map((stage) => ({
      id: stage.id,
      orderIndex: stage.orderIndex,
      environment: stage.environment,
      displayName: stage.displayName,
      gatePolicies: stage.gatePolicies.map((p) => ({
        id: p.id,
        metricType: p.metricType,
        threshold: p.threshold,
        serviceName: p.serviceName,
        comparisonMode: p.comparisonMode,
        windowSeconds: p.windowSeconds,
        minSampleSize: p.minSampleSize,
      })),
    })),
  };
}
```

---

### `apps/api/src/routes/pipelines.ts` (route, CRUD)

**Analog:** self GET routes (lines 7-81) + `promotion-runs.ts` POST (lines 20-31)

**Existing list pattern** (lines 10-32):

```typescript
app.get('/', {
  schema: { response: { 200: PipelineListResponseSchema } },
}, async () => {
  const { repos, dispose } = createRequestDb(env.DATABASE_URL);
  try {
    const pipelines = await repos.pipeline.listActive();
    return {
      pipelines: pipelines.map((pipeline) => ({
        id: pipeline.id,
        name: pipeline.name,
        flagKey: pipeline.flagKey,
        stageCount: pipeline.stages.length,
      })),
    };
  } finally {
    await dispose();
  }
});
```

**Add POST** — delegate to `pipelineService.createPipeline`; return 201:

```typescript
app.post('/', {
  schema: {
    body: PipelineCreateRequestSchema, // PipelineCreateInput + actor
    response: { 201: PipelineResponseSchema },
  },
}, async (request, reply) => {
  const pipeline = await pipelineService.createPipeline(request.body);
  return reply.status(201).send(pipeline);
});
```

**Add PATCH** for deactivate/update (D-06):

```typescript
app.patch('/:id', {
  schema: {
    params: z.object({ id: z.string() }),
    body: PipelineUpdateInputSchema,
    response: { 200: PipelineResponseSchema },
  },
}, async (request) => pipelineService.updatePipeline(request.params.id, request.body));
```

**Extend GET `/:id`** — include `gatePolicies` on stages; add `isActive`, `projectKey` already present (lines 65-76).

Register service via `buildApp` — either inject `pipelineService` alongside `promotionRunService` or construct inside route plugin from `app.env`.

---

### `apps/api/src/services/promotion-run.service.ts` (service, extend)

**Analog:** self `createRun` (lines 41-59) and `startRun` (lines 62-107)

**Hook guardrails before create** — replace bare pipeline lookup:

```typescript
async createRun(input: { pipelineId: string; flagKey: string; actor: Actor }) {
  const { repos, dispose } = createRequestDb(deps.databaseUrl);
  try {
    await guardrailService.validatePromotionRequest({
      pipelineId: input.pipelineId,
      flagKey: input.flagKey,
    });
    const run = await repos.promotionRun.create({
      pipelineId: input.pipelineId,
      flagKey: input.flagKey,
    });
    return mapPromotionRun(run);
  } finally {
    await dispose();
  }
}
```

**Hook guardrails in startRun** — re-validate pipeline still active + flagKey match before audit append (lines 68-84).

Existing `notFound` on missing pipeline becomes guardrail service responsibility.

---

### `apps/web/src/lib/api-client.ts` (service, extend)

**Analog:** self — `listPipelines`, `createPromotionRun` (lines 64-95)

**Add pipeline write methods** following existing `request` helper:

```typescript
createPipeline(body: PipelineCreateInput & { actor: Actor }) {
  return request<PipelineResponse>('/v1/pipelines', {
    method: 'POST',
    body: JSON.stringify(body),
  });
},

updatePipeline(pipelineId: string, body: PipelineUpdateInput) {
  return request<PipelineResponse>(`/v1/pipelines/${pipelineId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
},

deactivatePipeline(pipelineId: string, actor: Actor) {
  return this.updatePipeline(pipelineId, { isActive: false, actor });
},
```

**Error parsing** — reuse `parseResponse` + `ApiClientError` (lines 20-33); 403/422 surface `message` from API JSON shape (`app.ts` lines 50-54).

---

### `apps/web/src/lib/api-errors.ts` (utility, extend)

**Analog:** self — `isConflictError` (lines 12-14)

```typescript
export function isGuardrailError(error: unknown): error is ApiClientError {
  return (
    error instanceof ApiClientError &&
    (error.status === 403 || error.status === 422)
  );
}
```

Use in create-run page and pipeline form `onError` handlers.

---

### `apps/web/src/app/pipelines/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/runs/page.tsx`

**List page skeleton** (runs/page.tsx lines 7-23):

```typescript
'use client';

import { PipelinesPageHeader } from '@/components/pipelines/pipelines-page-header';
import { PipelinesTable } from '@/components/pipelines/pipelines-table';
import { usePipelines } from '@/hooks/use-pipelines';

export default function PipelinesPage() {
  const { pipelines, isLoading, isError, error } = usePipelines();

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <PipelinesPageHeader />
      {isError ? (
        <div role="alert" className="mb-4 rounded-md border border-destructive/50 ...">
          {error instanceof Error ? error.message : 'Failed to load pipelines'}
        </div>
      ) : null}
      <PipelinesTable pipelines={pipelines} isLoading={isLoading} />
    </main>
  );
}
```

Extend `usePipelines` to return `isActive` once list API includes it (D-13).

---

### `apps/web/src/app/pipelines/new/page.tsx` (component, CRUD)

**Analog:** `apps/web/src/app/runs/new/page.tsx`

**Form + submit pattern** (runs/new/page.tsx lines 35-59):

```typescript
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  setSubmitError(null);
  setIsSubmitting(true);
  try {
    const pipeline = await api.createPipeline({
      name,
      flagKey: flagKey.trim(),
      projectKey,
      stages,
      actor: dashboardActor('platform'), // D-18
    });
    router.push(`/pipelines/${pipeline.id}`);
  } catch (err) {
    setSubmitError(err instanceof Error ? err.message : 'Failed to create pipeline');
  } finally {
    setIsSubmitting(false);
  }
};
```

**Gate policy defaults** — copy from seed (`seed.ts` lines 14-27):

```typescript
const defaultGatePolicies = [
  { metricType: 'error_rate', threshold: 0.01, serviceName: 'demo-service' },
  { metricType: 'latency_p95', threshold: 500, serviceName: 'demo-service' },
];
```

Extract heavy form into `components/pipelines/pipeline-form.tsx`; page stays thin like `runs/new`.

---

### `apps/web/src/components/pipelines/pipelines-table.tsx` (component, transform)

**Analog:** `apps/web/src/components/runs/runs-table.tsx`

**Table structure** (runs-table.tsx lines 54-80):

```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Flag Key</TableHead>
      <TableHead>Stages</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {pipelines.map((pipeline) => (
      <TableRow key={pipeline.id}>
        <TableCell>{pipeline.name}</TableCell>
        <TableCell className="font-mono text-sm">{pipeline.flagKey}</TableCell>
        <TableCell>{pipeline.stageCount}</TableCell>
        <TableCell>
          <Badge variant={pipeline.isActive ? 'default' : 'secondary'}>
            {pipeline.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <Button asChild variant="outline" size="sm">
            <Link href={`/pipelines/${pipeline.id}`}>View</Link>
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

Use shadcn `Table`, `Badge`, `Skeleton` — same imports as runs-table.

---

### `apps/web/src/hooks/use-pipeline-mutations.ts` (hook, request-response)

**Analog:** `apps/web/src/hooks/use-run-mutations.ts`

**Mutation + invalidate pattern** (use-run-mutations.ts lines 18-44):

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createApiClient } from '@/lib/api-client';
import { dashboardActor } from '@/lib/actor';
import { queryKeys } from '@/lib/query-keys';

const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

export function usePipelineMutations(pipelineId?: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.list });
    if (pipelineId) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.pipelines.detail(pipelineId),
      });
    }
  };

  const create = useMutation({
    mutationFn: (input: PipelineCreateInput) =>
      api.createPipeline({ ...input, actor: dashboardActor('platform') }),
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: () =>
      api.deactivatePipeline(pipelineId!, dashboardActor('platform')),
    onSuccess: invalidate,
  });

  return { create, deactivate };
}
```

---

### `apps/web/src/hooks/use-pipelines.ts` (hook, extend)

**Analog:** self (lines 12-25)

No structural change — ensure `PipelineListItem` includes `isActive` from contracts. Consider `listAll` vs active-only: platform list page may need inactive pipelines (extend API to `listAll` or query param `?includeInactive=true`).

---

### API integration tests

**Analog:** `apps/api/src/__tests__/pipelines.list.test.ts` + `promotion-runs.control.test.ts`

**Harness** (pipelines.list.test.ts lines 17-35):

```typescript
beforeAll(async () => {
  await startTestDatabase();
  const databaseUrl = getTestDatabaseUrl()!;
  app = await buildApp({
    env: { DATABASE_URL: databaseUrl, ... },
    service: createPromotionRunService({ ... }),
  });
}, 120_000);
```

**Seed pipeline** — reuse `PipelineRepository.create` fixture (list test lines 46-76).

**Guardrail rejection test** (D-19):

```typescript
it('rejects createRun when flagKey mismatches pipeline', async () => {
  const pipeline = await seedPipeline();
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

it('accepts valid self-service createRun', async () => {
  const pipeline = await seedPipeline();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/promotion-runs',
    payload: {
      pipelineId: pipeline.id,
      flagKey: pipeline.flagKey,
      actor: { actorType: 'user', actorId: 'dev' },
    },
  });
  expect(response.statusCode).toBe(201);
});
```

---

### Web MSW tests

**Analog:** `apps/web/src/__tests__/integration/create-run.test.tsx` + `mocks/handlers.ts`

**MSW handler for POST pipeline** — extend handlers.ts after existing GET (lines 172-178):

```typescript
http.post('/api/ff-promo/v1/pipelines', async ({ request }) => {
  const body = await request.json();
  const pipeline: PipelineResponse = {
    id: 'pipeline-new',
    name: body.name,
    flagKey: body.flagKey,
    projectKey: body.projectKey,
    isActive: true,
    version: 1,
    stages: body.stages,
  };
  return HttpResponse.json(pipeline, { status: 201 });
}),
```

**Form test** (create-run.test.tsx lines 12-30):

```typescript
describe('pipeline form integration', () => {
  it('submits form and navigates to new pipeline detail', async () => {
    renderWithProviders(<NewPipelinePage />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Checkout' } });
    // ... fill stages
    fireEvent.click(screen.getByRole('button', { name: 'Create pipeline' }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/pipelines/pipeline-new');
    });
  });
});
```

---

## Shared Patterns

### Contracts as single source of truth

**Source:** `packages/contracts/src/pipeline.ts`, `api.ts`
**Apply to:** repository input, API schemas, web form state, MSW fixtures

```typescript
import type { PipelineCreateInput, PipelineListItem } from '@ff-promo/contracts';
import { StageEnvironmentSchema, GatePolicyInputSchema } from '@ff-promo/contracts';
```

Never hardcode `'dev' | 'staging' | 'prod'` or metric type strings outside contracts.

### Zod parse at repository boundary

**Source:** `pipeline.repository.ts` line 8
**Apply to:** all repository write methods

```typescript
const data = PipelineCreateInputSchema.parse(input);
```

### Request-scoped DB with dispose

**Source:** `apps/api/src/routes/pipelines.ts` lines 18-31, `promotion-run.service.ts`
**Apply to:** all API services and routes

```typescript
const { repos, dispose } = createRequestDb(env.DATABASE_URL);
try {
  // ...
} finally {
  await dispose();
}
```

### API error JSON shape

**Source:** `apps/api/src/app.ts` (lines 49-55)
**Apply to:** guardrail 403/422, validation 400, web error display

```typescript
{ error: 'forbidden' | 'unprocessable' | 'validation_error', message: string }
```

### Actor on mutations

**Source:** `apps/web/src/lib/actor.ts`, `CreatePromotionRunRequestSchema`
**Apply to:** pipeline create, deactivate, promotion create/start

```typescript
actor: { actorType: 'user', actorId: 'platform' }  // platform engineer
actor: { actorType: 'user', actorId: 'dashboard' } // developer self-service
```

### TanStack Query key factory

**Source:** `apps/web/src/lib/query-keys.ts` (lines 16-19)
**Apply to:** pipeline list/detail invalidation after mutations

```typescript
pipelines: {
  list: ['pipelines', 'list'] as const,
  detail: (id: string) => ['pipelines', id] as const,
},
```

### Required gate policies per stage

**Source:** `packages/db/src/seed.ts` (lines 14-27)
**Apply to:** guardrail service, pipeline form defaults, API create validation

Each stage needs `error_rate` + `latency_p95` with `serviceName`, `threshold`, optional `windowSeconds`.

### Biome / monorepo conventions

**Source:** Phase 6 PATTERNS — tabs in `apps/api`, `@/` alias in web, `workspace:*` deps

---

## Anti-Patterns to Avoid

| Anti-pattern | Why | Do instead |
|--------------|-----|------------|
| Client-side-only guardrail checks | GRD-03 requires server enforcement | `GuardrailService` in API before create/start |
| In-place pipeline edits overwriting history | D-04 immutable create + deactivate | `deactivate` old row; `create` new version |
| Omitting gate policies from GET detail | UI-04 form/detail needs thresholds | Extend `PipelineDetailResponse` with nested policies |
| Duplicating stage/env enums in web | Drift from contracts | Import `StageEnvironmentSchema` |
| Skipping guardrail check on `startRun` | Inactive pipeline could start pending run | Re-validate in `startRun` |
| `NEXT_PUBLIC_*` for platform secrets | Same as Phase 6 | Server-side API key if auth added later |
| Prisma calls from `apps/web` | Presentation-only dashboard | REST via `api-client.ts` |
| New promotion endpoint for self-service | D-09 reuse existing flows | Guard existing `POST /v1/promotion-runs` |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/api/src/services/guardrail.service.ts` | service | transform | No dedicated validation service yet — compose from `createRun` checks + new rules |
| `apps/web/src/components/pipelines/pipeline-form.tsx` | component | CRUD | No multi-field config form in repo — closest is simple `runs/new` select form |
| Pipeline audit events | model | event-driven | `AuditEvent` tied to `promotionRunId` only — extend schema or use metadata for pipeline create/update (D-12 discretion) |

**Reference for gate policy editor UX:** seed data structure in `packages/db/src/seed.ts` and integration test fixtures in `pipeline.integration.test.ts`.

---

## Phase 5/6 Patterns to Reuse

| Prior artifact | Phase 7 usage |
|----------------|---------------|
| `packages/db/src/repositories/pipeline.repository.ts` | Extend create/find/list; add deactivate |
| `apps/api/src/routes/pipelines.ts` | Extend with POST/PATCH |
| `apps/api/src/routes/promotion-runs.ts` | POST body + 201 pattern for pipeline create |
| `packages/contracts/src/pipeline.ts` | Base schemas for stages/gate policies |
| `apps/web/src/app/runs/new/page.tsx` | Form submit + redirect pattern |
| `apps/web/src/app/runs/page.tsx` | List page + error alert pattern |
| `apps/web/src/components/runs/runs-table.tsx` | Table + badge + link pattern |
| `apps/web/src/hooks/use-run-mutations.ts` | Mutation hook structure |
| `apps/web/src/lib/api-client.ts` | Typed fetch wrapper |
| `apps/web/src/__tests__/mocks/handlers.ts` | MSW pipeline fixtures |
| `apps/api/src/__tests__/pipelines.list.test.ts` | API test harness + seed |

---

## Metadata

**Analog search scope:** `packages/contracts/src/`, `packages/db/src/repositories/`, `apps/api/src/routes/`, `apps/api/src/services/`, `apps/api/src/__tests__/`, `apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/hooks/`, `apps/web/src/lib/`, `apps/web/src/__tests__/`
**Files scanned:** ~40 source files
**Pattern extraction date:** 2026-06-22
