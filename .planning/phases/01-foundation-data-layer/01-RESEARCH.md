# Phase 1: Foundation & Data Layer - Research

**Researched:** 2026-06-20
**Domain:** TypeScript monorepo bootstrap, Prisma/PostgreSQL domain persistence, append-only audit, Temporal workflow skeleton
**Confidence:** HIGH

## Summary

Phase 1 establishes the durable foundation every later phase depends on: a pnpm + Turborepo monorepo with `packages/db` (Prisma 7 + PostgreSQL 16), `packages/contracts` (shared Zod types), and scaffolded `apps/*` shells; an append-only audit trail satisfying SAFE-01; and a Temporal promotion workflow skeleton with pre-wired signals and stub activities. This is a greenfield bootstrap — no application code exists yet.

The critical architectural decision (D-07) is **dual source of truth**: `PromotionRun` in PostgreSQL is canonical for business state (status, current stage, flag key, pipeline version snapshot); Temporal holds execution mechanics (durable timers, signal delivery, replay). The workflow ID should equal `PromotionRun.id` so API/worker can correlate without a mapping table. Activities (`persistRunState`, `recordAuditEvent`, `evaluateGate`) are the only bridge — workflow code must never import Prisma directly (Temporal sandbox isolation).

Prisma 7.8.0 introduces breaking changes from Prisma 5/6: `prisma.config.ts` is required, `PrismaClient` must use a driver adapter (`@prisma/adapter-pg`), and seeding is explicit-only via `prisma db seed` (no auto-seed on `migrate reset`). The planner must account for these in Wave 0.

**Primary recommendation:** Bootstrap the full monorepo scaffold first, then implement `packages/db` schema + repositories + seed, then wire `apps/worker` with a stage-loop FSM workflow using `defineSignal` + `workflow.condition`, stub activities writing to Postgres, and integration tests via Vitest + `@testcontainers/postgresql`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pipeline/Stage/GatePolicy definitions | Database / Storage (`packages/db`) | API (Phase 5) | Normalized relational config is system of record; API is a thin CRUD layer later |
| PromotionRun business state | Database / Storage (`packages/db`) | Worker activities | Postgres is canonical per D-07; activities persist state on transitions |
| GateResult history | Database / Storage (`packages/db`) | Worker activities | Queryable per run/stage; referenced by audit milestones |
| Append-only audit trail | Database / Storage (`packages/db`) | Worker activities | Milestone events written at stage transitions and operator actions |
| Workflow execution (timers, signals) | Worker (`apps/worker` / Temporal) | API client (Phase 5) | Temporal owns durable execution; API sends signals later |
| Domain type contracts | Shared package (`packages/contracts`) | All apps | Zod schemas shared across worker, API, CLI, dashboard |
| Monorepo build/test orchestration | Root (Turborepo) | CI (later) | Caches build/test across packages |
| Integration test DB | Test harness (Vitest + testcontainers) | `packages/db` | Spins ephemeral Postgres; runs migrations per suite |
| Seed/demo data | `packages/db/prisma/seed.ts` | Docker Compose env | Local dev and demo pipeline (dev → staging → prod) |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Audit Event Schema
- **D-01:** Log milestones only — stage transitions, operator actions, and gate pass/fail verdicts (not every reconciler tick)
- **D-02:** Structured actor identity — `actorType` (user | system | api_key) + `actorId` + optional `displayName`
- **D-03:** Gate forensics in JSON metadata column — metric values, thresholds, LD flag key, environment, stage context
- **D-04:** Retain audit events forever in v1 — append-only, no TTL or archival

#### Domain Model Scope
- **D-05:** Full core schema in Phase 1 — `PipelineDefinition`, `PromotionRun`, `GateResult`, `AuditEvent` tables from day one
- **D-06:** Normalized relational pipeline storage — `Pipeline` → `Stage` (env order) → `GatePolicy` per stage as separate rows
- **D-07:** Dual source of truth for run state — `PromotionRun` in Postgres is canonical; Temporal holds workflow execution state (signals, timers)
- **D-08:** Separate `GateResult` table — queryable history per run/stage; audit milestone entries reference result IDs

#### Temporal Skeleton Depth
- **D-09:** Pre-wired FSM skeleton — workflow with environment stage states, pause/resume/abort signal handlers, stub activities
- **D-10:** Standard signals defined in Phase 1 — `pause`, `resume`, `abort`, `gatePassed`, `gateFailed`
- **D-11:** Stub activities only — `persistRunState`, `recordAuditEvent`, `evaluateGate` (returns mock pass for local dev)
- **D-12:** Local dev via Docker Compose — Postgres + Temporal dev server in `docker-compose.yml`

#### Monorepo Bootstrap
- **D-13:** Full monorepo scaffold — `apps/api`, `apps/worker`, `apps/web`, `apps/cli` + `packages/contracts`, `packages/db` per STACK.md
- **D-14:** pnpm workspaces + Turborepo for build/test/lint orchestration
- **D-15:** Vitest + testcontainers for integration tests covering DB persistence and audit queries
- **D-16:** Seed data — sample pipeline (dev → staging → prod) + mock promotion run for local dev and demo

### Claude's Discretion

None — all key decisions captured explicitly.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAFE-01 | System records audit trail for all promotion events (actor, action, timestamp, gate results) | Append-only `AuditEvent` model with structured actor (D-01/D-02), `GateResult` FK references (D-08), milestone-only writes via `recordAuditEvent` activity; repository query interface for run-scoped history |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **TypeScript** | ~5.8.x | Monorepo language | STACK.md pins 5.8.x; avoid 6.x until ecosystem catches up [VERIFIED: npm registry] |
| **Node.js** | 24.x LTS | Runtime | Active LTS per STACK.md; env has 25.x — pin engines to `>=24` [CITED: nodejs.org Release Schedule] |
| **pnpm** | 10.x | Workspace manager | Strict boundaries, `workspace:*` protocol [VERIFIED: npm registry] |
| **Turborepo** | 2.9.18 | Task orchestration | `tasks` key (v2), cache across packages [VERIFIED: npm registry] |
| **Prisma** | 7.8.0 | ORM + migrations | Type-safe schema; v7 requires `prisma.config.ts` + driver adapter [VERIFIED: npm registry] [CITED: prisma.io/docs] |
| **@prisma/client** | 7.8.0 | Generated client | Paired with prisma CLI [VERIFIED: npm registry] |
| **@prisma/adapter-pg** | 7.8.0 | Prisma 7 PG driver | Required for `PrismaClient` instantiation in v7 [CITED: prisma.io/docs/orm/overview/databases/postgresql] |
| **pg** | 8.22.0 | PostgreSQL driver | Used by adapter + testcontainers connection [VERIFIED: npm registry] |
| **PostgreSQL** | 16+ | System of record | Concurrent pipeline state + audit; Docker image `postgres:16` [CITED: STACK.md] |
| **@temporalio/workflow** | 1.18.1 | Workflow definitions | FSM skeleton, signals, conditions [VERIFIED: npm registry] [CITED: docs.temporal.io] |
| **@temporalio/worker** | 1.18.1 | Activity/workflow worker | Runs promotion workflow [VERIFIED: npm registry] |
| **@temporalio/client** | 1.18.1 | Workflow starter/signals | Starts skeleton runs in tests [VERIFIED: npm registry] |
| **@temporalio/activity** | 1.18.1 | Activity implementations | DB persistence activities [VERIFIED: npm registry] |
| **@temporalio/testing** | 1.18.1 | Workflow test harness | `TestWorkflowEnvironment` with time-skipping [VERIFIED: npm registry] [CITED: docs.temporal.io/develop/typescript/testing-suite] |
| **Zod** | 4.4.3 | Shared validation | Domain enums/types in `packages/contracts` [VERIFIED: npm registry] |
| **Vitest** | 4.1.9 | Test runner | Fast TS-native tests across packages [VERIFIED: npm registry] |
| **@testcontainers/postgresql** | 12.0.3 | Ephemeral Postgres | Integration tests without manual DB [VERIFIED: npm registry] [CITED: node.testcontainers.org] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **tsx** | latest | TS execution | Prisma seed script, dev scripts [CITED: prisma.io/docs/orm/prisma-migrate/workflows/seeding] |
| **dotenv** | latest | Env loading | `prisma.config.ts`, local dev |
| **uuid** / **nanoid** | latest | ID generation | `PromotionRun.id` = Temporal `workflowId` |
| **Biome** | latest | Lint/format | Root devDependency per STACK.md discretion |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma 7 + adapter | Drizzle ORM | STACK.md locked Prisma; Drizzle lighter but breaks stack decision |
| testcontainers | Manual docker postgres | testcontainers gives CI parity and isolation |
| `temporal server start-dev` | Full docker-compose stack | Dev server simpler for skeleton; D-12 requires compose — use compose with dev server image |
| SQLite for dev | PostgreSQL only | PITFALLS + STACK explicitly reject SQLite for concurrent audit |

**Installation (Phase 1 subset):**
```bash
# Root
corepack enable
pnpm init
pnpm add -D typescript@~5.8.0 turbo@2.9.18 vitest@4.1.9 @testcontainers/postgresql@12.0.3 biome tsx dotenv

# packages/db
pnpm add prisma@7.8.0 @prisma/client@7.8.0 @prisma/adapter-pg@7.8.0 pg zod@4.4.3

# packages/contracts
pnpm add zod@4.4.3

# apps/worker
pnpm add @temporalio/worker@1.18.1 @temporalio/workflow@1.18.1 @temporalio/client@1.18.1 @temporalio/activity@1.18.1
pnpm add -D @temporalio/testing@1.18.1
```

**Version verification (2026-06-20):** All versions confirmed via `npm view <pkg> version`.

## Package Legitimacy Audit

> slopcheck v0.6.1 ran against **PyPI** (wrong ecosystem for Node packages) — all `@*` scoped packages falsely flagged `[SLOP]`. Manual npm registry verification performed below.

| Package | Registry | Source Repo | npm view | Disposition |
|---------|----------|-------------|----------|-------------|
| prisma | npm | github.com/prisma/prisma | 7.8.0 | Approved |
| @prisma/client | npm | github.com/prisma/prisma | 7.8.0 | Approved |
| @prisma/adapter-pg | npm | github.com/prisma/prisma | 7.8.0 | Approved |
| @temporalio/workflow | npm | github.com/temporalio/sdk-typescript | 1.18.1 | Approved |
| @temporalio/worker | npm | github.com/temporalio/sdk-typescript | 1.18.1 | Approved |
| @temporalio/client | npm | github.com/temporalio/sdk-typescript | 1.18.1 | Approved |
| @temporalio/activity | npm | github.com/temporalio/sdk-typescript | 1.18.1 | Approved |
| @temporalio/testing | npm | github.com/temporalio/sdk-typescript | 1.18.1 | Approved |
| turbo | npm | github.com/vercel/turborepo | 2.9.18 | Approved |
| vitest | npm | github.com/vitest-dev/vitest | 4.1.9 | Approved |
| @testcontainers/postgresql | npm | github.com/testcontainers/testcontainers-node | 12.0.3 | Approved |
| testcontainers | npm | github.com/testcontainers/testcontainers-node | 12.0.3 | Approved |
| zod | npm | github.com/colinhacks/zod | 4.4.3 | Approved |
| typescript | npm | github.com/microsoft/TypeScript | 6.0.3 available; pin ~5.8.0 per STACK | Approved (pin 5.8.x) |

**Packages removed due to slopcheck [SLOP] verdict:** none (false positives from PyPI check)

**Packages flagged as suspicious [SUS]:** none after npm verification

**postinstall scripts:** None of the above packages expose risky postinstall scripts (checked via `npm view <pkg> scripts.postinstall`).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Phase 1 Scope Boundary                           │
├─────────────────────────────────────────────────────────────────────────┤
│  apps/worker (Temporal Worker)                                           │
│  ┌──────────────────────┐    signals: pause|resume|abort|gate*          │
│  │ promotionWorkflow    │◄─────────────────────────────────── (future API)│
│  │  (FSM stage loop)    │                                               │
│  └──────────┬───────────┘                                               │
│             │ proxyActivities                                           │
│             ▼                                                           │
│  ┌──────────────────────┐     ┌─────────────────────────────────────┐  │
│  │ persistRunState      │────►│ packages/db (Prisma repositories)    │  │
│  │ recordAuditEvent     │     │  Pipeline → Stage → GatePolicy       │  │
│  │ evaluateGate (stub)  │     │  PromotionRun, GateResult, AuditEvent│  │
│  └──────────────────────┘     └──────────────────┬──────────────────┘  │
│                                                   │                     │
│  apps/api, web, cli — scaffold only (no routes)   │                     │
└───────────────────────────────────────────────────┼─────────────────────┘
                                                    ▼
                                         ┌─────────────────────┐
                                         │ PostgreSQL 16        │
                                         │ (ffpromo database)     │
                                         └─────────────────────┘

Docker Compose (local):
  postgres:16 ──► app DATABASE_URL
  temporal dev server ──► localhost:7233 (execution engine, separate metadata store)
```

### Recommended Project Structure

```
ff-promo/
├── apps/
│   ├── api/                 # Shell: package.json, tsconfig, placeholder src/index.ts
│   ├── worker/
│   │   └── src/
│   │       ├── worker.ts    # Worker bootstrap
│   │       ├── workflows/
│   │       │   ├── promotion.workflow.ts
│   │       │   └── signals.ts
│   │       └── activities/
│   │           ├── index.ts
│   │           ├── persist-run-state.ts
│   │           ├── record-audit-event.ts
│   │           └── evaluate-gate.ts
│   ├── web/                 # Shell: Next.js scaffold (minimal)
│   └── cli/                 # Shell: placeholder bin
├── packages/
│   ├── contracts/
│   │   └── src/
│   │       ├── pipeline.ts  # Zod schemas mirroring Prisma enums
│   │       ├── promotion-run.ts
│   │       ├── audit.ts
│   │       └── index.ts
│   └── db/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       ├── prisma.config.ts
│       └── src/
│           ├── client.ts    # PrismaClient singleton with adapter
│           └── repositories/
│               ├── pipeline.repository.ts
│               ├── promotion-run.repository.ts
│               ├── gate-result.repository.ts
│               └── audit.repository.ts
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
├── vitest.config.ts
└── package.json
```

### Pattern 1: Prisma Schema — Pipeline / Stage / GatePolicy / PromotionRun / GateResult / AuditEvent

**What:** Normalized relational model with pipeline definition separate from promotion execution; gate policies per stage; append-only audit referencing gate results.

**When to use:** Always — D-05/D-06 require full schema day one.

**Recommended schema (planner adapts field names to contracts):**

```prisma
// packages/db/prisma/schema.prisma
// Source: Prisma schema patterns [CITED: prisma.io/docs/orm/prisma-schema/overview]

enum ActorType {
  user
  system
  api_key
}

enum PromotionStatus {
  pending
  active
  paused
  completed
  aborted
}

enum GateVerdict {
  pass
  fail
  pending
  skipped
}

enum AuditAction {
  run_started
  run_paused
  run_resumed
  run_aborted
  run_completed
  stage_entered
  stage_advanced
  gate_evaluated
}

model Pipeline {
  id          String   @id @default(cuid())
  name        String
  description String?
  version     Int      @default(1)
  flagKey     String   // LD flag this pipeline promotes
  projectKey  String   // LD project
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  stages Stage[]
  runs   PromotionRun[]

  @@unique([name, version])
  @@index([flagKey])
}

model Stage {
  id           String @id @default(cuid())
  pipelineId   String
  pipeline     Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  orderIndex   Int      // 0=dev, 1=staging, 2=prod
  environment  String   // "dev" | "staging" | "prod"
  displayName  String

  gatePolicies GatePolicy[]
  gateResults  GateResult[]

  @@unique([pipelineId, orderIndex])
  @@unique([pipelineId, environment])
}

model GatePolicy {
  id              String  @id @default(cuid())
  stageId         String
  stage           Stage   @relation(fields: [stageId], references: [id], onDelete: Cascade)
  metricType      String  // "error_rate" | "latency_p95"
  threshold       Float
  comparisonMode  String  @default("absolute") // future: "delta"
  windowSeconds   Int     @default(300)
  minSampleSize   Int     @default(0) // Phase 4 enforces; column exists now
  serviceName     String  // Prometheus scope

  @@unique([stageId, metricType])
}

model PromotionRun {
  id               String          @id @default(cuid())
  pipelineId       String
  pipeline         Pipeline        @relation(fields: [pipelineId], references: [id])
  pipelineVersion  Int             // frozen snapshot at creation (D-07 policy drift prevention)
  flagKey          String
  status           PromotionStatus @default(pending)
  currentStageIndex Int            @default(0)
  temporalWorkflowId String?       @unique // equals id once started
  pauseReason      String?
  startedAt        DateTime?
  completedAt      DateTime?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  gateResults GateResult[]
  auditEvents AuditEvent[]

  @@index([status])
  @@index([flagKey, status])
}

model GateResult {
  id              String      @id @default(cuid())
  promotionRunId  String
  promotionRun    PromotionRun @relation(fields: [promotionRunId], references: [id], onDelete: Cascade)
  stageId         String
  stage           Stage       @relation(fields: [stageId], references: [id])
  verdict         GateVerdict
  metricType      String
  observedValue   Float?
  threshold       Float
  metadata        Json        // forensics: query, window, cohort sizes (D-03)
  evaluatedAt     DateTime    @default(now())

  auditEvents AuditEvent[]

  @@index([promotionRunId, evaluatedAt])
}

model AuditEvent {
  id              String      @id @default(cuid())
  promotionRunId  String
  promotionRun    PromotionRun @relation(fields: [promotionRunId], references: [id], onDelete: Cascade)
  action          AuditAction
  actorType       ActorType
  actorId         String
  displayName     String?
  gateResultId    String?     // FK when action is gate_evaluated (D-08)
  gateResult      GateResult? @relation(fields: [gateResultId], references: [id])
  metadata        Json        // stage context, LD env, thresholds (D-03)
  occurredAt      DateTime    @default(now())

  @@index([promotionRunId, occurredAt])
  // Append-only: no updatedAt; repository exposes create + query only
}
```

**Prisma 7 client bootstrap:**

```typescript
// packages/db/src/client.ts
// Source: [CITED: prisma.io/docs/orm/overview/databases/postgresql]
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';

export function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
```

### Pattern 2: Append-Only Audit Repository

**What:** Repository exposes `append()` and `findByRunId()` only — no update/delete methods.

**When to use:** All audit writes (D-04 forever retention).

```typescript
// packages/db/src/repositories/audit.repository.ts
export class AuditRepository {
  constructor(private readonly db: PrismaClient) {}

  async append(input: {
    promotionRunId: string;
    action: AuditAction;
    actorType: ActorType;
    actorId: string;
    displayName?: string;
    gateResultId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.db.auditEvent.create({ data: input });
  }

  async findByRunId(promotionRunId: string, opts?: { limit?: number; cursor?: string }) {
    return this.db.auditEvent.findMany({
      where: { promotionRunId },
      orderBy: { occurredAt: 'asc' },
      take: opts?.limit ?? 100,
      include: { gateResult: true },
    });
  }
}
```

### Pattern 3: Temporal FSM Skeleton with Signals

**What:** Environment-stage loop with pause/resume/abort; gate evaluation via stub activity; state persisted via activities after each transition.

**When to use:** D-09/D-10 — skeleton only, real gate logic in Phase 3/4.

```typescript
// apps/worker/src/workflows/signals.ts
// Source: [CITED: docs.temporal.io/develop/typescript/message-passing]
import * as wf from '@temporalio/workflow';

export const pauseSignal = wf.defineSignal('pause');
export const resumeSignal = wf.defineSignal('resume');
export const abortSignal = wf.defineSignal('abort');
export const gatePassedSignal = wf.defineSignal<[ { stageIndex: number } ]>('gatePassed');
export const gateFailedSignal = wf.defineSignal<[ { stageIndex: number; reason: string } ]>('gateFailed');

export const statusQuery = wf.defineQuery<{
  status: string;
  currentStageIndex: number;
  isPaused: boolean;
}>('status');
```

```typescript
// apps/worker/src/workflows/promotion.workflow.ts
import * as wf from '@temporalio/workflow';
import type * as activities from '../activities';
import {
  pauseSignal, resumeSignal, abortSignal,
  gatePassedSignal, gateFailedSignal, statusQuery,
} from './signals';

const { persistRunState, recordAuditEvent, evaluateGate } = wf.proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

export interface PromotionWorkflowInput {
  promotionRunId: string;
  stageCount: number;
  actor: { actorType: string; actorId: string; displayName?: string };
}

export async function promotionWorkflow(input: PromotionWorkflowInput): Promise<void> {
  let currentStageIndex = 0;
  let status: 'active' | 'paused' | 'aborted' | 'completed' = 'active';
  let isPaused = false;
  let gateAwaiting = false;

  wf.setHandler(statusQuery, () => ({ status, currentStageIndex, isPaused }));

  wf.setHandler(pauseSignal, async () => {
    isPaused = true;
    status = 'paused';
    await persistRunState({ promotionRunId: input.promotionRunId, status: 'paused' });
    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'run_paused',
      actor: { actorType: 'system', actorId: 'workflow' },
    });
  });

  wf.setHandler(resumeSignal, async () => {
    isPaused = false;
    status = 'active';
    await persistRunState({ promotionRunId: input.promotionRunId, status: 'active' });
    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'run_resumed',
      actor: { actorType: 'system', actorId: 'workflow' },
    });
  });

  wf.setHandler(abortSignal, async () => {
    status = 'aborted';
    await persistRunState({ promotionRunId: input.promotionRunId, status: 'aborted' });
    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'run_aborted',
      actor: { actorType: 'system', actorId: 'workflow' },
    });
  });

  wf.setHandler(gatePassedSignal, () => { gateAwaiting = false; });
  wf.setHandler(gateFailedSignal, async ({ reason }) => {
    isPaused = true;
    status = 'paused';
    await persistRunState({ promotionRunId: input.promotionRunId, status: 'paused', pauseReason: reason });
    gateAwaiting = false;
  });

  await persistRunState({ promotionRunId: input.promotionRunId, status: 'active' });
  await recordAuditEvent({
    promotionRunId: input.promotionRunId,
    action: 'run_started',
    actor: input.actor,
  });

  while (currentStageIndex < input.stageCount && status !== 'aborted') {
    await wf.condition(() => !isPaused);

    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'stage_entered',
      actor: { actorType: 'system', actorId: 'workflow' },
      metadata: { stageIndex: currentStageIndex },
    });

    // Stub gate evaluation (D-11: mock pass)
    const gateResult = await evaluateGate({
      promotionRunId: input.promotionRunId,
      stageIndex: currentStageIndex,
    });

    if (gateResult.verdict === 'fail') {
      isPaused = true;
      status = 'paused';
      await persistRunState({ promotionRunId: input.promotionRunId, status: 'paused' });
      await wf.condition(() => !isPaused || status === 'aborted');
      if (status === 'aborted') break;
    }

    currentStageIndex++;
    await persistRunState({
      promotionRunId: input.promotionRunId,
      status: 'active',
      currentStageIndex,
    });
    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'stage_advanced',
      actor: { actorType: 'system', actorId: 'workflow' },
      metadata: { stageIndex: currentStageIndex },
      gateResultId: gateResult.gateResultId,
    });
  }

  if (status !== 'aborted') {
    status = 'completed';
    await persistRunState({ promotionRunId: input.promotionRunId, status: 'completed' });
    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'run_completed',
      actor: { actorType: 'system', actorId: 'workflow' },
    });
  }
}
```

**Workflow ID convention:** Set `workflowId: promotionRun.id` when starting — enables correlation without lookup table (D-07).

### Pattern 4: Monorepo Bootstrap Sequence

**What:** Ordered steps to scaffold greenfield monorepo.

**Steps:**
1. Create root `package.json` with `"private": true`, `"packageManager": "pnpm@10.x"`, scripts delegating to turbo
2. Create `pnpm-workspace.yaml` with `apps/*` and `packages/*`
3. Create `turbo.json` with v2 `tasks` key: `build`, `test`, `lint`, `dev` (dev: `cache: false, persistent: true`)
4. Scaffold packages with `"name": "@ff-promo/db"` etc. and `workspace:*` deps
5. Add root `tsconfig.base.json`; each package extends it
6. `packages/db`: `prisma init`, schema, `prisma.config.ts`, migrate
7. `apps/worker`: worker + workflow + activities wiring
8. `docker-compose.yml`: postgres + temporal (see Environment section)
9. Root `vitest.config.ts` with projects for `packages/db` and `apps/worker`

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// turbo.json (minimal)
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"], "outputs": [] },
    "lint": { "outputs": [] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

### Pattern 5: Integration Tests with testcontainers

**What:** Ephemeral Postgres per test file; run Prisma migrations before tests; seed optional.

```typescript
// packages/db/src/__tests__/audit.integration.test.ts
// Source: [CITED: node.testcontainers.org/modules/postgresql]
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { createPrismaClient } from '../client';
import { AuditRepository } from '../repositories/audit.repository';

let container: PostgreSqlContainer;
let connectionString: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  connectionString = container.getConnectionUri();
  process.env.DATABASE_URL = connectionString;
  execSync('pnpm exec prisma migrate deploy', {
    cwd: new URL('../../', import.meta.url).pathname,
    env: process.env,
  });
}, 120_000);

afterAll(async () => {
  await container?.stop();
});

test('append-only audit records milestone with actor and gate result', async () => {
  const db = createPrismaClient(connectionString);
  const audit = new AuditRepository(db);
  // ... create pipeline + run fixtures, append event, query by runId
});
```

**Temporal workflow tests:** Use `@temporalio/testing` `TestWorkflowEnvironment.createTimeSkipping()` with mocked activities that write to testcontainers Postgres [CITED: docs.temporal.io/develop/typescript/testing-suite].

### Anti-Patterns to Avoid

- **Importing Prisma in workflow code:** Breaks Temporal sandbox — use activities only
- **Storing promotion state in LD flag comments:** PITFALLS technical debt table — "Never"
- **UPDATE/DELETE on AuditEvent:** Violates D-04; enforce at repository layer
- **Using `pipeline` key in turbo.json:** Deprecated in Turborepo v2 — use `tasks`
- **SQLite for local dev:** STACK + PITFALLS reject — concurrent audit requires Postgres
- **Building LD statistical engine in Phase 1:** PITFALLS #8 — environment progression is the differentiator, not regression algorithms

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Durable workflow state + timers | Custom job queue / cron | Temporal `@temporalio/*` 1.18.1 | Replay-safe, signal-based pause/resume across hours |
| SQL migrations | Manual SQL files without tooling | Prisma Migrate | Versioned history, type-safe client generation |
| Ephemeral test databases | Shared local postgres | `@testcontainers/postgresql` | CI parity, isolation per suite |
| Monorepo task graph | Custom npm scripts | Turborepo 2.9.18 | Caching, dependency-aware builds |
| Runtime validation | Hand-rolled validators | Zod 4.4.3 in `packages/contracts` | Shared schemas across surfaces |
| Append-only audit enforcement | Hope developers don't delete | Repository API with create-only + DB FK constraints | Compliance + forensics |

**Key insight:** Phase 1 establishes boundaries (Postgres = truth, Temporal = execution, activities = bridge). Hand-rolling any of these creates split-brain and audit gaps that PITFALLS #1 and #7 warn about.

## Common Pitfalls

### Pitfall 1: Prisma 7 Configuration Surprise

**What goes wrong:** Planner/tasks assume Prisma 5 patterns (`url` in schema, direct `new PrismaClient()`, auto-seed on reset).

**Why it happens:** Ecosystem docs still mix v6/v7 patterns; STACK.md lists Prisma 7.8.0.

**How to avoid:** Add `prisma.config.ts`; use `@prisma/adapter-pg`; document explicit `pnpm exec prisma db seed`; run `prisma generate` in `packages/db` build task.

**Warning signs:** `PrismaClient` constructor errors; migrations fail without config file.

### Pitfall 2: Split-Brain Between Postgres and Temporal (Early)

**What goes wrong:** Workflow advances stage in memory but activity fails to persist; restart shows stale Postgres state.

**Why it happens:** D-07 dual source of truth requires disciplined write ordering.

**How to avoid:** Persist via activity **before** advancing loop index; use `promotionRun.id` as `workflowId`; on worker start, don't auto-reconcile (Phase 4) — but log mismatch if query shows divergence.

**Warning signs:** Temporal UI shows completed workflow; Postgres run still `active`.

**Phase relevance:** Establish write ordering in skeleton now; drift detection comes Phase 4 (PITFALLS #1).

### Pitfall 3: Audit Noise vs Forensics Gap

**What goes wrong:** Either logging every reconciler tick (violates D-01) or logging too little for pause forensics (PITFALLS #7).

**How to avoid:** Milestone enum only; rich `metadata` JSON on `gate_evaluated` and pause events with threshold, observed value, stage env, flag key (D-03).

**Warning signs:** Audit table grows unbounded with tick events; pause entries lack metric values.

### Pitfall 4: Scope Creep — LD Guarded Rollout Clone

**What goes wrong:** Phase 1 tasks include real PromQL, LD API, or statistical regression engine.

**Why it happens:** PITFALLS #8 — engineers gravitate toward familiar LD patterns.

**How to avoid:** Stub `evaluateGate` returns mock pass; no `packages/ld-adapter` or `packages/telemetry` until Phases 2–3. Document scope boundary in `packages/db/README.md` or phase verification.

**Warning signs:** Sprint includes PromQL queries or semantic patch code.

### Pitfall 5: Temporal Sandbox Violations

**What goes wrong:** Workflow imports `pg`, `fs`, or `@prisma/client` — worker fails at bundle time.

**How to avoid:** All I/O in activities; workflow imports only `@temporalio/workflow` and activity types (`import type`).

**Warning signs:** `webpack`/`workflow` bundle errors mentioning disallowed modules.

### Pitfall 6: testcontainers Port Collisions / Slow CI

**What goes wrong:** Tests flake when Docker unavailable or migrate runs per test instead of per file.

**How to avoid:** Single container per `describe`/`beforeAll`; 120s timeout; skip integration tests when `SKIP_TESTCONTAINERS=1` for quick unit runs.

**Warning signs:** Random `ECONNREFUSED` to postgres; CI exceeds 5min for Phase 1 tests.

### Pitfall 7: Shared Postgres for App + Temporal Metadata

**What goes wrong:** Single postgres instance, same database — migration conflicts between Prisma and Temporal auto-setup.

**How to avoid:** Separate databases on one postgres container (`ffpromo` + `temporal`) OR use `temporal server start-dev` with embedded store for Temporal while compose runs app postgres only.

**Warning signs:** Temporal tables appear in Prisma introspection.

## Code Examples

### Prisma Migrate + Seed Config (Prisma 7)

```typescript
// packages/db/prisma.config.ts
// Source: [CITED: prisma.io/docs/orm/prisma-migrate/workflows/seeding]
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

### Stub evaluateGate Activity

```typescript
// apps/worker/src/activities/evaluate-gate.ts
import { createGateResult } from '@ff-promo/db'; // repository helper

export async function evaluateGate(input: {
  promotionRunId: string;
  stageIndex: number;
}): Promise<{ verdict: 'pass' | 'fail'; gateResultId: string }> {
  const gateResult = await createGateResult({
    promotionRunId: input.promotionRunId,
    stageIndex: input.stageIndex,
    verdict: 'pass',
    metricType: 'error_rate',
    observedValue: 0.001,
    threshold: 0.01,
    metadata: { stub: true, message: 'Phase 1 mock pass' },
  });
  return { verdict: 'pass', gateResultId: gateResult.id };
}
```

### Docker Compose (App Postgres + Temporal Dev)

```yaml
# docker-compose.yml
# Temporal dev: [CITED: docs.temporal.io/develop/typescript/set-up-your-local-typescript]
# Alternative full stack: [CITED: github.com/temporalio/samples-server/tree/main/compose]
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ffpromo
      POSTGRES_PASSWORD: ffpromo
      POSTGRES_DB: ffpromo
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  temporal:
    image: temporalio/admin-tools:1.27.2
    entrypoint: ["temporal", "server", "start-dev", "--ip", "0.0.0.0", "--db-filename", "/tmp/temporal.db"]
    ports:
      - "7233:7233"
      - "8233:8233"

volumes:
  pgdata:
```

> **Note:** `temporal server start-dev` uses embedded SQLite for Temporal metadata — acceptable for Phase 1 skeleton per Temporal local dev docs. App data stays in Postgres. Phase 4+ may switch to `samples-server/compose` postgres-backed Temporal for production parity.

### Temporal Integration Test Skeleton

```typescript
// apps/worker/src/__tests__/promotion.workflow.test.ts
// Source: [CITED: docs.temporal.io/develop/typescript/testing-suite]
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { promotionWorkflow } from '../workflows/promotion.workflow';
import * as activities from '../activities';

let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
}, 120_000);

afterAll(async () => {
  await testEnv?.teardown();
});

test('skeleton completes all stages with stub pass', async () => {
  const worker = await Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue: 'test-promotion',
    workflowsPath: require.resolve('../workflows/promotion.workflow'),
    activities,
  });

  await worker.runUntil(
    testEnv.client.workflow.execute(promotionWorkflow, {
      workflowId: 'test-run-1',
      taskQueue: 'test-promotion',
      args: [{
        promotionRunId: 'test-run-1',
        stageCount: 3,
        actor: { actorType: 'system', actorId: 'test' },
      }],
    }),
  );
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma 5/6 direct client | Prisma 7 + driver adapter | Prisma 7 (2025) | Must use `@prisma/adapter-pg` + `prisma.config.ts` |
| `turbo.json pipeline` key | `tasks` key | Turborepo v2 | Old tutorials fail silently |
| Auto-seed on `migrate reset` | Explicit `prisma db seed` | Prisma 7 | Seed step must be documented in dev workflow |
| `temporalio/docker-compose` repo | `temporalio/samples-server/compose` | Archived 2024 | Link to samples-server for compose templates |
| BullMQ for promotion orchestration | Temporal workflows | Industry 2024–2026 | Don't hand-roll durable timers |

**Deprecated/outdated:**
- `temporalio/docker-compose` standalone repo — archived; use `samples-server` [CITED: github.com/temporalio/docker-compose]
- Storing workflow state only in Redis — STACK.md "What NOT to Use"

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Temporal SDK 1.18.1 compatible with local Temporal CLI server 1.30.x | Standard Stack | Worker connection failures — verify against Temporal SDK compatibility matrix |
| A2 | `temporal server start-dev` in Docker via admin-tools image works for CI | Code Examples | May need host-installed temporal CLI instead |
| A3 | Pin TypeScript ~5.8.x despite 6.0.3 on npm | Standard Stack | Some deps may require TS 6 — spike during Wave 0 |
| A4 | `cuid()` default IDs suitable for workflowId | Prisma Schema | UUID v4 also fine if team prefers |

## Open Questions (RESOLVED)

1. **Shared vs separate Postgres for Temporal in compose** — **RESOLVED:** Use embedded Temporal store in compose (`temporal server start-dev` with `--db-filename /tmp/temporal.db` via temporalio/admin-tools image); app Postgres remains separate `ffpromo` database on postgres:16 service. Upgrade path documented to `samples-server/compose` for production parity.

2. **Prisma generator output path** — **RESOLVED:** Use `output = "../generated/client"` in schema generator block; import PrismaClient from `../generated/client` in client.ts; re-export types via `@ff-promo/db` package index.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All packages | ✓ | v25.9.0 (env) | Pin engines `>=24`; 25.x acceptable for dev |
| pnpm | Monorepo | ✓ | 10.33.0 | corepack enable |
| Docker | testcontainers, compose | ✓ | 27.0.3 | Block integration tests; document install |
| Temporal CLI | Local dev (optional) | ✓ | 1.6.1 (server 1.30.1) | Use docker-compose temporal service |
| PostgreSQL | packages/db | ✓ via Docker | 16 (compose) | testcontainers spins own instance |
| ctx7 CLI | Doc lookup | ✗ | — | Used WebFetch to official docs |

**Missing dependencies with no fallback:**
- Docker (required for testcontainers and compose-based local stack)

**Missing dependencies with fallback:**
- Temporal CLI — docker-compose `temporal server start-dev` service

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` (root) — Wave 0 creates |
| Quick run command | `pnpm exec vitest run --project db` |
| Full suite command | `pnpm turbo run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAFE-01 | Audit event recorded with actor, action, timestamp | integration | `pnpm exec vitest run packages/db/src/__tests__/audit.integration.test.ts -x` | ❌ Wave 0 |
| SAFE-01 | Gate result linked to audit milestone | integration | `pnpm exec vitest run packages/db/src/__tests__/gate-result.integration.test.ts -x` | ❌ Wave 0 |
| SAFE-01 | Query audit history by promotion run ID | integration | `pnpm exec vitest run packages/db/src/__tests__/audit.integration.test.ts -x` | ❌ Wave 0 |
| D-05 | Pipeline + stages + gate policies persist | integration | `pnpm exec vitest run packages/db/src/__tests__/pipeline.integration.test.ts -x` | ❌ Wave 0 |
| D-07 | PromotionRun persists across simulated restart | integration | `pnpm exec vitest run packages/db/src/__tests__/promotion-run.integration.test.ts -x` | ❌ Wave 0 |
| D-09 | Temporal skeleton completes stage loop | integration | `pnpm exec vitest run apps/worker/src/__tests__/promotion.workflow.test.ts -x` | ❌ Wave 0 |
| D-10 | pause/resume signals affect workflow state | integration | `pnpm exec vitest run apps/worker/src/__tests__/promotion.signals.test.ts -x` | ❌ Wave 0 |
| D-16 | Seed creates dev→staging→prod pipeline | smoke | `pnpm exec prisma db seed && pnpm exec vitest run packages/db/src/__tests__/seed.smoke.test.ts -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm exec vitest run --project db -x` (< 30s with testcontainers warm)
- **Per wave merge:** `pnpm turbo run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Root `vitest.config.ts` with `projects: ['packages/db', 'apps/worker']`
- [ ] `packages/db/src/__tests__/setup.ts` — testcontainers lifecycle helper
- [ ] `packages/db/src/__tests__/audit.integration.test.ts` — SAFE-01 core
- [ ] `packages/db/src/__tests__/pipeline.integration.test.ts` — D-05/D-06
- [ ] `apps/worker/src/__tests__/promotion.workflow.test.ts` — D-09
- [ ] `apps/worker/src/__tests__/promotion.signals.test.ts` — D-10
- [ ] Framework install: `pnpm add -D vitest@4.1.9 @testcontainers/postgresql@12.0.3` at root
- [ ] `turbo.json` test task wired in all packages

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Deferred to Phase 5/7 |
| V3 Session Management | no | N/A Phase 1 |
| V4 Access Control | no | Repository layer only; RBAC later |
| V5 Input Validation | yes | Zod schemas in `packages/contracts` for activity inputs |
| V6 Cryptography | no | No secrets in Phase 1 schema |
| V7 Error Handling | partial | Activity retries; don't leak DB errors to workflow |
| V8 Data Protection | yes | Append-only audit; no PII in seed data |
| V14 Database | yes | Parameterized queries via Prisma ORM |

### Known Threat Patterns for Phase 1 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via raw queries | Tampering | Prisma parameterized queries; avoid `$executeRaw` in Phase 1 |
| Audit log tampering | Repudiation | Append-only repository; no UPDATE/DELETE endpoints |
| Untrusted JSON in audit metadata | Tampering | Zod-validate metadata shape before insert |
| Docker socket exposure in CI | Elevation | testcontainers uses isolated ephemeral containers |
| Dependency confusion | Spoofing | pnpm workspace protocol; lockfile committed |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory exists in the workspace. GSD workflow rules from `CLAUDE.md` apply: use `/gsd-execute-phase` for implementation; research/planning artifacts go under `.planning/`.

## Sources

### Primary (HIGH confidence)
- [Prisma Schema Overview](https://www.prisma.io/docs/orm/prisma-schema/overview) — schema structure, JSON types
- [Prisma PostgreSQL + driver adapters](https://www.prisma.io/docs/orm/overview/databases/postgresql) — `@prisma/adapter-pg` requirement
- [Prisma Migrate getting started](https://www.prisma.io/docs/orm/prisma-migrate/getting-started) — migration workflow
- [Prisma Seeding (v7)](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding) — explicit seed, adapter in seed script
- [Temporal TypeScript local setup](https://docs.temporal.io/develop/typescript/set-up-your-local-typescript) — worker/client/workflow model
- [Temporal message passing](https://docs.temporal.io/develop/typescript/message-passing) — defineSignal, condition, handlers
- [Temporal testing suite](https://docs.temporal.io/develop/typescript/testing-suite) — TestWorkflowEnvironment, mock activities
- [Testcontainers PostgreSQL module](https://node.testcontainers.org/modules/postgresql/) — PostgreSqlContainer API
- [temporalio/samples-server/compose](https://github.com/temporalio/samples-server/tree/main/compose) — docker compose templates
- `.planning/research/PITFALLS.md` — Phase 1 relevant pitfalls (#1, #7, #8, #10, audit gaps)
- `.planning/research/STACK.md` — version pins, monorepo layout
- `.planning/research/ARCHITECTURE.md` — policy vs run separation, persistence layer

### Secondary (MEDIUM confidence)
- Turborepo v2 `tasks` configuration — verified via multiple 2025–2026 guides cross-referencing turbo.build schema
- npm registry queries (2026-06-20) — all package versions

### Tertiary (LOW confidence)
- Docker `temporalio/admin-tools` as `start-dev` entrypoint — needs spike; official docs recommend host CLI

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm verified + official Prisma/Temporal docs
- Architecture: HIGH — locked by CONTEXT.md D-01–D-16; patterns from official SDK docs
- Pitfalls: HIGH — PITFALLS.md cross-referenced to Phase 1 scope

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (30 days — stable stack; re-verify Prisma 7 patch releases)
