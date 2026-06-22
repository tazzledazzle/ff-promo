# Phase 4: Promotion Engine - Research

**Researched:** 2026-06-22
**Domain:** Temporal promotion workflow orchestration wiring LaunchDarkly + Prometheus adapters
**Confidence:** HIGH

## Summary

Phase 4 replaces the Phase 1 stub `evaluateGate` activity and extends `promotionWorkflow` to run real pre-flight checks, LaunchDarkly targeting writes, and Prometheus gate evaluation. The worker becomes the integration tier: activities construct `@ff-promo/ld-adapter` and `@ff-promo/telemetry` clients from env (D-20), load pipeline/run context from Postgres, persist one `GateResult` row per policy (D-12), and return aggregate pass/fail to the deterministic workflow loop. The existing FSM (pause/resume/abort, stage index in Postgres) already matches PIPE-03/04; Phase 4 inserts **preflight → apply targeting → evaluate gates** inside the stage loop without rewriting signal handlers.

**Primary recommendation:** Add three new activities (`runPreflight`, `applyStageTargeting`, real `evaluateGate`), a shared `loadRunStageContext` + `buildStageTargetingIntent` helper module, `startPromotionRun` client helper, and workflow integration tests that run **real activities** with **nock HTTP** intercepting LD + Prometheus (mirror Phase 2/3).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Stage Progression & LD Write Ordering
- **D-01:** **Gate before stage index advance** — at each stage: enter stage → apply LD targeting for **current** stage's environment → evaluate gates → increment `currentStageIndex` only when all stage policies pass (PIPE-03)
- **D-02:** **No LD write to the next environment until current stage gates pass** — advancement is index + audit milestone, not a premature cross-env write
- **D-03:** **Single gate evaluation per stage attempt** — one `evaluateStageGates` call per loop iteration; no polling timer or auto-retry interval in v1
- **D-04:** **On gate fail: pause run** — set status `paused` with `pauseReason` from telemetry metadata; operator `resume` re-enters same stage (re-apply + re-evaluate)

#### Pre-flight (TELE-04 Wiring)
- **D-05:** **Pre-flight once at workflow start** — call `runPreflightChecks` before any LD writes or stage processing
- **D-06:** **Pre-flight fail blocks promotion** — fail closed: persist run as `aborted` (or terminal non-active state), record audit event with `PreflightReport`, exit workflow without stage advancement
- **D-07:** **Pre-flight does not create GateResult rows** — audit milestone + structured metadata only; gate results remain runtime evaluations per stage

#### LaunchDarkly Integration (PROV-02/03)
- **D-08:** **New `applyStageTargeting` activity** — wraps `@ff-promo/ld-adapter` `applyTargeting` with `TargetingIntent` derived from pipeline/run + current stage environment
- **D-09:** **Resolve variation IDs per stage** — at stage entry, `getFlagState` for that stage's `environmentKey`; derive treatment/control variation `_id`s for `GateRunContext` (PROV-03)
- **D-10:** **LD writes via existing semantic patch path only** — no LaunchDarkly server SDK; reuse rate-limited client from Phase 2

#### Telemetry Gate Evaluation
- **D-11:** **Replace stub `evaluateGate`** — activity loads stage `GatePolicy[]`, builds `GateRunContext`, calls `evaluateStageGates` from `@ff-promo/telemetry`
- **D-12:** **Persist one `GateResult` per policy** — each `GateEvaluationResult` → `GateResultRepository.create`; stage activity returns aggregate pass/fail
- **D-13:** **Gate forensics in metadata** — store `treatmentValue`, `controlValue`, `observedDelta`, `metadata.reason` in GateResult + audit `gate_evaluated` events (extends D-03 Phase 1)
- **D-14:** **Fail closed inherits Phase 3** — empty data, insufficient samples, prometheus errors → stage fail → pause (no advancement)

#### Starting Runs (PIPE-02)
- **D-15:** **Worker-side start mechanism only** — `startPromotionRun` helper (Temporal client + DB) transitions `pending` → `active` and starts `promotionWorkflow`; usable from worker integration tests and a documented dev script
- **D-16:** **No REST/CLI user-facing start in Phase 4** — Phase 5 exposes API-01; Phase 4 proves engine via worker tests

#### Emergency Stop (SAFE-02)
- **D-17:** **Immediate abort via existing `abortSignal`** — workflow breaks stage loop, persists `aborted`, records `run_aborted` audit; no further LD writes after abort observed
- **D-18:** **Abort helper for tests** — Temporal test client sends `abortSignal`; REST/dashboard abort deferred to Phase 5/6

#### Activity Architecture
- **D-19:** **New activities:** `runPreflight`, `applyStageTargeting`, real `evaluateGate`; keep `persistRunState` + `recordAuditEvent`
- **D-20:** **Env/config at activity boundary** — activities construct LD/telemetry clients with factory + env fallback; workflow code stays deterministic (no `process.env` in workflow)
- **D-21:** **Workflow remains orchestration-only** — no direct adapter imports in `promotion.workflow.ts`; extend loop for preflight + apply targeting steps

### Claude's Discretion
- Exact `TargetingIntent` / rollout percentage for v1 environment stages (e.g., 100% to stage env vs seed canary intent)
- Terminal status for pre-flight fail (`aborted` vs `pending` with reason)
- `startPromotionRun` packaging (npm script name, whether bundled as exported activity vs standalone module)
- Whether `gatePassed`/`gateFailed` signals stay unused in v1 (activity return is source of truth) or get wired for future external gate injection
- Integration test strategy: nock both LD + Prometheus at activity layer vs workflow-level with mocked activities

### Deferred Ideas (OUT OF SCOPE)
- **Sub-stage rollouts (PIPE-05/06)** — v2; v1 is environment-per-stage only
- **Soak timers between stages (TELE-06)** — not in v1
- **Slack/PagerDuty alerting (TELE-05)** — Phase 5+ monitoring
- **REST/CLI start and control (API-01, API-04)** — Phase 5
- **Dashboard abort button (UI-03)** — Phase 6; SAFE-02 signal wiring starts in Phase 4
- **Automatic gate polling / auto-resume after telemetry recovers** — conflicts with pause-and-alert; manual resume only
- **Automatic rollback on gate fail** — explicitly out of scope per PROJECT.md
- **External gate injection via gatePassed/gateFailed signals** — optional future; activity evaluation is v1 source of truth
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-02 | Developer can start a promotion run for a flag through the defined pipeline | `startPromotionRun` helper: load pending run + pipeline stage count, `PromotionRunRepository.updateState` pending→active, `client.workflow.start(promotionWorkflow, { workflowId: run.id, args })` [CITED: docs.temporal.io/develop/typescript/set-up-your-local-typescript] |
| PIPE-03 | System advances flag to next environment only when telemetry gates pass for current stage | Workflow loop order: `applyStageTargeting` → `evaluateGate` → increment index only on pass (D-01/D-02); LD write scoped to `stage.environment` |
| PIPE-04 | System blocks advancement when telemetry gates fail | Existing pause loop + D-04: persist `paused` with `pauseReason` from first failing policy; resume re-enters same stage index |
| SAFE-02 | Operator can emergency-stop an in-flight promotion immediately | Existing `abortSignal` handler + loop `hasAborted()` checks before/after pause; extend tests with abort during stage processing |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **LaunchDarkly REST only** — use `launchdarkly-api` semantic patch via `@ff-promo/ld-adapter`; never `@launchdarkly/node-server-sdk` for orchestration
- **Telemetry v1** — error rate + latency SLO gates via Prometheus only; fail-closed pause-and-alert (no auto-rollback)
- **Dual source of truth** — Postgres `PromotionRun` canonical; Temporal holds execution/signals
- **Four surfaces deferred** — Phase 4 is worker-only start (no REST/CLI/dashboard)
- **Environment progression** — dev → staging → prod per stage; sub-stage rollouts (canary/stagger) deferred to v2
- **Monorepo stack** — TypeScript 5.8, Temporal `@temporalio/*` 1.18.1, Vitest 4.1.9, pnpm workspaces

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stage loop orchestration | Temporal workflow (`apps/worker`) | — | Deterministic FSM; no I/O in workflow code (D-21) |
| LD targeting writes | Worker activity → `@ff-promo/ld-adapter` | — | Side effects + retries belong in activities (D-08/D-10) |
| Prometheus gate evaluation | Worker activity → `@ff-promo/telemetry` | — | Network I/O, fail-closed logic already in adapter (D-11/D-14) |
| GateResult / run state persistence | Worker activity → `@ff-promo/db` | — | Canonical Postgres state (D-07 Phase 1) |
| Variation ID resolution | Worker activity (calls ld-adapter `getFlagState` + `resolveVariationId`) | ld-adapter pure resolver | PROV-03 resolution before writes and gate context (D-09) |
| Start promotion run | Worker lib module (`startPromotionRun`) | Temporal client | PIPE-02 worker-side only until Phase 5 API (D-15/D-16) |
| Emergency abort | Temporal workflow signal handler | Postgres audit | SAFE-02; signal already wired Phase 1 (D-17) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@temporalio/workflow` | 1.18.1 | Workflow FSM, signals, `proxyActivities` | Already in worker; durable orchestration for multi-stage promotion [VERIFIED: npm registry] |
| `@temporalio/worker` | 1.18.1 | Activity execution | Phase 1 skeleton; register new activities [VERIFIED: npm registry] |
| `@temporalio/client` | 1.18.1 | `startPromotionRun` workflow start + test signals | Standard Temporal client pattern [CITED: docs.temporal.io/develop/typescript/set-up-your-local-typescript] |
| `@temporalio/testing` | 1.18.1 | `TestWorkflowEnvironment`, time-skipping tests | Existing `promotion.workflow.test.ts` pattern [VERIFIED: codebase] |
| `@ff-promo/ld-adapter` | workspace | `createLaunchDarklyProvider`, `applyTargeting`, `getFlagState` | Phase 2 complete; semantic patch + rate limit [VERIFIED: codebase] |
| `@ff-promo/telemetry` | workspace | `createPrometheusClient`, `evaluateStageGates`, `runPreflightChecks` | Phase 3 complete; fail-closed gates [VERIFIED: codebase] |
| `@ff-promo/db` | workspace | Repositories for run, gate results, audit | Phase 1 persistence layer [VERIFIED: codebase] |
| `@ff-promo/contracts` | workspace | `GateRunContext`, `TargetingIntent`, `GatePolicyInput` | Shared schemas across worker + adapters [VERIFIED: codebase] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nock` | 14.0.15 | HTTP mock for LD fetch + Prometheus query in worker tests | Worker integration tests (mirror telemetry/ld-adapter) [VERIFIED: npm registry] |
| `testcontainers` | latest (root) | Postgres for workflow integration tests | Already in `packages/db/src/__tests__/setup.ts` [VERIFIED: codebase] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Real activities + nock HTTP | Mock activities in workflow tests | Mocks skip adapter integration; rejected for Phase 4 |
| Workflow-level gate polling | Single `evaluateStageGates` per attempt | Locked out by D-03; pause-and-alert requires manual resume |
| `@launchdarkly/node-server-sdk` | REST semantic patch | Forbidden by CLAUDE.md / STACK.md |

**Installation:**

```bash
pnpm --filter @ff-promo/worker add @ff-promo/ld-adapter@workspace:* @ff-promo/telemetry@workspace:*
pnpm --filter @ff-promo/worker add -D nock@14.0.15
```

**Version verification:**

```bash
npm view @temporalio/worker@1.18.1 version  # 1.18.1
npm view nock version                       # 14.0.15
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `nock` | npm | mature | high | github.com/nock/nock | [OK] | Approved — pin 14.0.15 (matches telemetry/ld-adapter) |
| `@ff-promo/ld-adapter` | workspace | — | — | monorepo | n/a | Approved — internal |
| `@ff-promo/telemetry` | workspace | — | — | monorepo | n/a | Approved — internal |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                    startPromotionRun (PIPE-02)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Temporal: promotionWorkflow (deterministic)                 │
│  ┌──────────────┐                                            │
│  │ runPreflight │──fail──► persist aborted + audit ──► EXIT  │
│  └──────┬───────┘                                            │
│         │ pass                                               │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ while stageIndex < stageCount:                        │   │
│  │   abort? ──yes──► break                               │   │
│  │   pause? ──wait──► resume or abort                    │   │
│  │   stage_entered (audit)                               │   │
│  │   applyStageTargeting ──► LD semantic patch (env N)   │   │
│  │   evaluateGate ──► Prometheus queries + GateResults   │   │
│  │   fail? ──yes──► paused + pauseReason ──wait──► retry │   │
│  │   pass? ──yes──► increment index + stage_advanced     │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  completed (or aborted if signal received)                   │
└─────────────────────────────────────────────────────────────┘
         │ activities only ▼
┌────────────────┐  ┌─────────────────┐  ┌──────────────┐
│ @ff-promo/db   │  │ @ff-promo/      │  │ @ff-promo/   │
│ Postgres       │  │ ld-adapter      │  │ telemetry    │
└────────────────┘  └─────────────────┘  └──────────────┘
```

### Recommended Project Structure

```
apps/worker/src/
├── activities/
│   ├── index.ts
│   ├── persist-run-state.ts      # unchanged
│   ├── record-audit-event.ts     # unchanged
│   ├── run-preflight.ts          # NEW — TELE-04 wiring
│   ├── apply-stage-targeting.ts  # NEW — PROV-02/03
│   └── evaluate-gate.ts          # REPLACE stub
├── lib/
│   ├── clients.ts                # createLdProvider(), createTelemetryClient()
│   ├── load-run-context.ts       # shared DB load for run/pipeline/stage
│   ├── stage-targeting.ts        # buildTargetingIntent(), buildGateRunContext()
│   └── start-promotion-run.ts    # PIPE-02 helper
├── workflows/
│   ├── promotion.workflow.ts     # extend loop (preflight + targeting)
│   └── signals.ts                # unchanged; gatePassed/gateFailed unused v1
└── __tests__/
    ├── promotion.workflow.test.ts
    ├── promotion.signals.test.ts
    ├── activities/               # unit tests with nock
    └── fixtures/                 # LD flag + Prometheus JSON (reuse/adapt Phase 2/3)
```

### Pattern 1: Activity Client Factories (D-20)

**What:** Centralize env-backed client construction in `lib/clients.ts`; activities import factories, never pass secrets through workflow args.

**When to use:** Every activity that touches LD or Prometheus.

**Example:**

```typescript
// apps/worker/src/lib/clients.ts
import { createLaunchDarklyProvider } from '@ff-promo/ld-adapter';
import { createPrometheusClient } from '@ff-promo/telemetry';

export function createLdProvider() {
  const accessToken = process.env.LD_ACCESS_TOKEN;
  if (!accessToken) throw new Error('LD_ACCESS_TOKEN is required');
  return createLaunchDarklyProvider({
    accessToken,
    baseUrl: process.env.LD_BASE_URL,
    apiVersion: process.env.LD_API_VERSION ?? '20240415',
  });
}

export function createTelemetryClient() {
  return createPrometheusClient({
    baseUrl: process.env.PROMETHEUS_BASE_URL,
    bearerToken: process.env.PROMETHEUS_BEARER_TOKEN,
  });
}
```

// Source: `.env.example`, Phase 3 `createPrometheusClient` pattern [VERIFIED: codebase]

### Pattern 2: proxyActivities with Tiered Timeouts

**What:** Extend `promotion.workflow.ts` to proxy new activities; LD + Prometheus may need longer than persist.

**When to use:** All side-effect activities.

**Example:**

```typescript
const { persistRunState, recordAuditEvent } = wf.proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

const { runPreflight, applyStageTargeting, evaluateGate } = wf.proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 3 },
});
```

// Source: Temporal TypeScript SDK — activities handle external I/O [CITED: docs.temporal.io/develop/typescript/set-up-your-local-typescript]

### Pattern 3: GateRunContext + TargetingIntent Resolution (D-09)

**What:** At stage entry, `getFlagState` for `stage.environment`, resolve boolean treatment/control variation IDs, build shared context for targeting + gates.

**When to use:** `applyStageTargeting` and `evaluateGate` for the same stage attempt.

**Example:**

```typescript
// apps/worker/src/lib/stage-targeting.ts
import type { GateRunContext, TargetingIntent } from '@ff-promo/contracts';
import type { FlagState } from '@ff-promo/contracts';
import { resolveVariationId } from '@ff-promo/ld-adapter';

const TREATMENT_REF = { by: 'value' as const, value: true };
const CONTROL_REF = { by: 'value' as const, value: false };

export function buildGateRunContext(
  flagKey: string,
  environmentKey: string,
  flagState: FlagState,
): GateRunContext {
  return {
    flagKey,
    environmentKey,
    treatmentVariationId: resolveVariationId(flagState, TREATMENT_REF),
    controlVariationId: resolveVariationId(flagState, CONTROL_REF),
  };
}

export function buildStageTargetingIntent(
  environmentKey: string,
  runId: string,
  stageName: string,
): TargetingIntent {
  return {
    environmentKey,
    turnOn: true,
    comment: `ff-promo run ${runId}: ${stageName}`,
    rollout: {
      mode: 'fallthrough',
      treatmentVariationRef: TREATMENT_REF,
      controlVariationRef: CONTROL_REF,
      treatmentPercentThousandths: 50_000, // 50/50 — both cohorts required for delta gates
      rolloutContextKind: 'user',
      rolloutBucketBy: 'key',
    },
  };
}
```

**Rationale (discretion resolved):** v1 environment stages use **turnOn + 50/50 fallthrough rollout** — not 100% treatment — because Phase 3 delta gates require treatment AND control samples (fail-closed on insufficient control). Sub-stage percentage progression deferred to PIPE-05/06.

**Environment key contract:** `Stage.environment` (`dev`|`staging`|`prod` per seed) is used directly as LD `environmentKey`. LD projects must define matching environment keys; test fixtures must use the same keys as seeded pipelines.

### Pattern 4: evaluateGate Persistence (D-12/D-13)

**What:** Call `evaluateStageGates`, persist one `GateResult` per policy, emit `gate_evaluated` audit per result, return aggregate verdict + pauseReason.

**Example:**

```typescript
const evaluation = await evaluateStageGates(prometheus, policies, runContext);
const gateResultIds: string[] = [];

for (const result of evaluation.results) {
  const row = await gateResultRepo.create({
    promotionRunId,
    stageId: stage.id,
    verdict: result.verdict,
    metricType: result.metricType,
    threshold: result.threshold,
    observedValue: result.observedDelta ?? result.treatmentValue,
    metadata: {
      treatmentValue: result.treatmentValue,
      controlValue: result.controlValue,
      observedDelta: result.observedDelta,
      reason: result.metadata.reason,
      environmentKey: stage.environment,
      flagKey: run.flagKey,
    },
  });
  gateResultIds.push(row.id);
  await auditRepo.append({
    promotionRunId,
    action: 'gate_evaluated',
    actorType: 'system',
    actorId: 'evaluateGate',
    gateResultId: row.id,
    metadata: { stageIndex, ...result.metadata },
  });
}

const firstFail = evaluation.results.find((r) => r.verdict === 'fail');
return {
  verdict: evaluation.verdict,
  gateResultIds,
  primaryGateResultId: gateResultIds.at(-1)!,
  pauseReason: firstFail
    ? `${firstFail.metricType}: ${firstFail.metadata.reason ?? 'fail'}`
    : undefined,
};
```

### Pattern 5: Pre-flight Abort Flow (D-05/D-06/D-07)

**What:** First workflow activity after initial `persistRunState(active)`; on fail, terminal abort without LD writes or GateResult rows.

**Workflow sequence:**

```typescript
const preflight = await runPreflight({ promotionRunId: input.promotionRunId });
if (preflight.status === 'fail') {
  await persistRunState({
    promotionRunId: input.promotionRunId,
    status: 'aborted',
    pauseReason: preflight.blockReason,
  });
  await recordAuditEvent({
    promotionRunId: input.promotionRunId,
    action: 'run_aborted',
    actorType: 'system',
    actorId: 'preflight',
    metadata: { cause: 'preflight_failed', preflightReport: preflight },
  });
  return;
}
await recordAuditEvent({ action: 'run_started', ... });
```

**Discretion resolved:** Use status **`aborted`** (not `pending`) with `pauseReason = preflight.blockReason` — clearly terminal, distinguishable via audit metadata `cause: 'preflight_failed'`.

**Preflight policies scope:** Flatten gate policies from **all stages** (max `minSampleSize` drives preflight); `GateRunContext` from **first stage** environment (orderIndex 0).

### Pattern 6: startPromotionRun (D-15)

**What:** Exported helper in `apps/worker/src/lib/start-promotion-run.ts` — not an activity.

```typescript
import { Client, Connection } from '@temporalio/client';
import { createPrismaClient, PromotionRunRepository } from '@ff-promo/db';
import { promotionWorkflow } from '../workflows/promotion.workflow.js';

export async function startPromotionRun(
  promotionRunId: string,
  actor: { actorType: 'user' | 'system' | 'api_key'; actorId: string; displayName?: string },
) {
  const db = createPrismaClient(process.env.DATABASE_URL!);
  const run = await db.promotionRun.findUniqueOrThrow({
    where: { id: promotionRunId },
    include: { pipeline: { include: { stages: true } } },
  });
  if (run.status !== 'pending') throw new Error(`Run ${promotionRunId} is not pending`);

  const repo = new PromotionRunRepository(db);
  await repo.updateState({ promotionRunId, status: 'active', temporalWorkflowId: promotionRunId });

  const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233' });
  const client = new Client({ connection });
  await client.workflow.start(promotionWorkflow, {
    taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? 'promotion',
    workflowId: promotionRunId,
    args: [{ promotionRunId, stageCount: run.pipeline.stages.length, actor }],
  });
  await connection.close();
}
```

**Discretion resolved:** Module export + npm script `pnpm --filter @ff-promo/worker start-run -- <runId>` via thin `scripts/start-promotion-run.ts` CLI (tsx). Phase 5 API imports same helper.

### Pattern 7: Workflow Gate Fail with pauseReason (D-04)

**What:** Replace stub fail branch to persist `pauseReason` from activity.

```typescript
if (gateResult.verdict === 'fail') {
  isPaused = true;
  status = 'paused';
  await persistRunState({
    promotionRunId: input.promotionRunId,
    status: 'paused',
    pauseReason: gateResult.pauseReason,
  });
  await recordAuditEvent({
    promotionRunId: input.promotionRunId,
    action: 'run_paused',
    actorType: 'system',
    actorId: 'gate_fail',
    metadata: { stageIndex: currentStageIndex, pauseReason: gateResult.pauseReason },
  });
  await wf.condition(() => !isPaused || hasAborted());
  if (hasAborted()) break;
  continue; // re-apply targeting + re-evaluate same stage
}
```

**Discretion resolved:** `gatePassed` / `gateFailed` signals **remain registered but unused** in v1 — activity return drives pause; signals reserved for future external gate injection (deferred in CONTEXT.md).

### Anti-Patterns to Avoid

- **Importing ld-adapter/telemetry in workflow file:** Breaks determinism sandbox; violates D-21
- **100% treatment rollout in v1:** Zero control cohort → preflight/gate fail-closed
- **Mock activities in workflow integration tests:** Hides adapter wiring bugs; use nock on HTTP instead
- **Single GateResult for multi-policy stage:** Violates D-12
- **Pre-flight GateResult rows:** Violates D-07

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LD semantic patch | Custom PATCH builder in worker | `@ff-promo/ld-adapter` `applyTargeting` | Rate limits, GET-before-write, instruction validation |
| PromQL / gate math | Worker PromQL strings | `@ff-promo/telemetry` `evaluateStageGates` | Fail-closed parser, delta-vs-control, sample floors |
| Variation ID lookup | String parsing LD JSON | `resolveVariationId` from ld-adapter | UnresolvedVariationError, multi-match guard |
| Temporal client bootstrap | Ad-hoc workflow start | `@temporalio/client` Connection + Client | Standard retry/namespace/task queue semantics |
| Gate result schema validation | Inline objects | `GateResultCreateInputSchema` | Contract consistency with Phase 1 repos |

**Key insight:** Worker activities are thin orchestration glue; adapters and repos own domain logic.

## Common Pitfalls

### Pitfall 1: LD Environment Key Mismatch

**What goes wrong:** Pipeline `Stage.environment` is `dev` but LD project uses `development` or `production`.

**Why it happens:** Seed uses short names; LD fixtures in Phase 2 use `production`/`staging`.

**How to avoid:** Document that pipeline stage environments MUST match LD environment keys; align test nock fixtures to `dev`/`staging`/`prod` used in worker test seeds.

**Warning signs:** `getFlagState` 404 or empty environment in PATCH body.

### Pitfall 2: Abort After Partial Stage

**What goes wrong:** LD write completes, abort signal arrives, workflow exits but flag left on in environment.

**Why it happens:** Abort is immediate; no rollback (by design per PROJECT.md).

**How to avoid:** Check `hasAborted()` before `applyStageTargeting`; document operator manual rollback in Phase 5+. Test abort before targeting call.

**Warning signs:** `run_aborted` audit without subsequent `applyStageTargeting` in history for current stage.

### Pitfall 3: Activity Retry Double-Writes

**What goes wrong:** Temporal retries `applyStageTargeting` after timeout; duplicate semantic patches.

**Why it happens:** LD PATCH is not idempotent by default.

**How to avoid:** Semantic patch with same intent is effectively idempotent for same weights; keep `startToCloseTimeout` generous (2m); log patch comments with run+stage id.

**Warning signs:** Multiple identical LD audit entries for same stage attempt.

### Pitfall 4: Missing pauseReason on Gate Fail

**What goes wrong:** Operator sees `paused` with null `pauseReason` in DB.

**Why it happens:** Current workflow stub omits `pauseReason` on gate fail path (lines 136–142 in `promotion.workflow.ts`).

**How to avoid:** Wire D-04 in workflow fail branch from activity return.

**Warning signs:** Integration test assertion on `pauseReason` fails.

### Pitfall 5: Workflow stageCount Drift

**What goes wrong:** `PromotionWorkflowInput.stageCount` differs from pipeline stage count in DB.

**Why it happens:** Hardcoded test args vs dynamic pipeline.

**How to avoid:** `startPromotionRun` always passes `run.pipeline.stages.length`; tests derive from seeded pipeline.

**Warning signs:** Loop exits early or IndexError in activity stage lookup.

## Code Examples

### Temporal Test: Abort During Promotion (SAFE-02)

```typescript
// Extend promotion.signals.test.ts pattern
await handle.signal(abortSignal);
await handle.result();
const updated = await db.promotionRun.findUnique({ where: { id: run.id } });
expect(updated?.status).toBe('aborted');
```

// Source: existing `promotion.signals.test.ts` [VERIFIED: codebase]

### Nock at Activity Layer (Integration Test Strategy — Resolved)

```typescript
import nock from 'nock';

beforeEach(() => {
  nock.cleanAll();
  nock(process.env.LD_BASE_URL ?? 'https://app.launchdarkly.com')
    .persist()
    .get(/\/api\/v2\/flags\//)
    .reply(200, flagFixture);
  nock(process.env.PROMETHEUS_BASE_URL ?? 'http://localhost:9090')
    .persist()
    .get('/api/v1/query')
    .query(true)
    .reply(200, (uri) => promReplyForQuery(promqlFromUri(uri)));
});

// Worker runs REAL activities — no activity mocks
const worker = await Worker.create({ workflowsPath, activities, ... });
```

**Discretion resolved:** **Real activities + HTTP nock** (not mocked activities). Unit-test individual activities separately; workflow tests validate full orchestration path. Reuse query-routing pattern from `packages/telemetry/src/__tests__/telemetry-integration.test.ts`.

### Gate Policy Mapping (Prisma → Contract)

```typescript
function toGatePolicyInput(policy: GatePolicy): GatePolicyInput {
  return {
    metricType: policy.metricType,
    threshold: policy.threshold,
    serviceName: policy.serviceName,
    comparisonMode: policy.comparisonMode,
    windowSeconds: policy.windowSeconds,
    minSampleSize: policy.minSampleSize,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stub `evaluateGate` always pass | Real telemetry + multi-policy persistence | Phase 4 | PIPE-03/04 satisfied |
| Workflow evaluates before LD write | apply targeting then evaluate | Phase 4 D-01 | Gates reflect post-targeting state |
| No preflight in workflow | `runPreflight` at start | Phase 4 D-05 | TELE-04 wired to engine |

**Deprecated/outdated:**

- Phase 1 stub metadata `{ stub: true }` on GateResult — remove when replacing evaluateGate

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Boolean flag variations resolve via `{ by: 'value', value: true/false }` | TargetingIntent | Non-boolean flags need variation naming convention in Phase 7 |
| A2 | `Stage.environment` strings match LD environment keys exactly | GateRunContext | Requires mapping table or pipeline config fix |
| A3 | 50/50 rollout is acceptable v1 staging intent | TargetingIntent | Platform may want 100% env enable with separate control — conflicts with delta gates |
| A4 | `run_aborted` audit with `cause: 'preflight_failed'` is sufficient forensics | Pre-flight | May need dedicated audit action later |

## Open Questions

All discretion items from CONTEXT.md are **resolved in this research**:

1. **TargetingIntent for v1** → `turnOn: true` + 50/50 fallthrough rollout, `user` context kind (Pattern 3)
2. **Pre-flight terminal status** → `aborted` + `pauseReason` + audit metadata `cause: 'preflight_failed'`
3. **startPromotionRun packaging** → `lib/start-promotion-run.ts` + `pnpm --filter @ff-promo/worker start-run`
4. **gatePassed/gateFailed signals** → unused in v1; activity return is source of truth
5. **Integration test strategy** → real activities, nock LD + Prometheus HTTP at network layer

**No unresolved blockers for planning.**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | worker build | ✓ | 24.x assumed | — |
| PostgreSQL | activities + tests | ✓ via testcontainers | PG 16 | testcontainers auto-start in tests |
| Temporal dev server | workflow integration tests | ✓ via TestWorkflowEnvironment | SDK 1.18.1 embedded | No external Temporal required in CI |
| Temporal CLI | local dev manual | ✗ not verified | — | Docker Compose `temporal server start-dev` per Phase 1 |
| LD_ACCESS_TOKEN | applyStageTargeting | ✗ env-dependent | — | nock in tests; required for manual e2e |
| PROMETHEUS_BASE_URL | evaluateGate/preflight | ✓ default localhost:9090 | — | nock in tests |

**Missing dependencies with no fallback:**

- None for CI (testcontainers + TestWorkflowEnvironment + nock)

**Missing dependencies with fallback:**

- LD_ACCESS_TOKEN — nock HTTP mocks in tests; `.env` for manual runs

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` (project: `worker`) |
| Quick run command | `pnpm --filter @ff-promo/worker test` |
| Full suite command | `pnpm -w exec vitest run --project worker` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-02 | Start pending run → workflow executes | integration | `pnpm -w exec vitest run --project worker -t "startPromotionRun"` | ❌ Wave 0 |
| PIPE-03 | Advances only after gate pass | integration | `pnpm -w exec vitest run --project worker -t "advances stage"` | ❌ Wave 0 |
| PIPE-04 | Gate fail pauses with pauseReason | integration | `pnpm -w exec vitest run --project worker -t "gate fail pauses"` | ❌ Wave 0 |
| SAFE-02 | Abort stops workflow immediately | integration | `pnpm -w exec vitest run --project worker promotion.signals` | ✅ partial |
| D-05/D-06 | Preflight fail aborts without GateResult | integration | `pnpm -w exec vitest run --project worker -t "preflight fail"` | ❌ Wave 0 |
| D-12 | One GateResult per policy | integration | `pnpm -w exec vitest run --project worker -t "gate results persisted"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @ff-promo/worker test`
- **Per wave merge:** `pnpm -w exec vitest run --project worker`
- **Phase gate:** Full worker suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/worker/src/lib/clients.ts` — shared factories
- [ ] `apps/worker/src/lib/load-run-context.ts` — DRY for activities
- [ ] `apps/worker/src/lib/stage-targeting.ts` — TargetingIntent + GateRunContext
- [ ] `apps/worker/src/lib/start-promotion-run.ts` — PIPE-02
- [ ] `apps/worker/src/activities/run-preflight.ts`
- [ ] `apps/worker/src/activities/apply-stage-targeting.ts`
- [ ] `apps/worker/src/__tests__/fixtures/` — LD + Prometheus JSON
- [ ] `apps/worker/package.json` — add `@ff-promo/ld-adapter`, `@ff-promo/telemetry`, devDep `nock`
- [ ] Update `evaluate-gate.ts` — replace stub
- [ ] Update `promotion.workflow.ts` — preflight + targeting + pauseReason

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 5 API auth |
| V3 Session Management | no | — |
| V4 Access Control | partial | Worker uses env secrets; no multi-tenant RBAC in Phase 4 |
| V5 Input Validation | yes | Zod schemas on persist/audit; adapter input schemas on LD/telemetry |
| V6 Cryptography | no | TLS via fetch defaults; tokens in env not logged |

### Known Threat Patterns for Worker + Adapters

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LD token exfiltration via logs | Information disclosure | Never log `LD_ACCESS_TOKEN`; throw generic errors in workflow |
| Prometheus SSRF | Tampering | `createPrometheusClient` validates http/https baseUrl only [VERIFIED: codebase] |
| SQL injection | Tampering | Prisma parameterized queries via repositories |
| Audit metadata injection | Tampering | `AuditEventInputSchema` + structured metadata from typed adapter results |

## Sources

### Primary (HIGH confidence)

- Codebase: `apps/worker/src/workflows/promotion.workflow.ts`, activities, Phase 2/3 packages
- `.planning/phases/04-promotion-engine/04-CONTEXT.md` — locked decisions D-01–D-21
- `.planning/ROADMAP.md` — Phase 4 goal and success criteria
- `.planning/REQUIREMENTS.md` — PIPE-02, PIPE-03, PIPE-04, SAFE-02
- [Temporal TypeScript SDK setup](https://docs.temporal.io/develop/typescript/set-up-your-local-typescript) — workflow/activity/worker/client patterns
- npm registry: `@temporalio/worker@1.18.1`, `nock@14.0.15`

### Secondary (MEDIUM confidence)

- [Temporal TypeScript Worker API](https://typescript.temporal.io/api/classes/worker.Worker) — `runUntil`, activity execution model

### Tertiary (LOW confidence)

- None material — core patterns verified against codebase and Temporal docs

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — builds on completed Phase 1–3 packages with verified versions
- Architecture: HIGH — extends existing workflow FSM; locked decisions constrain design space
- Pitfalls: MEDIUM — LD environment key alignment needs validation in implementation spike

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (30 days — stable Temporal/adapter stack)
