# Phase 4: Promotion Engine - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 26 new/modified files (Phase 4 scope)
**Analogs found:** 24 / 26
**Upstream context:** No `CONTEXT.md` or `RESEARCH.md` in phase dir yet — scope inferred from README Phase 4 note, existing worker skeleton, and `@ff-promo/ld-adapter` + `@ff-promo/telemetry` packages from Phases 2–3.

## Recommended Worker Package Layout

Phase 4 extends `apps/worker` without moving orchestration logic into packages. Adapters stay in `packages/*`; worker activities are thin wrappers that wire env → clients → adapter → repositories.

```
apps/worker/src/
  activities/
    index.ts                      # barrel — export all proxied activities
    persist-run-state.ts          # existing (D-07 canonical state)
    record-audit-event.ts         # existing (D-01 audit trail)
    evaluate-gate.ts              # MODIFY: stub → real telemetry + GateResult persist
    run-preflight.ts              # NEW: Prometheus preflight before stage work
    apply-stage-targeting.ts      # NEW: LD semantic patch for current stage
    start-promotion-run.ts        # NEW: pending→active transition + workflow bootstrap data
  lib/
    clients.ts                    # NEW: createLaunchDarklyProvider + createPrometheusClient from env
    run-loader.ts                 # NEW: load PromotionRun + pipeline stages + gate policies
    mappers.ts                    # NEW: DB stage → GateRunContext, TargetingIntent
  workflows/
    promotion.workflow.ts         # MODIFY: preflight → apply targeting → gate loop
    signals.ts                    # existing — no change expected
  worker.ts                       # MODIFY: activity timeouts; optional deps injection for tests
  __tests__/
    helpers/
      seed-promotion-run.ts       # NEW: extract shared seed from workflow tests
      nock-launchdarkly.ts        # NEW: LD HTTP mocks (from ld-adapter tests)
      nock-prometheus.ts          # NEW: PromQL reply router (from telemetry-integration)
    run-preflight.activity.test.ts
    apply-stage-targeting.activity.test.ts
    evaluate-gate.activity.test.ts
    start-promotion-run.activity.test.ts
    promotion-engine.integration.test.ts  # NEW: full stage loop with nock + testcontainers
    promotion.workflow.test.ts    # MODIFY: mock or nock external deps
    promotion.signals.test.ts     # MODIFY: same
```

**Primary analog file paths (copy patterns from these first):**

| Concern | Primary analog | Secondary analog |
|---------|----------------|------------------|
| Activity shell (env, db, repo, disconnect) | `apps/worker/src/activities/persist-run-state.ts` | `apps/worker/src/activities/evaluate-gate.ts` |
| Real gate evaluation logic | `packages/telemetry/src/evaluate/evaluate-stage-gates.ts` | `packages/telemetry/src/evaluate/evaluate-gate-policy.ts` |
| Preflight logic | `packages/telemetry/src/preflight/run-preflight.ts` | `packages/telemetry/src/__tests__/telemetry-integration.test.ts` |
| LD write from worker | `packages/ld-adapter/src/write/apply-targeting.ts` | `packages/ld-adapter/src/provider/launch-darkly-provider.ts` |
| LD provider factory | `packages/ld-adapter/src/provider/launch-darkly-provider.ts` | `packages/ld-adapter/src/client/ld-api-client.ts` |
| Prometheus client factory | `packages/telemetry/src/client/prometheus-client.ts` | — |
| Run state + audit | `packages/db/src/repositories/promotion-run.repository.ts` | `packages/db/src/repositories/audit.repository.ts` |
| Gate result persist | `packages/db/src/repositories/gate-result.repository.ts` | `packages/db/src/__tests__/gate-result.integration.test.ts` |
| Pipeline/stage load | `packages/db/src/repositories/pipeline.repository.ts` | `apps/worker/src/activities/evaluate-gate.ts` (include pattern) |
| Workflow activity proxy | `apps/worker/src/workflows/promotion.workflow.ts` | — |
| Worker registration | `apps/worker/src/worker.ts` | — |
| DB integration test harness | `packages/db/src/__tests__/setup.ts` | `packages/db/src/__tests__/promotion-run.integration.test.ts` |
| Workflow integration test | `apps/worker/src/__tests__/promotion.workflow.test.ts` | `apps/worker/src/__tests__/promotion.signals.test.ts` |
| Telemetry nock tests | `packages/telemetry/src/__tests__/telemetry-integration.test.ts` | — |
| LD nock tests | `packages/ld-adapter/src/__tests__/launch-darkly-provider.test.ts` | `packages/ld-adapter/src/__tests__/apply-targeting.test.ts` |

**New worker dependencies** (mirror package env vars from README):

```json
"@ff-promo/ld-adapter": "workspace:*",
"@ff-promo/telemetry": "workspace:*"
```

Add `nock` to worker devDependencies (already used in ld-adapter and telemetry projects).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/worker/src/activities/run-preflight.ts` | service (activity) | request-response | `apps/worker/src/activities/evaluate-gate.ts` + `packages/telemetry/src/preflight/run-preflight.ts` | role-match |
| `apps/worker/src/activities/apply-stage-targeting.ts` | service (activity) | request-response | `apps/worker/src/activities/persist-run-state.ts` + `packages/ld-adapter/src/write/apply-targeting.ts` | role-match |
| `apps/worker/src/activities/evaluate-gate.ts` | service (activity) | request-response | `packages/telemetry/src/evaluate/evaluate-stage-gates.ts` | exact (modify in place) |
| `apps/worker/src/activities/start-promotion-run.ts` | service (activity) | CRUD | `apps/worker/src/activities/persist-run-state.ts` | role-match |
| `apps/worker/src/activities/index.ts` | config | — | `apps/worker/src/activities/index.ts` | exact |
| `apps/worker/src/activities/persist-run-state.ts` | service (activity) | CRUD | self | exact |
| `apps/worker/src/activities/record-audit-event.ts` | service (activity) | CRUD | self | exact |
| `apps/worker/src/lib/clients.ts` | utility | transform | `packages/ld-adapter/src/client/ld-api-client.ts` + `packages/telemetry/src/client/prometheus-client.ts` | partial |
| `apps/worker/src/lib/run-loader.ts` | utility | CRUD | `apps/worker/src/activities/evaluate-gate.ts` (Prisma include) | role-match |
| `apps/worker/src/lib/mappers.ts` | utility | transform | `packages/ld-adapter/src/write/semantic-patch.ts` + `packages/contracts/src/telemetry.ts` | partial |
| `apps/worker/src/workflows/promotion.workflow.ts` | hook (workflow) | event-driven | self | exact (extend) |
| `apps/worker/src/worker.ts` | config | event-driven | self | exact |
| `apps/worker/package.json` | config | — | `packages/telemetry/package.json` | partial |
| `apps/worker/src/__tests__/helpers/seed-promotion-run.ts` | test | batch | `apps/worker/src/__tests__/promotion.workflow.test.ts` | exact |
| `apps/worker/src/__tests__/helpers/nock-launchdarkly.ts` | test | request-response | `packages/ld-adapter/src/__tests__/launch-darkly-provider.test.ts` | exact |
| `apps/worker/src/__tests__/helpers/nock-prometheus.ts` | test | request-response | `packages/telemetry/src/__tests__/telemetry-integration.test.ts` | exact |
| `apps/worker/src/__tests__/run-preflight.activity.test.ts` | test | request-response | `packages/telemetry/src/__tests__/run-preflight.test.ts` | role-match |
| `apps/worker/src/__tests__/apply-stage-targeting.activity.test.ts` | test | request-response | `packages/ld-adapter/src/__tests__/apply-targeting.test.ts` | role-match |
| `apps/worker/src/__tests__/evaluate-gate.activity.test.ts` | test | request-response | `packages/db/src/__tests__/gate-result.integration.test.ts` | role-match |
| `apps/worker/src/__tests__/start-promotion-run.activity.test.ts` | test | CRUD | `packages/db/src/__tests__/promotion-run.integration.test.ts` | role-match |
| `apps/worker/src/__tests__/promotion-engine.integration.test.ts` | test | event-driven | `apps/worker/src/__tests__/promotion.workflow.test.ts` | role-match |
| `apps/worker/src/__tests__/promotion.workflow.test.ts` | test | event-driven | self | exact (modify) |
| `apps/worker/src/__tests__/promotion.signals.test.ts` | test | event-driven | self | exact (modify) |
| `packages/contracts/src/stage-targeting.ts` | model | transform | `packages/contracts/src/launchdarkly.ts` | partial |
| `packages/contracts/src/activity-inputs.ts` | model | transform | `packages/contracts/src/promotion-run.ts` | partial |
| `packages/db/src/repositories/promotion-run.repository.ts` | model | CRUD | self | exact (optional extend) |

---

## Pattern Assignments

### `apps/worker/src/activities/run-preflight.ts` (service, request-response)

**Analog:** `apps/worker/src/activities/evaluate-gate.ts` (activity shell) + `packages/telemetry/src/preflight/run-preflight.ts` (logic)

**Activity shell — env guard + db load + disconnect** (from `evaluate-gate.ts` lines 17–61):

```typescript
export async function evaluateGate(
  input: EvaluateGateInput,
): Promise<EvaluateGateResult> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for evaluateGate activity');
  }

  const db = createPrismaClient(databaseUrl);
  try {
    const run = await db.promotionRun.findUniqueOrThrow({
      where: { id: input.promotionRunId },
      include: {
        pipeline: {
          include: {
            stages: { orderBy: { orderIndex: 'asc' }, include: { gatePolicies: true } },
          },
        },
      },
    });
    // ... stage lookup by orderIndex ...
  } finally {
    await db.$disconnect();
  }
}
```

**Preflight delegation** (from `run-preflight.ts` lines 45–48, 143–148):

```typescript
export async function runPreflightChecks(
  client: PrometheusClient,
  policies: GatePolicyInput[],
  runContextInput: GateRunContext,
): Promise<PreflightReport> {
  const runContext = GateRunContextSchema.parse(runContextInput);
  // ... Prometheus sample probes ...
  return {
    status,
    checks,
    blockReason: status === 'fail' ? summarizeFailures(checks) : undefined,
  };
}
```

**Worker wiring:** Load stage gate policies from DB → map to `GateRunContext` via `lib/mappers.ts` → `createPrometheusClient` from `lib/clients.ts` → call `runPreflightChecks`. On `fail`, persist `paused` + audit (reuse `persistRunState` / `recordAuditEvent` patterns or return verdict to workflow).

---

### `apps/worker/src/activities/apply-stage-targeting.ts` (service, request-response)

**Analog:** `apps/worker/src/activities/persist-run-state.ts` + `packages/ld-adapter/src/write/apply-targeting.ts`

**Contract validation at boundary** (from `persist-run-state.ts` lines 20–25):

```typescript
  PersistRunStateInputSchema.parse({
    promotionRunId: input.promotionRunId,
    status: input.status,
    currentStageIndex: input.currentStageIndex,
    pauseReason: input.pauseReason,
  });
```

**LD applyTargeting core** (from `apply-targeting.ts` lines 76–138):

```typescript
export async function applyTargeting(
  deps: ApplyTargetingDeps,
  input: {
    projectKey: string;
    flagKey: string;
    intent: TargetingIntent;
  },
): Promise<FlagState> {
  const parsed = ApplyTargetingInputSchema.parse(input);
  const { rateLimitedClient } = deps;
  const { rawClient } = rateLimitedClient;

  const flagState = await rateLimitedClient.schedule(() =>
    getFlagState({ client: rawClient }, {
      projectKey: parsed.projectKey,
      flagKey: parsed.flagKey,
      environmentKey: parsed.intent.environmentKey,
    }),
  );
  // resolve variation/rule ids, build patch, PATCH, re-read
  return rateLimitedClient.schedule(() =>
    getFlagState({ client: rawClient }, { /* ... */ }),
  );
}
```

**Provider factory** (from `launch-darkly-provider.ts` lines 35–41):

```typescript
export function createLaunchDarklyProvider(
  config: LaunchDarklyClientConfig,
): LaunchDarklyProvider {
  const rawClient = createLaunchDarklyClient(config);
  const rateLimitedClient = createRateLimitedLdClient(rawClient);
  return new LaunchDarklyProvider(rawClient, rateLimitedClient);
}
```

**Worker wiring:** Read `pipeline.projectKey`, `run.flagKey`, stage `environment` → build `TargetingIntent` (rollout weights from stage config — new contract schema) → `provider.applyTargeting(...)`. Map LD errors (`LdAdapterError`, `ApprovalRequiredError`) to activity failure for Temporal retry.

---

### `apps/worker/src/activities/evaluate-gate.ts` (service, request-response) — MODIFY

**Analog:** `packages/telemetry/src/evaluate/evaluate-stage-gates.ts` + `packages/db/src/repositories/gate-result.repository.ts`

**Replace stub** (current lines 47–58) with real evaluation + one `GateResult` row per policy (or aggregate — follow D-11 if specified in CONTEXT):

```typescript
// packages/telemetry/src/evaluate/evaluate-stage-gates.ts lines 6–20
export async function evaluateStageGates(
  client: PrometheusClient,
  policies: GatePolicyInput[],
  runContext: GateRunContext,
): Promise<StageGateEvaluation> {
  const results = [];
  for (const policy of policies) {
    results.push(await evaluateGatePolicy(client, policy, runContext));
  }
  const verdict = results.every((result) => result.verdict === 'pass')
    ? 'pass'
    : 'fail';
  return { verdict, results };
}
```

**Persist each gate result** (from `gate-result.repository.ts` lines 10–23):

```typescript
  async create(input: GateResultCreateInput) {
    const data = GateResultCreateInputSchema.parse(input);
    return this.db.gateResult.create({
      data: {
        promotionRunId: data.promotionRunId,
        stageId: data.stageId,
        verdict: data.verdict,
        metricType: data.metricType,
        observedValue: data.observedValue,
        threshold: data.threshold,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }
```

**Audit gate_evaluated** (from `record-audit-event.ts` lines 21–23):

```typescript
  if (parsed.action === 'gate_evaluated' && !parsed.gateResultId) {
    throw new Error('gateResultId is required when action is gate_evaluated');
  }
```

Use `observedDelta` or `treatmentValue` from `GateEvaluationResult` as `observedValue`; store full result in `metadata`.

---

### `apps/worker/src/activities/start-promotion-run.ts` (service, CRUD)

**Analog:** `apps/worker/src/activities/persist-run-state.ts` + `packages/db/src/repositories/promotion-run.repository.ts`

**First active transition sets temporalWorkflowId** (from `promotion-run.repository.ts` lines 47–66):

```typescript
    const isFirstActiveTransition =
      existing.status !== 'active' && parsed.status === 'active';
    const temporalWorkflowId =
      input.temporalWorkflowId ??
      (isFirstActiveTransition && !existing.temporalWorkflowId
        ? parsed.promotionRunId
        : undefined);

    return this.db.promotionRun.update({
      where: { id: parsed.promotionRunId },
      data: {
        status: parsed.status,
        ...(temporalWorkflowId !== undefined && { temporalWorkflowId }),
      },
    });
```

**Activity responsibilities:** Validate run is `pending` → `updateState({ status: 'active' })` → return `{ promotionRunId, stageCount, flagKey, projectKey }` for workflow args. Pair with `recordAuditEvent({ action: 'run_started', ... })` in workflow (already at lines 105–111 of `promotion.workflow.ts`) or co-locate in activity if orchestrator prefers single activity.

---

### `apps/worker/src/lib/clients.ts` (utility, transform)

**Analog:** `packages/ld-adapter/src/client/ld-api-client.ts` + `packages/telemetry/src/client/prometheus-client.ts`

**LD env defaults** (from `ld-api-client.ts` lines 22–24):

```typescript
  const baseUrl = config.baseUrl ?? process.env.LD_BASE_URL ?? DEFAULT_LD_BASE_URL;
  const apiVersion = config.apiVersion ?? DEFAULT_LD_API_VERSION;
```

**Prometheus env defaults** (from `prometheus-client.ts` lines 76–82):

```typescript
  const baseUrl = (
    config.baseUrl ??
    process.env.PROMETHEUS_BASE_URL ??
    DEFAULT_PROMETHEUS_BASE_URL
  ).replace(/\/+$/, '');
  const bearerToken = config.bearerToken ?? process.env.PROMETHEUS_BEARER_TOKEN;
```

Export `getLaunchDarklyProvider()` and `getPrometheusClient()` that throw clear errors when `LD_ACCESS_TOKEN` / `PROMETHEUS_BASE_URL` missing (mirror `DATABASE_URL` guard style).

---

### `apps/worker/src/lib/run-loader.ts` (utility, CRUD)

**Analog:** `apps/worker/src/activities/evaluate-gate.ts` lines 27–45

Extract shared Prisma include into typed helper:

```typescript
const run = await db.promotionRun.findUniqueOrThrow({
  where: { id: promotionRunId },
  include: {
    pipeline: {
      include: {
        stages: { orderBy: { orderIndex: 'asc' }, include: { gatePolicies: true } },
      },
    },
  },
});
const stage = run.pipeline.stages.find((s) => s.orderIndex === stageIndex);
if (!stage) {
  throw new Error(`Stage orderIndex ${stageIndex} not found for run ${promotionRunId}`);
}
```

---

### `apps/worker/src/lib/mappers.ts` (utility, transform)

**Analog:** `packages/contracts/src/telemetry.ts` + `packages/contracts/src/launchdarkly.ts`

**GateRunContext shape** (from `telemetry.ts` lines 9–14):

```typescript
export const GateRunContextSchema = z.object({
  flagKey: z.string(),
  treatmentVariationId: z.string(),
  controlVariationId: z.string(),
  environmentKey: z.string().optional(),
});
```

**TargetingIntent shape** (from `launchdarkly.ts` lines 70–75):

```typescript
export const TargetingIntentSchema = z.object({
  environmentKey: z.string(),
  comment: z.string().optional(),
  turnOn: z.boolean().optional(),
  rollout: RolloutIntentSchema.optional(),
});
```

Phase 4 likely needs new contract fields on `Stage` or pipeline config for variation refs and rollout thousandths — add `packages/contracts/src/stage-targeting.ts` following Zod style in `pipeline.ts`.

---

### `apps/worker/src/workflows/promotion.workflow.ts` (hook, event-driven) — MODIFY

**Analog:** self — extend stage loop

**Activity proxy pattern** (lines 12–17):

```typescript
const { persistRunState, recordAuditEvent, evaluateGate } = wf.proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});
```

**Add proxied activities** with tiered timeouts:

```typescript
const { runPreflight, applyStageTargeting, startPromotionRun } = wf.proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '2 minutes',  // LD + Prom can be slow
  retry: { maximumAttempts: 3 },
});
```

**Suggested stage loop order** (insert before current `evaluateGate` at line 131):

1. `runPreflight` — on fail: pause (mirror gate fail block lines 136–147)
2. `applyStageTargeting` — LD write for stage environment
3. `evaluateGate` — real telemetry (existing call site)
4. `recordAuditEvent({ action: 'gate_evaluated', gateResultId })` after pass/fail

Keep signal handlers unchanged (`signals.ts`).

---

### `apps/worker/src/worker.ts` (config, event-driven)

**Analog:** self

**Registration pattern** (lines 14–19):

```typescript
  const worker = await Worker.create({
    connection,
    taskQueue,
    workflowsPath,
    activities,
  });
```

No change to structure; ensure `activities/index.ts` exports all new functions so `typeof activities` in workflow stays in sync.

---

### `apps/worker/src/activities/index.ts` (config)

**Analog:** self

```typescript
export { evaluateGate } from './evaluate-gate.js';
export { persistRunState } from './persist-run-state.js';
export { recordAuditEvent } from './record-audit-event.js';
```

Add exports for `runPreflight`, `applyStageTargeting`, `startPromotionRun`.

---

### `apps/worker/src/__tests__/helpers/seed-promotion-run.ts` (test, batch)

**Analog:** `apps/worker/src/__tests__/promotion.workflow.test.ts` lines 24–60

```typescript
async function seedPromotionRun(stageCount = 3) {
  const dbUrl = getTestDatabaseUrl();
  const db = createPrismaClient(dbUrl);
  const pipelineRepo = new PipelineRepository(db);
  const pipeline = await pipelineRepo.create({
    name: `workflow-test-${randomUUID()}`,
    flagKey: 'workflow-test-flag',
    projectKey: 'default',
    stages: Array.from({ length: stageCount }, (_, orderIndex) => ({
      orderIndex,
      environment: environments[orderIndex] ?? 'dev',
      gatePolicies: [{ metricType: 'error_rate', threshold: 0.01, serviceName: 'api' }],
    })),
  });
  const run = await runRepo.create({ pipelineId: pipeline.id, flagKey: 'workflow-test-flag' });
  await db.$disconnect();
  return { run, pipeline };
}
```

Extract to shared helper; add stage targeting fields when contracts land.

---

### `apps/worker/src/__tests__/helpers/nock-prometheus.ts` (test, request-response)

**Analog:** `packages/telemetry/src/__tests__/telemetry-integration.test.ts` lines 40–66, 82–98

```typescript
function replyForQuery(query: string) {
  if (query.includes('treatment-var-id') && query.includes('increase(')) {
    return loadFixture('prometheus-sample-count-high.json');
  }
  // ... route by promql substring ...
}

nock(baseUrl)
  .get('/api/v1/query')
  .query(true)
  .times(4)
  .reply(200, (uri) => ({
    status: 'success',
    data: replyForQuery(promqlFromUri(uri)),
  }));
```

Reuse fixture JSON from `packages/telemetry/src/__tests__/fixtures/` via relative import or copy minimal set into worker test fixtures.

---

### `apps/worker/src/__tests__/helpers/nock-launchdarkly.ts` (test, request-response)

**Analog:** `packages/ld-adapter/src/__tests__/launch-darkly-provider.test.ts` lines 39–57

```typescript
nock(baseUrl)
  .get('/api/v2/flags/default/sample-feature')
  .reply(200, flagFixture);

const provider = createLaunchDarklyProvider({
  accessToken: 'test-token',
  baseUrl,
});
```

For PATCH tests, mirror `apply-targeting.test.ts` GET-before-PATCH ordering (lines 55–70).

---

### `apps/worker/src/__tests__/run-preflight.activity.test.ts` (test, request-response)

**Analog:** `packages/telemetry/src/__tests__/run-preflight.test.ts` + `packages/db/src/__tests__/gate-result.integration.test.ts` harness

- `beforeAll`: `startTestDatabase()` from `packages/db/src/__tests__/setup.ts`
- `beforeEach`: `nock.cleanAll()` + prometheus helper
- Call activity directly (not through Temporal) with seeded run
- Assert `PreflightReport.status` and optional DB pause state

---

### `apps/worker/src/__tests__/evaluate-gate.activity.test.ts` (test, request-response)

**Analog:** `packages/db/src/__tests__/gate-result.integration.test.ts` + `telemetry-integration.test.ts`

After activity call, assert:

```typescript
const results = await repo.findByRunAndStage(promotionRunId, stageId);
expect(results[0].verdict).toBe('pass');
expect(results[0].metadata).toMatchObject({ /* telemetry metadata */ });
```

---

### `apps/worker/src/__tests__/promotion-engine.integration.test.ts` (test, event-driven)

**Analog:** `apps/worker/src/__tests__/promotion.workflow.test.ts` lines 62–114

**Full harness:**

```typescript
beforeAll(async () => {
  await startTestDatabase();
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
}, 120_000);

const worker = await Worker.create({
  connection: testEnv.nativeConnection,
  taskQueue: TASK_QUEUE,
  workflowsPath,
  activities,  // real activities with nock-mocked HTTP
});

await worker.runUntil(async () => {
  await testEnv.client.workflow.execute(promotionWorkflow, { /* ... */ });
});
```

Register nock for LD + Prometheus before worker run; assert gate results rows exist (not stub `metadata.stub`).

---

### `apps/worker/src/__tests__/promotion.workflow.test.ts` & `promotion.signals.test.ts` (test, event-driven) — MODIFY

**Analog:** self

Either:
- Mock `@ff-promo/telemetry` / `@ff-promo/ld-adapter` at module boundary with `vi.mock`, or
- Use nock in `beforeEach` so existing integration tests pass with real activities

Current tests assume stub `evaluateGate` always passes — update seed data with variation IDs in run context once mappers exist.

---

### `packages/contracts/src/stage-targeting.ts` (model, transform) — NEW

**Analog:** `packages/contracts/src/launchdarkly.ts` + `packages/contracts/src/pipeline.ts`

Follow Zod export pattern from `pipeline.ts` lines 5–12:

```typescript
export const GatePolicyInputSchema = z.object({
  metricType: z.string(),
  threshold: z.number(),
  serviceName: z.string(),
  // ...
});
```

Define `StageTargetingConfigSchema` with `treatmentVariationRef`, `controlVariationRef`, rollout thousandths — consumed by `lib/mappers.ts`.

---

### `packages/contracts/src/activity-inputs.ts` (model, transform) — NEW

**Analog:** `packages/contracts/src/promotion-run.ts` lines 24–29

```typescript
export const PersistRunStateInputSchema = z.object({
  promotionRunId: z.string(),
  status: PromotionStatusSchema,
  currentStageIndex: z.number().int().optional(),
  pauseReason: z.string().optional(),
});
```

Add `RunPreflightInputSchema`, `ApplyStageTargetingInputSchema`, `EvaluateGateInputSchema`, `StartPromotionRunInputSchema` for activity boundaries.

---

### `packages/db/src/repositories/promotion-run.repository.ts` (model, CRUD) — optional extend

**Analog:** self

If `startPromotionRun` needs `startedAt` timestamp, extend `updateState` data block (lines 55–67) following existing optional spread pattern. No new repository file required unless query complexity grows — prefer `findById` with include in `run-loader.ts`.

---

## Shared Patterns

### Activity lifecycle (all new/modified activities)

**Source:** `apps/worker/src/activities/persist-run-state.ts`
**Apply to:** `run-preflight.ts`, `apply-stage-targeting.ts`, `evaluate-gate.ts`, `start-promotion-run.ts`

```typescript
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for persistRunState activity');
  }

  const db = createPrismaClient(databaseUrl);
  try {
    const repo = new PromotionRunRepository(db);
    return await repo.updateState(input);
  } finally {
    await db.$disconnect();
  }
```

Each activity creates its own Prisma client per invocation (no global pool in worker yet). External clients (LD, Prometheus) can be module-level singletons in `lib/clients.ts`.

### Contract validation at activity boundary

**Source:** `apps/worker/src/activities/record-audit-event.ts` lines 19–23
**Apply to:** All activities accepting structured input

```typescript
  const parsed = AuditEventInputSchema.parse(input);

  if (parsed.action === 'gate_evaluated' && !parsed.gateResultId) {
    throw new Error('gateResultId is required when action is gate_evaluated');
  }
```

### Repository + schema layering

**Source:** `packages/db/src/repositories/gate-result.repository.ts`
**Apply to:** Any DB write from activities

Parse with `@ff-promo/contracts` Zod schema inside repository, not in activity — activities pass plain objects matching contract types.

### Temporal workflow constraints

**Source:** `apps/worker/src/workflows/promotion.workflow.ts`
**Apply to:** Workflow modifications only

- Import activities as `import type * as activities` — no runtime adapter imports in workflow code
- Use `wf.proxyActivities` for all I/O
- Use `wf.condition` for pause/resume (lines 118, 143)
- Do not import `@ff-promo/ld-adapter` or `@ff-promo/telemetry` in workflow file

### Integration test database harness (Phase 2/3 pattern)

**Source:** `packages/db/src/__tests__/setup.ts`
**Apply to:** All worker tests touching Postgres

```typescript
export async function startTestDatabase(): Promise<string> {
  if (isTestcontainersSkipped()) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("SKIP_TESTCONTAINERS=1 requires DATABASE_URL to be set");
    }
    // ...
  }
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  execSync("pnpm exec prisma migrate deploy", { cwd: packageRoot, env: process.env });
}
```

Import from `../../../../packages/db/src/__tests__/setup.js` (existing worker test path). Timeout: `120_000` on `beforeAll`.

### HTTP mock boundary (Phase 2/3 pattern)

**Source:** `packages/telemetry/src/__tests__/telemetry-integration.test.ts` + `packages/ld-adapter/src/__tests__/launch-darkly-provider.test.ts`
**Apply to:** Activity unit tests and promotion-engine integration test

- `nock.cleanAll()` in `beforeEach` / `afterEach`
- Assert `nock.isDone()` after activity completes
- No live LD or Prometheus in CI

### Audit trail milestones

**Source:** `apps/worker/src/workflows/promotion.workflow.ts` lines 123–165
**Apply to:** Workflow orchestration (not duplicated inside adapters)

| Event | Audit action |
|-------|----------------|
| Workflow start | `run_started` |
| Enter stage | `stage_entered` |
| Gate complete | `gate_evaluated` (requires `gateResultId`) |
| Advance stage | `stage_advanced` |
| Complete | `run_completed` |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/contracts/src/stage-targeting.ts` | model | transform | No stage-level LD rollout config in schema yet — new contract file |
| `apps/worker/src/lib/mappers.ts` | utility | transform | No existing DB→LD/telemetry mapping layer; compose from contracts + seed conventions |

Planner should use RESEARCH.md (when available) for rollout percentage semantics and variation ID sourcing; until then, mirror seed flag `demo-feature-flag` conventions and `RolloutIntentSchema` in `launchdarkly.ts`.

---

## Metadata

**Analog search scope:** `apps/worker/**`, `packages/db/**`, `packages/ld-adapter/**`, `packages/telemetry/**`, `packages/contracts/**`
**Files scanned:** ~40 source + test files
**Pattern extraction date:** 2026-06-22
**Note:** Phase 4 replaces Phase 1 stub in `evaluate-gate.ts` (`metadata: { stub: true }`) with real `@ff-promo/telemetry` evaluation and persists via `GateResultRepository` per Phase 3 gate-result integration tests.
