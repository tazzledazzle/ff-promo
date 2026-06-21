# Phase 1: Foundation & Data Layer - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 42
**Analogs found:** 0 / 42 (greenfield — reference patterns from RESEARCH.md, STACK.md, ARCHITECTURE.md)

> **Greenfield note:** No application source exists in the repo yet (only `.planning/` and `.claude/` GSD tooling). All pattern assignments below cite **intended patterns** from phase research and stack docs as the planner's copy-from references. Line numbers refer to `.planning/phases/01-foundation-data-layer/01-RESEARCH.md` unless otherwise noted.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` (root) | config | batch | `01-RESEARCH.md` Pattern 4 | reference |
| `pnpm-workspace.yaml` | config | batch | `01-RESEARCH.md` Pattern 4 | reference |
| `turbo.json` | config | batch | `01-RESEARCH.md` Pattern 4 | reference |
| `tsconfig.base.json` | config | transform | `01-RESEARCH.md` Pattern 4 | reference |
| `vitest.config.ts` | config | batch | `01-RESEARCH.md` Pattern 5 | reference |
| `docker-compose.yml` | config | event-driven | `01-RESEARCH.md` Code Examples | reference |
| `packages/db/prisma/schema.prisma` | model | CRUD | `01-RESEARCH.md` Pattern 1 | reference |
| `packages/db/prisma.config.ts` | config | file-I/O | `01-RESEARCH.md` Code Examples | reference |
| `packages/db/prisma/migrations/` | migration | file-I/O | Prisma Migrate docs (via RESEARCH) | reference |
| `packages/db/prisma/seed.ts` | utility | batch | `01-RESEARCH.md` D-16 | reference |
| `packages/db/src/client.ts` | utility | request-response | `01-RESEARCH.md` Pattern 1 | reference |
| `packages/db/src/repositories/pipeline.repository.ts` | service | CRUD | `01-RESEARCH.md` Pattern 2 | reference |
| `packages/db/src/repositories/promotion-run.repository.ts` | service | CRUD | `01-RESEARCH.md` Pattern 2 | reference |
| `packages/db/src/repositories/gate-result.repository.ts` | service | CRUD | `01-RESEARCH.md` Pattern 1 | reference |
| `packages/db/src/repositories/audit.repository.ts` | service | CRUD | `01-RESEARCH.md` Pattern 2 | reference |
| `packages/contracts/src/pipeline.ts` | utility | transform | `01-RESEARCH.md` Standard Stack | reference |
| `packages/contracts/src/promotion-run.ts` | utility | transform | ARCHITECTURE Pattern 2 | reference |
| `packages/contracts/src/audit.ts` | utility | transform | `01-RESEARCH.md` D-01/D-02 | reference |
| `packages/contracts/src/index.ts` | utility | transform | STACK.md monorepo layout | reference |
| `apps/worker/src/worker.ts` | provider | event-driven | Temporal SDK docs (via RESEARCH) | reference |
| `apps/worker/src/workflows/signals.ts` | utility | event-driven | `01-RESEARCH.md` Pattern 3 | reference |
| `apps/worker/src/workflows/promotion.workflow.ts` | service | event-driven | `01-RESEARCH.md` Pattern 3 | reference |
| `apps/worker/src/activities/index.ts` | utility | event-driven | Temporal worker layout (STACK.md) | reference |
| `apps/worker/src/activities/persist-run-state.ts` | service | CRUD | `01-RESEARCH.md` D-07 | reference |
| `apps/worker/src/activities/record-audit-event.ts` | service | CRUD | `01-RESEARCH.md` Pattern 2 | reference |
| `apps/worker/src/activities/evaluate-gate.ts` | service | request-response | `01-RESEARCH.md` Code Examples | reference |
| `apps/api/src/index.ts` | route | request-response | STACK.md shell scaffold | reference |
| `apps/web/` (minimal scaffold) | component | request-response | STACK.md monorepo layout | reference |
| `apps/cli/` (placeholder bin) | route | request-response | STACK.md monorepo layout | reference |
| `packages/db/src/__tests__/setup.ts` | test | batch | `01-RESEARCH.md` Pattern 5 | reference |
| `packages/db/src/__tests__/audit.integration.test.ts` | test | CRUD | `01-RESEARCH.md` Pattern 5 | reference |
| `packages/db/src/__tests__/gate-result.integration.test.ts` | test | CRUD | `01-RESEARCH.md` Validation Architecture | reference |
| `packages/db/src/__tests__/pipeline.integration.test.ts` | test | CRUD | `01-RESEARCH.md` Validation Architecture | reference |
| `packages/db/src/__tests__/promotion-run.integration.test.ts` | test | CRUD | `01-RESEARCH.md` D-07 | reference |
| `packages/db/src/__tests__/seed.smoke.test.ts` | test | batch | `01-RESEARCH.md` D-16 | reference |
| `apps/worker/src/__tests__/promotion.workflow.test.ts` | test | event-driven | `01-RESEARCH.md` Code Examples | reference |
| `apps/worker/src/__tests__/promotion.signals.test.ts` | test | event-driven | `01-RESEARCH.md` D-10 | reference |

## Pattern Assignments

### Root monorepo bootstrap (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`)

**Analog:** `.planning/phases/01-foundation-data-layer/01-RESEARCH.md` Pattern 4 + `.planning/research/STACK.md` Monorepo Layout

**Workspace pattern** (RESEARCH lines 612-617):
```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Turborepo v2 tasks pattern** (RESEARCH lines 619-630):
```json
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

**Bootstrap sequence** (RESEARCH lines 601-610):
1. Root `package.json` with `"private": true`, `"packageManager": "pnpm@10.x"`, scripts delegating to turbo
2. `pnpm-workspace.yaml` with `apps/*` and `packages/*`
3. `turbo.json` with v2 `tasks` key (not deprecated `pipeline`)
4. Scaffold packages with `"name": "@ff-promo/db"` etc. and `workspace:*` deps
5. Root `tsconfig.base.json`; each package extends it

**Package naming** (STACK.md lines 57-73):
```
apps/api, apps/worker, apps/web, apps/cli
packages/contracts, packages/db
```

---

### `packages/db/prisma/schema.prisma` (model, CRUD)

**Analog:** `01-RESEARCH.md` Pattern 1

**Core schema pattern** (RESEARCH lines 254-393) — normalized Pipeline → Stage → GatePolicy; separate PromotionRun, GateResult, AuditEvent:

```prisma
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
  version     Int      @default(1)
  flagKey     String
  projectKey  String
  stages      Stage[]
  runs        PromotionRun[]
  @@unique([name, version])
}

model Stage {
  id           String @id @default(cuid())
  pipelineId   String
  orderIndex   Int
  environment  String
  gatePolicies GatePolicy[]
  @@unique([pipelineId, orderIndex])
}

model GatePolicy {
  id              String  @id @default(cuid())
  stageId         String
  metricType      String
  threshold       Float
  serviceName     String
  @@unique([stageId, metricType])
}

model PromotionRun {
  id                 String          @id @default(cuid())
  pipelineId         String
  pipelineVersion    Int
  flagKey            String
  status             PromotionStatus @default(pending)
  currentStageIndex  Int             @default(0)
  temporalWorkflowId String?         @unique
  gateResults        GateResult[]
  auditEvents        AuditEvent[]
}

model GateResult {
  id              String      @id @default(cuid())
  promotionRunId  String
  stageId         String
  verdict         GateVerdict
  metricType      String
  observedValue   Float?
  threshold       Float
  metadata        Json
  auditEvents     AuditEvent[]
}

model AuditEvent {
  id              String      @id @default(cuid())
  promotionRunId  String
  action          AuditAction
  actorType       ActorType
  actorId         String
  displayName     String?
  gateResultId    String?
  metadata        Json
  occurredAt      DateTime    @default(now())
  @@index([promotionRunId, occurredAt])
  // Append-only: no updatedAt
}
```

**Architecture alignment** (ARCHITECTURE.md lines 147-174) — Policy vs Run separation with frozen `pipelineVersion` on run creation.

---

### `packages/db/prisma.config.ts` + `packages/db/src/client.ts` (config + utility)

**Analog:** `01-RESEARCH.md` Pattern 1 + Code Examples (Prisma 7)

**Prisma 7 config** (RESEARCH lines 762-778):
```typescript
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

**Client bootstrap with driver adapter** (RESEARCH lines 397-407):
```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';

export function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
```

**Critical:** Do NOT use Prisma 5 patterns (`url` in schema, `new PrismaClient()` without adapter). Run `prisma generate` in `packages/db` build task.

---

### `packages/db/src/repositories/audit.repository.ts` (service, CRUD)

**Analog:** `01-RESEARCH.md` Pattern 2

**Append-only repository** (RESEARCH lines 416-441):
```typescript
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

**Apply to:** `pipeline.repository.ts`, `promotion-run.repository.ts`, `gate-result.repository.ts` — same class + constructor injection pattern; expose create/query only on audit; no UPDATE/DELETE on AuditEvent (D-04).

---

### `packages/contracts/src/*.ts` (utility, transform)

**Analog:** STACK.md Supporting Libraries + ARCHITECTURE Pattern 2

**Zod enum mirroring** — export schemas matching Prisma enums for activity/API inputs:
```typescript
// packages/contracts/src/audit.ts
import { z } from 'zod';

export const ActorTypeSchema = z.enum(['user', 'system', 'api_key']);
export const AuditActionSchema = z.enum([
  'run_started', 'run_paused', 'run_resumed', 'run_aborted',
  'run_completed', 'stage_entered', 'stage_advanced', 'gate_evaluated',
]);

export const AuditEventInputSchema = z.object({
  promotionRunId: z.string(),
  action: AuditActionSchema,
  actorType: ActorTypeSchema,
  actorId: z.string(),
  displayName: z.string().optional(),
  gateResultId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

**Barrel export** (STACK.md lines 65-66):
```typescript
// packages/contracts/src/index.ts
export * from './pipeline';
export * from './promotion-run';
export * from './audit';
```

---

### `apps/worker/src/workflows/signals.ts` (utility, event-driven)

**Analog:** `01-RESEARCH.md` Pattern 3

**Signal definitions** (RESEARCH lines 450-465):
```typescript
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

---

### `apps/worker/src/workflows/promotion.workflow.ts` (service, event-driven)

**Analog:** `01-RESEARCH.md` Pattern 3

**Imports pattern** (RESEARCH lines 468-474):
```typescript
import * as wf from '@temporalio/workflow';
import type * as activities from '../activities';
import {
  pauseSignal, resumeSignal, abortSignal,
  gatePassedSignal, gateFailedSignal, statusQuery,
} from './signals';
```

**Activity proxy pattern** (RESEARCH lines 476-481):
```typescript
const { persistRunState, recordAuditEvent, evaluateGate } = wf.proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});
```

**FSM core loop** (RESEARCH lines 489-592) — key invariants:
- `wf.setHandler` for each signal; persist via activities inside handlers
- `await wf.condition(() => !isPaused)` before stage work
- Persist **before** advancing `currentStageIndex` (D-07 split-brain prevention)
- Stub `evaluateGate` returns mock pass; fail path pauses run
- `workflowId: promotionRun.id` when starting (correlation without lookup table)

**Sandbox rule:** Workflow imports ONLY `@temporalio/workflow` and `import type` for activities — never Prisma/pg/fs.

---

### `apps/worker/src/activities/*.ts` (service, CRUD / request-response)

**Analog:** `01-RESEARCH.md` Code Examples + ARCHITECTURE Pattern 1

**Activity as DB bridge** (RESEARCH lines 782-801):
```typescript
// apps/worker/src/activities/evaluate-gate.ts
import { createGateResult } from '@ff-promo/db';

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

**persist-run-state.ts pattern:**
- Accept `{ promotionRunId, status, currentStageIndex?, pauseReason? }`
- Call `PromotionRunRepository.updateState()` — Postgres is canonical (D-07)
- Set `temporalWorkflowId` to run id on first persist

**record-audit-event.ts pattern:**
- Validate input with `@ff-promo/contracts` Zod schemas
- Call `AuditRepository.append()` — milestone only (D-01)
- Include rich `metadata` JSON for gate/pause forensics (D-03)

**activities/index.ts:**
```typescript
export { persistRunState } from './persist-run-state';
export { recordAuditEvent } from './record-audit-event';
export { evaluateGate } from './evaluate-gate';
```

---

### `apps/worker/src/worker.ts` (provider, event-driven)

**Analog:** Temporal TypeScript SDK docs (via RESEARCH) + STACK.md worker placement

**Worker bootstrap pattern:**
```typescript
import { Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const worker = await Worker.create({
    taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? 'promotion',
    workflowsPath: require.resolve('./workflows/promotion.workflow'),
    activities,
  });
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Dependencies:** `@ff-promo/db` via activities only; connect to `localhost:7233` (Docker Compose temporal service).

---

### `docker-compose.yml` (config, event-driven)

**Analog:** `01-RESEARCH.md` Code Examples

**Compose pattern** (RESEARCH lines 806-830):
```yaml
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

**Pitfall avoidance:** App data in `ffpromo` Postgres; Temporal metadata in embedded SQLite — do NOT share Prisma migrations with Temporal tables (RESEARCH Pitfall 7).

---

### App shells (`apps/api`, `apps/web`, `apps/cli`)

**Analog:** STACK.md Monorepo Layout + RESEARCH Recommended Project Structure

**Phase 1 scope:** Scaffold only — `package.json`, `tsconfig.json`, placeholder entrypoint. No routes, no Next.js pages, no Commander commands.

```typescript
// apps/api/src/index.ts — placeholder
console.log('ff-promo API shell — Phase 5');
```

---

### Integration tests (`packages/db/src/__tests__/*`, `apps/worker/src/__tests__/*`)

**Analog:** `01-RESEARCH.md` Pattern 5 + Code Examples

**testcontainers setup** (RESEARCH lines 637-666):
```typescript
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
```

**Temporal workflow test** (RESEARCH lines 836-874):
```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
}, 120_000);

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
      args: [{ promotionRunId: 'test-run-1', stageCount: 3, actor: { actorType: 'system', actorId: 'test' } }],
    }),
  );
});
```

**Root vitest config** — projects for `packages/db` and `apps/worker`; support `SKIP_TESTCONTAINERS=1` for quick unit runs.

---

### `packages/db/prisma/seed.ts` (utility, batch)

**Analog:** `01-RESEARCH.md` D-16

**Seed pattern:**
- Create pipeline `dev → staging → prod` with 3 stages, gate policies per stage
- Create one mock `PromotionRun` in `pending` status for local demo
- Use `createPrismaClient(process.env.DATABASE_URL!)` with adapter
- Invoked explicitly via `pnpm exec prisma db seed` (Prisma 7 — no auto-seed on reset)

---

## Shared Patterns

### Dual Source of Truth (D-07)
**Source:** `01-RESEARCH.md` Architectural Responsibility Map + ARCHITECTURE Pattern 2
**Apply to:** All workflow activities, `promotion-run.repository.ts`, workflow start convention

```typescript
// Postgres = canonical business state
// Temporal = execution mechanics (timers, signals, replay)
// workflowId MUST equal promotionRun.id
await client.workflow.start(promotionWorkflow, {
  workflowId: promotionRun.id,
  taskQueue: 'promotion',
  args: [{ promotionRunId: promotionRun.id, stageCount, actor }],
});
```

### Activity-Only Database Access
**Source:** `01-RESEARCH.md` Anti-Patterns (Temporal Sandbox Violations)
**Apply to:** All workflow files; never import `@ff-promo/db` in `workflows/`

```typescript
// ✅ workflow file
import type * as activities from '../activities';
const { persistRunState } = wf.proxyActivities<typeof activities>({ ... });

// ❌ workflow file
import { createPrismaClient } from '@ff-promo/db';
```

### Append-Only Audit
**Source:** `01-RESEARCH.md` Pattern 2 + ARCHITECTURE Audit flow
**Apply to:** `audit.repository.ts`, `record-audit-event.ts`, all audit writes

- Repository exposes `append()` + `findByRunId()` only
- Milestone actions only (D-01 enum values)
- Structured actor: `actorType` + `actorId` + optional `displayName` (D-02)
- Rich JSON `metadata` on gate/pause events (D-03)
- `gateResultId` FK when action is `gate_evaluated` (D-08)

### Zod Validation at Boundaries
**Source:** `01-RESEARCH.md` Security Domain V5
**Apply to:** Activity inputs, seed data shapes, future API DTOs

```typescript
const input = AuditEventInputSchema.parse(rawInput);
await auditRepository.append(input);
```

### Monorepo Package Boundaries
**Source:** STACK.md Monorepo Layout
**Apply to:** All packages

| Package | Depends On | Must NOT Depend On |
|---------|------------|-------------------|
| `@ff-promo/contracts` | zod | db, worker, temporal |
| `@ff-promo/db` | prisma, pg, zod | temporal, apps |
| `@ff-promo/worker` | temporal, `@ff-promo/db`, `@ff-promo/contracts` | — |
| App shells | workspace packages (minimal) | cross-app imports |

Use `workspace:*` protocol in `package.json` dependencies.

### Error Handling in Activities
**Source:** ARCHITECTURE Pattern 4 + RESEARCH Security V7
**Apply to:** All activity files

- Temporal retry config on `proxyActivities` (3 attempts, 30s timeout)
- Catch DB errors in activities; return typed errors — do not leak raw SQL to workflow
- Activity failure → workflow retry; persistent failure → run stays in last persisted state

---

## No Analog Found

All 42 files are greenfield. No in-repo codebase analogs exist. Planner MUST use patterns documented above from:

| Reference | Path | Use For |
|-----------|------|---------|
| Phase research | `.planning/phases/01-foundation-data-layer/01-RESEARCH.md` | Concrete code templates, test map, pitfalls |
| Stack pins | `.planning/research/STACK.md` | Versions, monorepo layout, package deps |
| Architecture | `.planning/research/ARCHITECTURE.md` | Policy vs run separation, audit flow, build order |
| Pitfalls | `.planning/research/PITFALLS.md` | Split-brain, audit forensics, scope creep |

---

## Metadata

**Analog search scope:** `/Users/terenceschumacher/dev/june-portfolio-projects/ff-promo` (full repo); `apps/`, `packages/` — empty
**Files scanned:** 473 (mostly `.planning/`, `.claude/`); 0 application TypeScript files
**Pattern extraction date:** 2026-06-20
**Reference confidence:** HIGH — locked by CONTEXT D-01–D-16; patterns from official Prisma 7 + Temporal SDK docs via RESEARCH
