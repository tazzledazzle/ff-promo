# Phase 3: Telemetry Adapter - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 24
**Analogs found:** 22 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/telemetry/package.json` | config | — | `packages/ld-adapter/package.json` | exact |
| `packages/telemetry/tsconfig.json` | config | — | `packages/ld-adapter/tsconfig.json` | exact |
| `packages/telemetry/src/index.ts` | route | — | `packages/ld-adapter/src/index.ts` | exact |
| `packages/telemetry/src/client/prometheus-client.ts` | service | request-response | `packages/ld-adapter/src/client/ld-api-client.ts` | exact |
| `packages/telemetry/src/query/build-promql.ts` | utility | transform | `packages/ld-adapter/src/write/semantic-patch.ts` | role-match |
| `packages/telemetry/src/query/parse-response.ts` | utility | transform | `packages/ld-adapter/src/read/mappers.ts` (parsing) | role-match |
| `packages/telemetry/src/evaluate/evaluate-gate-policy.ts` | service | request-response | `packages/ld-adapter/src/resolve/variation-resolver.ts` | role-match |
| `packages/telemetry/src/evaluate/evaluate-stage-gates.ts` | service | batch | `packages/ld-adapter/src/provider/launch-darkly-provider.ts` | partial |
| `packages/telemetry/src/preflight/run-preflight.ts` | service | request-response | `packages/ld-adapter/src/provider/launch-darkly-provider.ts` | partial |
| `packages/telemetry/src/errors/telemetry-adapter-error.ts` | utility | — | `packages/ld-adapter/src/errors/ld-adapter-error.ts` | exact |
| `packages/contracts/src/telemetry.ts` | model | — | `packages/contracts/src/launchdarkly.ts` | exact |
| `packages/contracts/src/index.ts` | config | — | `packages/contracts/src/index.ts` | exact |
| `vitest.config.ts` | config | — | existing `ld-adapter` project block | exact |
| `.env.example` | config | — | `.env.example` (LD vars) | exact |
| `packages/telemetry/src/__tests__/prometheus-client.test.ts` | test | — | `packages/ld-adapter/src/__tests__/ld-api-client.test.ts` | exact |
| `packages/telemetry/src/__tests__/promql-builder.test.ts` | test | — | `packages/ld-adapter/src/__tests__/semantic-patch-builder.test.ts` | exact |
| `packages/telemetry/src/__tests__/evaluate-gate-policy.test.ts` | test | — | `packages/ld-adapter/src/__tests__/variation-resolver.test.ts` | role-match |
| `packages/telemetry/src/__tests__/evaluate-stage-gates.test.ts` | test | — | `packages/ld-adapter/src/__tests__/semantic-patch-builder.test.ts` | role-match |
| `packages/telemetry/src/__tests__/run-preflight.test.ts` | test | — | `packages/ld-adapter/src/__tests__/launch-darkly-provider.test.ts` | exact |
| `packages/telemetry/src/__tests__/fixtures/*.json` | test | file-I/O | `packages/ld-adapter/src/__tests__/fixtures/` | exact |
| `packages/db/src/__tests__/pipeline.integration.test.ts` | test | CRUD | self (metricType string only) | exact |
| `packages/db/src/__tests__/gate-result.integration.test.ts` | test | CRUD | self (metricType string only) | exact |
| `docker-compose.yml` (optional prometheus profile) | config | — | existing `postgres`/`temporal` services | partial |
| `apps/worker/src/activities/evaluate-gate.ts` | service | CRUD | — (Phase 4 only; not modified in Phase 3) | no analog needed |

## Pattern Assignments

### `packages/telemetry/package.json` (config)

**Analog:** `packages/ld-adapter/package.json`

**Package scaffold pattern** (lines 1-27):

```json
{
  "name": "@ff-promo/ld-adapter",
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
    "build": "tsc",
    "test": "pnpm -w exec vitest run --project ld-adapter",
    "lint": "biome check src"
  },
  "dependencies": {
    "@ff-promo/contracts": "workspace:*",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "nock": "14.0.15",
    "typescript": "~5.8.3"
  }
}
```

**Apply:** Name `@ff-promo/telemetry`; add `p-retry@8.0.0` as optional dependency (mirror ld-adapter); test script uses `--project telemetry`.

---

### `packages/telemetry/tsconfig.json` (config)

**Analog:** `packages/ld-adapter/tsconfig.json`

**Tsconfig pattern** (lines 1-9):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

---

### `packages/telemetry/src/index.ts` (route / public exports)

**Analog:** `packages/ld-adapter/src/index.ts`

**Barrel export pattern** (lines 1-21):

```typescript
export { createLaunchDarklyClient, SEMANTIC_PATCH_CONTENT_TYPE } from './client/ld-api-client.js';
export { createRateLimitedLdClient } from './client/rate-limited-client.js';
export {
	ApprovalRequiredError,
	LdAdapterError,
	LdApiError,
	LdRateLimitError,
	UnresolvedRuleError,
	UnresolvedVariationError,
} from './errors/ld-adapter-error.js';
export type { FlagProvider } from './provider/flag-provider.js';
export {
	createLaunchDarklyProvider,
	LaunchDarklyProvider,
} from './provider/launch-darkly-provider.js';
```

**Apply:** Export `createPrometheusClient`, `evaluateGatePolicy`, `evaluateStageGates`, `runPreflightChecks`, error classes, and contract types re-exported from `@ff-promo/contracts`. Use `.js` extensions in import paths (NodeNext ESM).

---

### `packages/telemetry/src/client/prometheus-client.ts` (service, request-response)

**Analog:** `packages/ld-adapter/src/client/ld-api-client.ts`

**Imports + config-injected factory** (lines 1-36):

```typescript
import { LaunchDarklyClientConfigSchema } from '@ff-promo/contracts';
import type { LaunchDarklyClientConfig } from '@ff-promo/contracts';
import LaunchDarklyApi from 'launchdarkly-api';

export const DEFAULT_LD_BASE_URL = 'https://app.launchdarkly.com';
export const DEFAULT_LD_API_VERSION = '20240415';

export function createLaunchDarklyClient(
	configInput: LaunchDarklyClientConfig,
): LaunchDarklyRawClient {
	const config = LaunchDarklyClientConfigSchema.parse(configInput);
	const baseUrl = config.baseUrl ?? process.env.LD_BASE_URL ?? DEFAULT_LD_BASE_URL;
	const apiVersion = config.apiVersion ?? DEFAULT_LD_API_VERSION;

	const apiClient = LaunchDarklyApi.ApiClient.instance;
	apiClient.basePath = baseUrl.replace(/\/+$/, '');
	apiClient.authentications.ApiKey!.apiKey = config.accessToken;
	apiClient.defaultHeaders['LD-API-Version'] = apiVersion;

	return {
		flagsApi,
		config: { ...config, baseUrl: apiClient.basePath, apiVersion },
	};
}
```

**Apply:** Replace with `PrometheusClientConfigSchema.parse(configInput)`; env fallback only here (`PROMETHEUS_BASE_URL`, `PROMETHEUS_BEARER_TOKEN`); use native `fetch` to `GET /api/v1/query`; strip trailing slashes on `baseUrl`; return `{ config, queryInstant }` object (no SDK). Throw `TelemetryApiError` on non-2xx or `status: "error"` envelope.

**Optional retry:** Mirror `packages/ld-adapter/src/client/rate-limited-client.ts` lines 141-162 for 503 retries via `p-retry` — only wrap `queryInstant`, not evaluators.

---

### `packages/telemetry/src/query/build-promql.ts` (utility, transform)

**Analog:** `packages/ld-adapter/src/write/semantic-patch.ts`

**Pure builder with validation** (lines 1-32):

```typescript
import {
	SemanticPatchInstructionSchema,
	type RolloutIntent,
	type SemanticPatchInstruction,
	type TargetingIntent,
} from '@ff-promo/contracts';

export function buildRolloutWeights(
	treatmentThousandths: number,
	treatmentVariationId: string,
	controlVariationId: string,
): Record<string, number> {
	if (treatmentThousandths < 0 || treatmentThousandths > 100_000) {
		throw new Error('treatmentThousandths must be between 0 and 100000');
	}
	const controlThousandths = 100_000 - treatmentThousandths;
	const weights = {
		[treatmentVariationId]: treatmentThousandths,
		[controlVariationId]: controlThousandths,
	};
	const sum = Object.values(weights).reduce((acc, value) => acc + value, 0);
	if (sum !== 100_000) {
		throw new Error(`rollout weights must sum to 100000, got ${sum}`);
	}
	return weights;
}
```

**Apply:** Export `escapePromqlLabelValue()`, `buildErrorRateQuery()`, `buildLatencyP95Query()`, `buildSampleCountQuery()` taking `GatePolicyInput` + `GateRunContext`. No `process.env`; no HTTP. Switch on canonical `metricType`: `error_rate`, `latency_p95`; reject unknown with throw or caller maps to `unsupported_metric_type`. Label base from RESEARCH: `service`, `ld_flag_key`, `ld_variation_id`, `ld_context_kind="user"`.

---

### `packages/telemetry/src/query/parse-response.ts` (utility, transform)

**Analog:** `packages/ld-adapter/src/read/mappers.ts` (response → domain mapping)

**Apply:** Pure functions `parseInstantQueryResult(body)` handling `vector` and `scalar` result types. Fail-closed mapping per RESEARCH Pitfall 1–2: empty `result: []` → `{ ok: false, reason: 'no_data' }`; `"NaN"`/`"+Inf"` → `{ ok: false, reason: 'non_finite_value' }`. No env access. Return `{ ok: true, value: number }` for successful parses.

---

### `packages/telemetry/src/evaluate/evaluate-gate-policy.ts` (service, request-response)

**Analog:** `packages/ld-adapter/src/resolve/variation-resolver.ts`

**Fail-closed single-policy evaluation** (lines 8-40):

```typescript
export function resolveVariationId(
	flagState: FlagState,
	ref: VariationRef,
): string {
	const matches = flagState.variations.filter((variation) => {
		switch (ref.by) {
			case 'id':
				return variation.id === ref.id;
			// ...
		}
	});

	if (matches.length !== 1) {
		throw new UnresolvedVariationError(
			`Expected exactly one variation match, found ${matches.length}`,
			{ ref, flagKey: flagState.flagKey, projectKey: flagState.projectKey },
		);
	}
	// ...
	return match.id;
}
```

**Apply:** Accept `(client, policy: GatePolicyInput, runContext: GateRunContext)` — no DB. Run treatment + control queries + sample count queries via client. Compute delta = treatment − control; fail when delta > threshold OR parse failure OR sample count < `minSampleSize`. Return `GateEvaluationResult` (from contracts) with `verdict: 'pass' | 'fail'`, `observedDelta`, `treatmentValue`, `controlValue`, `metadata.reason`. Ignore `comparisonMode` (always delta-vs-control per D-02).

**GateResult mapping reference** — `packages/contracts/src/gate-result.ts` (lines 5-13):

```typescript
export const GateResultCreateInputSchema = z.object({
  promotionRunId: z.string(),
  stageId: z.string(),
  verdict: GateVerdictSchema,
  metricType: z.string(),
  observedValue: z.number().optional(),
  threshold: z.number(),
  metadata: z.record(z.string(), z.unknown()),
});
```

Adapter returns evaluation DTOs; worker maps to `GateResultCreateInput` in Phase 4.

---

### `packages/telemetry/src/evaluate/evaluate-stage-gates.ts` (service, batch)

**Analog:** `packages/ld-adapter/src/provider/launch-darkly-provider.ts`

**Orchestrator factory pattern** (lines 35-40):

```typescript
export function createLaunchDarklyProvider(
	config: LaunchDarklyClientConfig,
): LaunchDarklyProvider {
	const rawClient = createLaunchDarklyClient(config);
	const rateLimitedClient = createRateLimitedLdClient(rawClient);
	return new LaunchDarklyProvider(rawClient, rateLimitedClient);
}
```

**Apply:** `evaluateStageGates(client, policies: GatePolicyInput[], runContext)` loops policies calling `evaluateGatePolicy`; stage verdict fails if **any** policy fails (D-09). Return `{ verdict, results: GateEvaluationResult[] }`. Accept config or pre-built client — prefer `(client, ...)` for testability (inject nock-backed client in tests).

---

### `packages/telemetry/src/preflight/run-preflight.ts` (service, request-response)

**Analog:** `packages/ld-adapter/src/provider/launch-darkly-provider.ts` (orchestration) + evaluate helpers

**Apply:** Reuse `buildPromql` + `parseInstantQueryResult` + sample count logic from evaluate module. Return `PreflightReport` per RESEARCH (status, checks[], blockReason). Use **max** `minSampleSize` across policies for preflight sample checks. No persistence (D-12). Fail closed on missing treatment/control series or missing `ld_context_kind=user` data.

---

### `packages/telemetry/src/errors/telemetry-adapter-error.ts` (utility)

**Analog:** `packages/ld-adapter/src/errors/ld-adapter-error.ts`

**Error hierarchy** (lines 1-46):

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

export class LdApiError extends LdAdapterError {
	constructor(
		message: string,
		readonly status: number,
		readonly body?: unknown,
		context?: Record<string, unknown>,
	) {
		super(message, context);
		this.name = 'LdApiError';
	}
}
```

**Apply:** `TelemetryAdapterError` base; `TelemetryApiError` (HTTP/envelope failures); optional `UnsupportedMetricTypeError`. Include `context` for forensics; never log bearer token in context.

---

### `packages/contracts/src/telemetry.ts` (model)

**Analog:** `packages/contracts/src/launchdarkly.ts`

**Zod schema + inferred types pattern** (lines 89-110):

```typescript
export const LaunchDarklyClientConfigSchema = z.object({
	accessToken: z.string(),
	baseUrl: z.string().url().optional(),
	apiVersion: z.string().optional(),
});

export type LaunchDarklyClientConfig = z.infer<
	typeof LaunchDarklyClientConfigSchema
>;
```

**GatePolicy input reference** — `packages/contracts/src/pipeline.ts` (lines 5-12):

```typescript
export const GatePolicyInputSchema = z.object({
  metricType: z.string(),
  threshold: z.number(),
  serviceName: z.string(),
  comparisonMode: z.string().optional(),
  windowSeconds: z.number().int().optional(),
  minSampleSize: z.number().int().optional(),
});
```

**Apply:** Add schemas: `PrometheusClientConfigSchema`, `GateRunContextSchema`, `GateEvaluationResultSchema`, `PreflightReportSchema`, `PreflightCheckSchema`. Reuse `GatePolicyInput` type from pipeline — do not duplicate GatePolicy schema. Export inferred types at bottom of file.

---

### `packages/contracts/src/index.ts` (config)

**Analog:** self

**Barrel pattern** (lines 1-5):

```typescript
export * from './audit.js';
export * from './gate-result.js';
export * from './launchdarkly.js';
export * from './pipeline.js';
export * from './promotion-run.js';
```

**Apply:** Add `export * from './telemetry.js';`

---

### `vitest.config.ts` (config)

**Analog:** existing `ld-adapter` project block

**Project registration** (lines 22-29):

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

**Apply:** Duplicate block with `name: "telemetry"`, `root: "./packages/telemetry"`.

---

### `.env.example` (config)

**Analog:** `.env.example`

**Env var documentation pattern** (lines 1-7):

```
DATABASE_URL=postgresql://ffpromo:ffpromo@localhost:5432/ffpromo
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_TASK_QUEUE=promotion
LD_ACCESS_TOKEN=
LD_BASE_URL=https://app.launchdarkly.com
LD_API_VERSION=20240415
LD_PROJECT_KEY=default
```

**Apply:** Append `PROMETHEUS_BASE_URL=http://localhost:9090` and `PROMETHEUS_BEARER_TOKEN=` (optional).

---

### `packages/telemetry/src/__tests__/prometheus-client.test.ts` (test)

**Analog:** `packages/ld-adapter/src/__tests__/ld-api-client.test.ts`

**Unit test for factory** (lines 1-28):

```typescript
import { afterEach, describe, expect, it } from 'vitest';
import {
	createLaunchDarklyClient,
	DEFAULT_LD_API_VERSION,
} from '../client/ld-api-client.js';

describe('createLaunchDarklyClient', () => {
	afterEach(() => {
		const apiClient = LaunchDarklyApi.ApiClient.instance;
		delete apiClient.defaultHeaders['LD-API-Version'];
	});

	it('sets LD-API-Version header and respects baseUrl override', () => {
		createLaunchDarklyClient({
			accessToken: 'test-token',
			baseUrl: 'https://app.eu.launchdarkly.com',
		});
		// assertions on config
	});
});
```

**Apply:** Test `createPrometheusClient` sets normalized baseUrl, bearer header when token provided, env fallback. Use nock for `queryInstant` HTTP contract tests in same file or separate integration-style tests.

---

### `packages/telemetry/src/__tests__/run-preflight.test.ts` + nock integration tests (test)

**Analog:** `packages/ld-adapter/src/__tests__/launch-darkly-provider.test.ts`

**Fixture loading + nock lifecycle** (lines 1-37):

```typescript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import nock from 'nock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const baseUrl = 'https://app.launchdarkly.com';
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const flagFixture = JSON.parse(
	readFileSync(join(fixturesDir, 'flag-boolean.json'), 'utf8'),
);

describe('LaunchDarklyProvider nock integration', () => {
	beforeEach(() => {
		nock.cleanAll();
	});

	afterEach(() => {
		nock.cleanAll();
	});

	it('PROV-01: reads flag state from GET fixture', async () => {
		nock(baseUrl)
			.get('/api/v2/flags/default/sample-feature')
			.reply(200, flagFixture);
		// ...
		expect(nock.isDone()).toBe(true);
	});
});
```

**Apply:** `baseUrl = 'http://localhost:9090'`; intercept `GET /api/v1/query`; load fixtures from `src/__tests__/fixtures/` (vector pass, empty vector, scalar, error envelope, NaN value). Assert `nock.isDone()` in every HTTP test. Tag tests with TELE-03/TELE-04 requirement IDs in describe/it names.

---

### `packages/telemetry/src/__tests__/promql-builder.test.ts` (test)

**Analog:** `packages/ld-adapter/src/__tests__/semantic-patch-builder.test.ts`

**Pure function unit tests** (lines 1-38):

```typescript
import { describe, expect, it } from 'vitest';
import { buildRolloutWeights, buildTargetingPatchBody } from '../write/semantic-patch.js';

describe('semantic patch builders', () => {
	it('buildRolloutWeights returns weights summing to 100000', () => {
		const weights = buildRolloutWeights(10_000, 'var-on', 'var-off');
		expect(weights).toEqual({ 'var-on': 10_000, 'var-off': 90_000 });
	});
});
```

**Apply:** Test label escaping (`"` and `\` in flagKey), window suffix `[300s]`, cohort label selectors, canonical metric types only.

---

### `packages/telemetry/src/__tests__/evaluate-gate-policy.test.ts` (test)

**Analog:** `packages/ld-adapter/src/__tests__/variation-resolver.test.ts`

**Fail-closed assertion pattern** (lines 32-36):

```typescript
it('throws UnresolvedVariationError when zero matches', () => {
	expect(() =>
		resolveVariationId(flagState, { by: 'value', value: 'missing' }),
	).toThrow(UnresolvedVariationError);
});
```

**Apply:** nock-backed tests for pass, threshold exceeded, empty result (`no_data`), insufficient samples, latency_p95 pass/fail. Assert verdict + metadata.reason codes without DB.

---

### `packages/telemetry/src/__tests__/evaluate-stage-gates.test.ts` (test)

**Analog:** `packages/ld-adapter/src/__tests__/semantic-patch-builder.test.ts` (multi-scenario pure logic)

**Apply:** Unit test with mocked client returning canned results — verify D-09 "all must pass": one failing policy fails stage even if others pass.

---

### `packages/db/src/__tests__/pipeline.integration.test.ts` + `gate-result.integration.test.ts` (test, modify)

**Analog:** `packages/db/src/seed.ts` (canonical metric types)

**Seed baseline** (lines 14-27):

```typescript
const GATE_POLICIES = [
  {
    metricType: 'error_rate',
    threshold: 0.01,
    serviceName: 'demo-service',
    windowSeconds: 300,
  },
  {
    metricType: 'latency_p95',
    threshold: 500,
    serviceName: 'demo-service',
    windowSeconds: 300,
  },
] as const;
```

**Apply:** Replace `p95_latency_ms` with `latency_p95` in integration test fixtures (pipeline.integration.test.ts line 61; gate-result.integration.test.ts line 110).

---

### `docker-compose.yml` (optional prometheus profile)

**Analog:** existing service definitions

**Service pattern** (lines 1-25):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ffpromo
    ports:
      - "5432:5432"
```

**Apply:** Add `prometheus` service under `profiles: [prometheus]` with `prom/prometheus` image and minimal `prometheus.yml` volume mount. Document `docker compose --profile prometheus up`. No CI dependency.

---

## Shared Patterns

### Config-Injected Client Factory (env fallback at boundary only)

**Source:** `packages/ld-adapter/src/client/ld-api-client.ts` lines 19-24
**Apply to:** `prometheus-client.ts`, public `createPrometheusClient()` export

```typescript
export function createLaunchDarklyClient(
	configInput: LaunchDarklyClientConfig,
): LaunchDarklyRawClient {
	const config = LaunchDarklyClientConfigSchema.parse(configInput);
	const baseUrl = config.baseUrl ?? process.env.LD_BASE_URL ?? DEFAULT_LD_BASE_URL;
```

Evaluators and PromQL builders must **not** read `process.env`.

---

### Zod Validation at Boundaries

**Source:** `packages/contracts/src/launchdarkly.ts` + all ld-adapter entry points
**Apply to:** `telemetry.ts` schemas; parse config and run context in client factory and top-level evaluate/preflight functions

---

### Fail-Closed Error Taxonomy

**Source:** `packages/ld-adapter/src/resolve/variation-resolver.ts` lines 25-29
**Apply to:** All gate evaluation and preflight — missing data = fail, never pass

```typescript
if (matches.length !== 1) {
	throw new UnresolvedVariationError(
		`Expected exactly one variation match, found ${matches.length}`,
		{ ref, flagKey: flagState.flagKey, projectKey: flagState.projectKey },
	);
}
```

Gate failures return structured `{ verdict: 'fail', metadata: { reason: 'no_data' | ... } }` rather than throwing for expected fail-closed paths; reserve throws for HTTP/parse errors.

---

### Contracts Boundary (adapter ↔ worker)

**Source:** `packages/contracts/src/pipeline.ts` + `gate-result.ts`
**Apply to:** Adapter accepts `GatePolicyInput[]` + `GateRunContext`; returns evaluation DTOs. Persistence stays in worker (`apps/worker/src/activities/evaluate-gate.ts` stub — Phase 4 replaces stub, Phase 3 does not modify).

**Worker stub reference** (lines 13-16, 47-56):

```typescript
/**
 * Stub gate evaluation (D-11) — always returns pass with mock metrics.
 */
// ...
const gateResult = await gateResultRepo.create({
  promotionRunId: input.promotionRunId,
  stageId: stage.id,
  verdict: 'pass',
  metricType: 'error_rate',
  observedValue: 0.001,
  threshold: 0.01,
  metadata: { stub: true, message: 'Phase 1 mock pass' },
});
```

---

### nock HTTP Test Harness

**Source:** `packages/ld-adapter/src/__tests__/launch-darkly-provider.test.ts`
**Apply to:** All telemetry HTTP tests — `beforeEach`/`afterEach` `nock.cleanAll()`, JSON fixtures via `readFileSync`, assert `nock.isDone()`

---

### ESM Import Conventions

**Source:** entire `packages/ld-adapter`
**Apply to:** All telemetry source — `.js` extensions in relative imports; `"type": "module"`; extends `tsconfig.base.json` with NodeNext

---

### GatePolicy Schema (read-only, no migration)

**Source:** `packages/db/prisma/schema.prisma` lines 75-87

```prisma
model GatePolicy {
  id             String @id @default(cuid())
  stageId        String
  metricType     String
  threshold      Float
  comparisonMode String @default("absolute")
  windowSeconds  Int    @default(300)
  minSampleSize  Int    @default(0)
  serviceName    String
}
```

Phase 3 reads via `GatePolicyInput` DTO; ignore `comparisonMode` at runtime (always delta).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/telemetry/src/query/parse-response.ts` | utility | transform | No Prometheus response parser exists; follow RESEARCH fail-closed table + ld-adapter mapper style |
| `docker-compose.yml` prometheus profile | config | — | No Prometheus service yet; partial match to postgres/temporal service blocks only |

## Metadata

**Analog search scope:** `packages/ld-adapter/`, `packages/contracts/`, `packages/db/`, `apps/worker/src/activities/`, root `vitest.config.ts`, `.env.example`, `docker-compose.yml`
**Files scanned:** 64 under `packages/` + worker activity + root config
**Pattern extraction date:** 2026-06-22
