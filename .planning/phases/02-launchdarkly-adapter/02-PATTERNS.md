# Phase 2: LaunchDarkly Adapter - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 18
**Analogs found:** 14 / 18

> Phase 2 adds `packages/ld-adapter` (LaunchDarkly REST adapter) and extends `packages/contracts` with shared flag-state schemas. No CONTEXT.md or RESEARCH.md exists yet for this phase — file list inferred from ROADMAP Phase 2 success criteria, REQUIREMENTS PROV-01/02/03, and STACK.md monorepo layout.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/ld-adapter/package.json` | config | batch | `packages/db/package.json` | exact |
| `packages/ld-adapter/tsconfig.json` | config | transform | `packages/db/tsconfig.json` | exact |
| `packages/ld-adapter/src/index.ts` | utility | transform | `packages/db/src/index.ts` | exact |
| `packages/ld-adapter/src/client.ts` | utility | request-response | `packages/db/src/client.ts` | exact |
| `packages/ld-adapter/src/launch-darkly.adapter.ts` | service | request-response | `packages/db/src/repositories/pipeline.repository.ts` | role-match |
| `packages/ld-adapter/src/variation-resolver.ts` | service | transform | `packages/db/src/repositories/pipeline.repository.ts` | role-match |
| `packages/ld-adapter/src/semantic-patch.ts` | service | request-response | `apps/worker/src/activities/persist-run-state.ts` | partial |
| `packages/ld-adapter/src/rate-limit.ts` | utility | request-response | — | no analog |
| `packages/ld-adapter/src/errors.ts` | utility | transform | `packages/db/src/repositories/promotion-run.repository.ts` | partial |
| `packages/contracts/src/launchdarkly.ts` | utility | transform | `packages/contracts/src/pipeline.ts` | exact |
| `packages/contracts/src/index.ts` | utility | transform | `packages/contracts/src/index.ts` | exact |
| `packages/ld-adapter/src/__tests__/launch-darkly.adapter.test.ts` | test | request-response | `packages/db/src/__tests__/pipeline.integration.test.ts` | role-match |
| `packages/ld-adapter/src/__tests__/variation-resolver.test.ts` | test | transform | `packages/db/src/__tests__/pipeline.integration.test.ts` | role-match |
| `packages/ld-adapter/src/__tests__/rate-limit.test.ts` | test | request-response | `packages/db/src/__tests__/smoke.test.ts` | partial |
| `vitest.config.ts` | config | batch | existing `db` / `worker` projects | exact |
| `.env.example` | config | file-I/O | existing `.env.example` | exact |
| `package.json` (root) | config | batch | root `package.json` | exact |
| `README.md` | config | file-I/O | existing `README.md` | role-match |

## Pattern Assignments

### `packages/ld-adapter/package.json` (config, batch)

**Analog:** `packages/db/package.json`

**Package manifest pattern** (lines 1-37):
```json
{
  "name": "@ff-promo/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "prisma generate && tsc",
    "test": "node -e \"process.exit(0)\"",
    "lint": "biome check src"
  },
  "dependencies": {
    "@ff-promo/contracts": "workspace:*",
    ...
  },
  "devDependencies": {
    "typescript": "~5.8.3"
  }
}
```

**Adapt for ld-adapter:**
- `"name": "@ff-promo/ld-adapter"`
- `"build": "tsc"` (no prisma step)
- `"test": "pnpm -w exec vitest run --project ld-adapter"`
- `"dependencies"`: `launchdarkly-api@20.0.0`, `@ff-promo/contracts workspace:*`, `zod@4.4.3`
- No `@ff-promo/db` dependency — adapter stays provider-only (ARCHITECTURE Pattern 3)

---

### `packages/ld-adapter/tsconfig.json` (config, transform)

**Analog:** `packages/db/tsconfig.json`

**TS config pattern** (lines 1-8):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

Copy verbatim; no package-specific overrides needed.

---

### `packages/ld-adapter/src/client.ts` (utility, request-response)

**Analog:** `packages/db/src/client.ts`

**Factory pattern** (lines 1-7):
```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/index.js';

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
```

**Adapt for LaunchDarkly:**
- Export `createLaunchDarklyClient(config: LaunchDarklyClientConfig)` returning configured `launchdarkly-api` client instance
- Read `accessToken` from config param (caller passes env); do not read `process.env` inside factory (keeps testability)
- Pin headers per STACK.md: `LD-API-Version: 20240415`, semantic-patch content type
- Single construction site — all adapter methods receive injected client (same DI style as `PrismaClient` passed to repositories)

---

### `packages/ld-adapter/src/launch-darkly.adapter.ts` (service, request-response)

**Analog:** `packages/db/src/repositories/pipeline.repository.ts`

**Class + Zod-at-boundary pattern** (lines 1-40):
```typescript
import { PipelineCreateInputSchema, type PipelineCreateInput } from '@ff-promo/contracts';
import type { PrismaClient } from '../../generated/client/index.js';

export class PipelineRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: PipelineCreateInput) {
    const data = PipelineCreateInputSchema.parse(input);

    return this.db.pipeline.create({
      data: {
        name: data.name,
        flagKey: data.flagKey,
        projectKey: data.projectKey,
        stages: {
          create: data.stages.map((stage) => ({
            ...
          })),
        },
      },
      include: { ... },
    });
  }

  async findById(id: string) {
    return this.db.pipeline.findUnique({ where: { id }, include: { ... } });
  }
}
```

**Adapt for LaunchDarklyAdapter:**
- `constructor(private readonly client: LaunchDarklyApiClient)` — inject client from `createLaunchDarklyClient`
- Parse inputs with Zod schemas from `@ff-promo/contracts` at method entry (same as repository `.parse()`)
- `getFlagState({ projectKey, flagKey, environment })` → PROV-01 read (variations, targeting rules, on/off)
- `applySemanticPatch({ projectKey, flagKey, environment, instructions })` → PROV-02 write; delegate to `semantic-patch.ts` + `rate-limit.ts`
- `resolveVariationId(...)` → delegate to `variation-resolver.ts` before any write (PROV-03)
- Return typed domain objects from contracts, not raw LD API responses

---

### `packages/ld-adapter/src/variation-resolver.ts` (service, transform)

**Analog:** `packages/db/src/repositories/pipeline.repository.ts` (lookup + validation logic)

**Validation-before-persist pattern** (pipeline.repository.ts lines 7-8, 42-52):
```typescript
async create(input: PipelineCreateInput) {
  const data = PipelineCreateInputSchema.parse(input);
  ...
}

async findById(id: string) {
  return this.db.pipeline.findUnique({
    where: { id },
    include: { ... },
  });
}
```

**Adapt for variation resolver:**
- Pure function or small class: given flag state + `{ variationName | variationIndex | value }` + `environment`, return environment-scoped variation `_id`
- Throw typed error (from `errors.ts`) when variation missing in target environment — fail before patch, never send partial patch
- Map LD per-environment variation lists; handle name/index drift across envs (ROADMAP success criterion #3)
- Unit-testable without HTTP — feed parsed `FlagStateSchema` fixtures

---

### `packages/ld-adapter/src/semantic-patch.ts` (service, request-response)

**Analog:** `apps/worker/src/activities/persist-run-state.ts` (external I/O with validation)

**Input validation + delegate pattern** (lines 1-33):
```typescript
import { PersistRunStateInputSchema } from '@ff-promo/contracts';
import {
  createPrismaClient,
  PromotionRunRepository,
  type PromotionRun,
} from '@ff-promo/db';

export async function persistRunState(
  input: Parameters<PromotionRunRepository['updateState']>[0],
): Promise<PromotionRun> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for persistRunState activity');
  }

  PersistRunStateInputSchema.parse({
    promotionRunId: input.promotionRunId,
    status: input.status,
    currentStageIndex: input.currentStageIndex,
    pauseReason: input.pauseReason,
  });

  const db = createPrismaClient(databaseUrl);
  try {
    const repo = new PromotionRunRepository(db);
    return await repo.updateState(input);
  } finally {
    await db.$disconnect();
  }
}
```

**Adapt for semantic patch:**
- Validate patch payload with `SemanticPatchInputSchema` from contracts before HTTP call
- Build LD semantic-patch body: `{ instructions: [...] }` with `kind` values from STACK.md (`updatePercentageRollout`, `turnFlagOn`, `turnFlagOff`, `addRule`, `updateRule`)
- Wrap HTTP call in `withRateLimitRetry()` from `rate-limit.ts`
- Use `SemanticPatchInputSchema` comment field for audit traceability (PITFALLS Pitfall 1 — actor attribution)
- No DB access in adapter — I/O is LD REST only

---

### `packages/ld-adapter/src/rate-limit.ts` (utility, request-response)

**Analog:** None in codebase — use STACK.md + ROADMAP criterion #4

**Expected pattern (from STACK.md lines 126-138, ROADMAP lines 66-67):**
```typescript
// Exponential backoff on 429; respect Retry-After header when present
// Do NOT retry non-idempotent partial patches — batch instructions atomically
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<T> { ... }
```

**Design constraints:**
- Retry only on 429 and transient 5xx
- Fail fast on 4xx (except 429) — do not corrupt flag state with blind retries
- Surface `LaunchDarklyRateLimitError` with `retryAfterMs` for caller logging
- Unit-test with mocked fetch/client throwing 429

---

### `packages/ld-adapter/src/errors.ts` (utility, transform)

**Analog:** `packages/db/src/repositories/promotion-run.repository.ts` (explicit throws)

**Explicit error throw pattern** (lines 41-45):
```typescript
const stage = run.pipeline.stages.find(
  (s) => s.orderIndex === input.stageIndex,
);
if (!stage) {
  throw new Error(
    `Stage orderIndex ${input.stageIndex} not found for run ${input.promotionRunId}`,
  );
}
```

**Adapt for LD errors:**
- Export typed error classes: `LaunchDarklyApiError`, `LaunchDarklyRateLimitError`, `VariationNotFoundError`, `FlagNotFoundError`
- Include `projectKey`, `flagKey`, `environment` in message for operator forensics
- Map HTTP status codes from `launchdarkly-api` client errors

---

### `packages/ld-adapter/src/index.ts` (utility, transform)

**Analog:** `packages/db/src/index.ts` + `packages/db/src/repositories/index.ts`

**Barrel + factory export pattern** (db/index.ts lines 1-8):
```typescript
export { createPrismaClient } from './client.js';
export {
  AuditRepository,
  createRepositories,
  GateResultRepository,
  PipelineRepository,
  PromotionRunRepository,
} from './repositories/index.js';
```

**Factory aggregator** (repositories/index.ts lines 12-19):
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

**Adapt for ld-adapter index.ts:**
```typescript
export { createLaunchDarklyClient } from './client.js';
export { LaunchDarklyAdapter } from './launch-darkly.adapter.js';
export { resolveVariationId } from './variation-resolver.js';
export * from './errors.js';

export function createLaunchDarklyAdapter(config: LaunchDarklyClientConfig) {
  const client = createLaunchDarklyClient(config);
  return new LaunchDarklyAdapter(client);
}
```

---

### `packages/contracts/src/launchdarkly.ts` (utility, transform)

**Analog:** `packages/contracts/src/pipeline.ts`

**Zod schema + inferred types pattern** (lines 1-31):
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

export const PipelineCreateInputSchema = z.object({
  name: z.string(),
  flagKey: z.string(),
  projectKey: z.string(),
  stages: z.array(StageInputSchema),
});

export type StageEnvironment = z.infer<typeof StageEnvironmentSchema>;
export type PipelineCreateInput = z.infer<typeof PipelineCreateInputSchema>;
```

**Adapt for launchdarkly.ts — define schemas for:**
- `FlagVariationSchema` — `{ _id, name, value }`
- `FlagEnvironmentStateSchema` — on/off, fallthrough, rules, targets
- `FlagStateSchema` — flag key + per-environment state + variations list
- `SemanticPatchInstructionSchema` — discriminated union on `kind` (updatePercentageRollout, turnFlagOn, etc.)
- `SemanticPatchInputSchema` — `{ projectKey, flagKey, environment, instructions, comment? }`
- `GetFlagStateInputSchema` — `{ projectKey, flagKey, environment }`
- Reuse `StageEnvironmentSchema` from `pipeline.ts` for environment enum consistency

---

### `packages/contracts/src/index.ts` (modified)

**Analog:** existing file (lines 1-4):
```typescript
export * from './audit.js';
export * from './gate-result.js';
export * from './pipeline.js';
export * from './promotion-run.js';
```

Add: `export * from './launchdarkly.js';`

---

### `packages/ld-adapter/src/__tests__/*.test.ts` (test)

**Analog:** `packages/db/src/__tests__/pipeline.integration.test.ts`

**Vitest integration test structure** (lines 1-20, 22-83):
```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "../client.js";
import { PipelineRepository } from "../repositories/pipeline.repository.js";
import {
	getTestDatabaseUrl,
	startTestDatabase,
	stopTestDatabase,
} from "./setup.js";

describe("PipelineRepository integration", () => {
	let dbUrl: string;

	beforeAll(async () => {
		dbUrl = await startTestDatabase();
	}, 120_000);

	afterAll(async () => {
		await stopTestDatabase();
	});

	it("persists pipeline with 3 stages...", async () => {
		const db = createPrismaClient(dbUrl);
		const repo = new PipelineRepository(db);
		...
		await db.$disconnect();
	});
});
```

**Adapt for ld-adapter tests:**
- **Unit tests (default):** mock `launchdarkly-api` client; no testcontainers; no live LD API in CI
- Use `describe`/`it`/`expect` from vitest; single quotes in production code, tests may use double quotes (Biome accepts both in existing db tests)
- `variation-resolver.test.ts` — pure fixtures, no mocks
- `rate-limit.test.ts` — mock fn throwing 429 then succeeding
- `launch-darkly.adapter.test.ts` — mock client returning fixture flag JSON; assert patch payload shape
- Optional `SKIP_LD_INTEGRATION=1` guard for manual live-LD integration tests (mirror `SKIP_TESTCONTAINERS` in db setup)

---

### `vitest.config.ts` (modified)

**Analog:** existing `db` project (lines 4-13):
```typescript
test: {
  projects: [
    {
      extends: true,
      test: {
        name: "db",
        root: "./packages/db",
        include: ["src/**/*.test.ts"],
      },
    },
    ...
  ],
},
```

**Add ld-adapter project:**
```typescript
{
  extends: true,
  test: {
    name: "ld-adapter",
    root: "./packages/ld-adapter",
    include: ["src/**/*.test.ts"],
  },
},
```

---

### `.env.example` (modified)

**Analog:** existing file (lines 1-3):
```
DATABASE_URL=postgresql://ffpromo:ffpromo@localhost:5432/ffpromo
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_TASK_QUEUE=promotion
```

**Add (no real tokens):**
```
LD_API_TOKEN=
LD_API_VERSION=20240415
LD_PROJECT_KEY=default
```

---

## Shared Patterns

### Zod validation at package boundaries
**Source:** `packages/db/src/repositories/audit.repository.ts` (lines 10-11)
**Apply to:** All adapter public methods, semantic patch builder, variation resolver inputs
```typescript
async append(input: AuditEventInput) {
  const data = AuditEventInputSchema.parse(input);
  ...
}
```

### Constructor dependency injection
**Source:** `packages/db/src/repositories/pipeline.repository.ts` (line 5)
**Apply to:** `LaunchDarklyAdapter` — inject API client, never construct inside methods
```typescript
export class PipelineRepository {
  constructor(private readonly db: PrismaClient) {}
}
```

### ESM import paths with `.js` extension
**Source:** All `packages/db/src/**/*.ts` files
**Apply to:** All ld-adapter imports
```typescript
import { LaunchDarklyAdapter } from './launch-darkly.adapter.js';
```

### Package naming and workspace protocol
**Source:** `packages/db/package.json` (line 22)
**Apply to:** ld-adapter depends on contracts only via `workspace:*`
```json
"@ff-promo/contracts": "workspace:*"
```

### Provider adapter boundary (no engine/DB coupling)
**Source:** `.planning/research/ARCHITECTURE.md` Pattern 3 (lines 176-195)
**Apply to:** Entire ld-adapter package — no imports from `@ff-promo/db` or `apps/worker`
```typescript
interface FlagProvider {
  getFlag(projectKey: string, flagKey: string, env: string): Promise<FlagState>;
  applyStage(run: PromotionRun, stage: StageDefinition): Promise<void>;
}
```
Phase 2 implements the LD concrete type; Phase 4 wires it into worker activities.

### Semantic patch headers (LaunchDarkly-specific)
**Source:** `.planning/research/STACK.md` (lines 126-138)
**Apply to:** `client.ts` default headers on every write
```http
Authorization: <access-token>
Content-Type: application/json; domain-model=launchdarkly.semanticpatch
LD-API-Version: 20240415
```

### Re-read before write (drift safety)
**Source:** `.planning/research/PITFALLS.md` Pitfall 1 (lines 17-21)
**Apply to:** `launch-darkly.adapter.ts` — always call `getFlagState` before `applySemanticPatch`; variation resolver runs on fresh read
> On every gate evaluation cycle, **re-read actual LD flag state** and reconcile with expected state before advancing

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/ld-adapter/src/rate-limit.ts` | utility | request-response | No HTTP retry/backoff utilities in codebase; first external API adapter |
| `packages/ld-adapter/src/semantic-patch.ts` | service | request-response | No REST client or semantic-patch usage anywhere; derive from STACK.md LD instructions |
| `packages/ld-adapter/src/__tests__/rate-limit.test.ts` | test | request-response | No mock-HTTP test patterns yet; use vitest vi.fn stubbing (new for repo) |

**Planner fallback for no-analog files:** Use STACK.md LaunchDarkly Integration Details (lines 117-140) and ARCHITECTURE.md Pattern 3 FlagProvider interface (lines 185-189). Do **not** use `@launchdarkly/node-server-sdk` — evaluation SDK is explicitly forbidden (STACK.md What NOT to Use).

---

## Metadata

**Analog search scope:** `packages/db/`, `packages/contracts/`, `apps/worker/src/activities/`, `vitest.config.ts`, `.planning/research/`
**Files scanned:** ~35 source files across packages and worker
**Pattern extraction date:** 2026-06-21
