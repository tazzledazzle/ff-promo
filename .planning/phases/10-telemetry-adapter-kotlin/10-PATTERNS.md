# Phase 10: Telemetry Adapter (Kotlin) - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 28 new/modified files (Phase 10 scope)
**Analogs found:** 24 / 28
**Upstream context:** Phase 9 Kotlin ld-adapter (`09-PATTERNS.md`); v1 behavioral reference `packages/telemetry/src/**` + `packages/contracts/src/telemetry.ts`.

## Recommended Layout

Phase 10 adds **`kotlin/modules/telemetry`** — a Kotlin port of `@ff-promo/telemetry` with telemetry contract DTOs moved into `kotlin/modules/contracts`. Gradle registers the new module; v1 TypeScript packages remain unchanged.

```
kotlin/
  settings.gradle.kts                     # MOD: include telemetry module
  modules/
    contracts/
      src/main/kotlin/com/ffpromo/contracts/
        Telemetry.kt                      # NEW: port telemetry.ts (deferred Phase 8)
      src/test/kotlin/com/ffpromo/contracts/
        TelemetryJsonTest.kt              # NEW: golden JSON round-trip tests
    telemetry/
      build.gradle.kts                    # NEW: depends on contracts; OkHttp + coroutines
      src/main/kotlin/com/ffpromo/telemetry/
        TelemetryModule.kt                # NEW: barrel exports (mirror index.ts)
        errors/
          TelemetryAdapterError.kt        # NEW: port telemetry-adapter-error.ts
        client/
          PrometheusClient.kt             # NEW: port prometheus-client.ts
        query/
          BuildPromql.kt                  # NEW: port build-promql.ts
          ParseResponse.kt                # NEW: port parse-response.ts
        evaluate/
          EvaluateGatePolicy.kt           # NEW: port evaluate-gate-policy.ts
          EvaluateStageGates.kt           # NEW: port evaluate-stage-gates.ts
        preflight/
          RunPreflight.kt                 # NEW: port run-preflight.ts
      src/test/kotlin/com/ffpromo/telemetry/
        fixtures/
          prometheus-*.json               # COPY: from packages/telemetry fixtures
        PrometheusClientTest.kt
        BuildPromqlTest.kt
        ParseResponseTest.kt
        EvaluateGatePolicyTest.kt
        EvaluateStageGatesTest.kt
        RunPreflightTest.kt
        TelemetryIntegrationTest.kt       # NEW: MockWebServer HTTP integration (mirror nock)
```

**Unchanged:** `apps/api`, `packages/telemetry` (v1 reference), `pnpm run build` at repo root.

**Worker dependency (Phase 11):** `kotlin/modules/worker` will depend on `:telemetry` for gate evaluation and preflight activities — do not wire in Phase 10 unless plan explicitly includes stub import.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `kotlin/settings.gradle.kts` | config | — | Phase 9 `settings.gradle.kts` | exact (extend) |
| `kotlin/modules/contracts/.../Telemetry.kt` | model | transform | `packages/contracts/src/telemetry.ts` | exact (port) |
| `kotlin/modules/contracts/.../TelemetryJsonTest.kt` | test | transform | `ContractsJsonTest.kt` + v1 wire JSON | role-match |
| `kotlin/modules/telemetry/build.gradle.kts` | config | — | `kotlin/modules/ld-adapter/build.gradle.kts` | role-match |
| `kotlin/modules/telemetry/.../TelemetryAdapterError.kt` | utility | transform | `errors/telemetry-adapter-error.ts` | exact (port) |
| `kotlin/modules/telemetry/.../PrometheusClient.kt` | service | request-response | `client/prometheus-client.ts` | exact (port) |
| `kotlin/modules/telemetry/.../BuildPromql.kt` | utility | transform | `query/build-promql.ts` | exact (port) |
| `kotlin/modules/telemetry/.../ParseResponse.kt` | utility | transform | `query/parse-response.ts` | exact (port) |
| `kotlin/modules/telemetry/.../EvaluateGatePolicy.kt` | service | request-response | `evaluate/evaluate-gate-policy.ts` | exact (port) |
| `kotlin/modules/telemetry/.../EvaluateStageGates.kt` | service | request-response | `evaluate/evaluate-stage-gates.ts` | exact (port) |
| `kotlin/modules/telemetry/.../RunPreflight.kt` | service | request-response | `preflight/run-preflight.ts` | exact (port) |
| `kotlin/modules/telemetry/.../TelemetryModule.kt` | utility | transform | `index.ts` barrel | exact (port) |
| `kotlin/modules/telemetry/.../PrometheusClientTest.kt` | test | request-response | `__tests__/prometheus-client.test.ts` | exact (port) |
| `kotlin/modules/telemetry/.../BuildPromqlTest.kt` | test | transform | `__tests__/promql-builder.test.ts` | exact (port) |
| `kotlin/modules/telemetry/.../ParseResponseTest.kt` | test | transform | `__tests__/parse-response.test.ts` | exact (port) |
| `kotlin/modules/telemetry/.../EvaluateGatePolicyTest.kt` | test | request-response | `__tests__/evaluate-gate-policy.test.ts` | exact (port) |
| `kotlin/modules/telemetry/.../EvaluateStageGatesTest.kt` | test | request-response | `__tests__/evaluate-stage-gates.test.ts` | exact (port) |
| `kotlin/modules/telemetry/.../RunPreflightTest.kt` | test | request-response | `__tests__/run-preflight.test.ts` | exact (port) |
| `kotlin/modules/telemetry/.../TelemetryIntegrationTest.kt` | test | request-response | `__tests__/telemetry-integration.test.ts` | exact (port) |
| `kotlin/modules/telemetry/.../fixtures/*.json` | test | file-I/O | `packages/telemetry/src/__tests__/fixtures/` | exact (copy) |
| root `package.json` `"build:kotlin"` / `"test:kotlin"` | config | — | existing Phase 8/9 scripts | role-match |

---

## Pattern Assignments

### Gradle module registration (`settings.gradle.kts`, `telemetry/build.gradle.kts`)

**Analog:** Phase 9 module wiring — `kotlin/settings.gradle.kts` + `kotlin/modules/ld-adapter/build.gradle.kts`

**Extend settings** — mirror `:ld-adapter` projectDir pattern:

```kotlin
// kotlin/settings.gradle.kts (add)
include("telemetry")
project(":telemetry").projectDir = file("modules/telemetry")
```

**Module dependencies** — contracts-only at runtime; OkHttp + coroutines like `:ld-adapter` (no LaunchDarkly client):

```kotlin
// kotlin/modules/telemetry/build.gradle.kts
plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
}

dependencies {
    implementation(project(":contracts"))

    implementation("com.squareup.okhttp3:okhttp:${property("okhttpVersion")}")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:${property("kotlinxCoroutinesVersion")}")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:${property("kotlinxSerializationVersion")}")

    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("com.squareup.okhttp3:mockwebserver:${property("okhttpVersion")}")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:${property("kotlinxCoroutinesVersion")}")
}
```

**HTTP client choice:** v1 uses raw `fetch` to Prometheus `/api/v1/query`. **Authoritative stack:** OkHttp + `withContext(Dispatchers.IO)` per `LdApiClient.kt` — no Prometheus Java client library.

---

### `kotlin/modules/contracts/.../Telemetry.kt` (model, transform)

**Analog:** `packages/contracts/src/telemetry.ts` (lines 1-54); Kotlin serialization from `Pipeline.kt` + `GateResult.kt`

**Enum + DTO pattern** — replace Zod with `@Serializable`:

```typescript
// packages/contracts/src/telemetry.ts lines 18-26
export const GateEvaluationResultSchema = z.object({
  verdict: GateVerdictResultSchema,
  metricType: z.string(),
  observedDelta: z.number().optional(),
  treatmentValue: z.number().optional(),
  controlValue: z.number().optional(),
  threshold: z.number(),
  metadata: z.record(z.string(), z.unknown()),
});
```

**Kotlin target:**

```kotlin
@Serializable
enum class GateVerdictResult {
    @SerialName("pass") pass,
    @SerialName("fail") fail,
}

@Serializable
data class GateEvaluationResult(
    val verdict: GateVerdictResult,
    val metricType: String,
    val observedDelta: Double? = null,
    val treatmentValue: Double? = null,
    val controlValue: Double? = null,
    val threshold: Double,
    val metadata: Map<String, JsonElement> = emptyMap(),
)
```

**Types to port 1:1 from `telemetry.ts`:**

| Kotlin type | v1 schema | Notes |
|-------------|-----------|-------|
| `PrometheusClientConfig` | `PrometheusClientConfigSchema` | optional `baseUrl`, `bearerToken`, `timeout` |
| `GateRunContext` | `GateRunContextSchema` | optional `environmentKey` |
| `GateVerdictResult` | `GateVerdictResultSchema` | pass/fail only — distinct from `GateVerdict` (worker DB enum) |
| `GateEvaluationResult` | `GateEvaluationResultSchema` | `metadata: Map<String, JsonElement>` |
| `PreflightCheck` | `PreflightCheckSchema` | check `id` is string |
| `PreflightReport` | `PreflightReportSchema` | optional `blockReason` |
| `StageGateEvaluation` | `StageGateEvaluationSchema` | aggregate verdict + results |

**Reuse existing:** `GatePolicyInput` already in `Pipeline.kt` with `MetricType` enum — telemetry query builders consume it directly (no duplicate policy DTO).

**Json unknown fields:** use `Json { ignoreUnknownKeys = true }` in `TelemetryJsonTest.kt` (same as `ContractsJsonTest.kt` line 9).

---

### `TelemetryAdapterError.kt` (utility, transform)

**Analog:** `errors/telemetry-adapter-error.ts` (lines 1-32); Phase 9 `LdAdapterError.kt`

**Exception hierarchy** — open base + typed subclasses:

```typescript
// telemetry-adapter-error.ts lines 1-8
export class TelemetryAdapterError extends Error {
  constructor(
    message: string,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TelemetryAdapterError';
  }
}
```

**Kotlin target:**

```kotlin
open class TelemetryAdapterError(
    message: String,
    open val context: Map<String, Any?>? = null,
    cause: Throwable? = null,
) : Exception(message, cause)

class TelemetryApiError(
    message: String,
    val status: Int,
    val body: Any? = null,
    context: Map<String, Any?>? = null,
) : TelemetryAdapterError(message, context)

class UnsupportedMetricTypeError(
    message: String,
    val metricType: String,
    context: Map<String, Any?>? = null,
) : TelemetryAdapterError(message, context)
```

Port all three error types with same semantics as v1.

---

### `PrometheusClient.kt` (service, request-response)

**Analog:** `client/prometheus-client.ts` (lines 1-120); HTTP pattern from `LdApiClient.kt`

**Constants + factory:**

```typescript
// prometheus-client.ts lines 6-6, 73-84
export const DEFAULT_PROMETHEUS_BASE_URL = 'http://localhost:9090';
// ...
const baseUrl = (
  config.baseUrl ??
  process.env.PROMETHEUS_BASE_URL ??
  DEFAULT_PROMETHEUS_BASE_URL
).replace(/\/+$/, '');
const bearerToken = config.bearerToken ?? process.env.PROMETHEUS_BEARER_TOKEN;
assertHttpOrHttpsUrl(baseUrl);
```

**Kotlin target** — interface + factory with resolved config:

```kotlin
const val DEFAULT_PROMETHEUS_BASE_URL = "http://localhost:9090"

data class ResolvedPrometheusConfig(
    val baseUrl: String,
    val bearerToken: String? = null,
    val timeout: String? = null,
)

interface PrometheusClient {
    val config: ResolvedPrometheusConfig
    suspend fun queryInstant(query: String, timeout: String? = null): PrometheusInstantQueryData
}

data class PrometheusInstantQueryData(
    val resultType: String,
    val result: JsonElement,
)

fun createPrometheusClient(configInput: PrometheusClientConfig): PrometheusClient
```

**URL construction** — GET `/api/v1/query?query=...&timeout=...`:

```typescript
// prometheus-client.ts lines 88-96
const url = new URL('/api/v1/query', baseUrl);
url.searchParams.set('query', query);
if (opts?.timeout) {
  url.searchParams.set('timeout', opts.timeout);
}
if (config.timeout && !opts?.timeout) {
  url.searchParams.set('timeout', config.timeout);
}
```

**Kotlin:** `HttpUrl.Builder` or manual query encoding; trim trailing slashes from `baseUrl` with `.trimEnd('/')`.

**Auth header:**

```typescript
// prometheus-client.ts lines 98-101
if (bearerToken) {
  headers.Authorization = `Bearer ${bearerToken}`;
}
```

**Envelope parsing** — throw `TelemetryApiError` on non-success:

```typescript
// prometheus-client.ts lines 62-69
if (!res.ok || body.status !== 'success' || !body.data) {
  throw new TelemetryApiError(
    body.error ?? `Prometheus query failed (${res.status})`,
    res.status,
    body,
    { errorType: body.errorType },
  );
}
```

**Retry policy** — inline in client (no separate rate limiter unlike LD):

```typescript
// prometheus-client.ts lines 103-117
return pRetry(async () => { ... }, {
  retries: 2,
  shouldRetry: (error) => {
    if (error instanceof TelemetryApiError) {
      return error.status === 503;
    }
    return false;
  },
});
```

**Kotlin:** manual retry loop (max 2 retries) retrying only `TelemetryApiError` with `status == 503`. Use `withContext(Dispatchers.IO)` + OkHttp like `LdApiClient.kt` lines 65-88.

**URL validation:**

```typescript
// prometheus-client.ts lines 31-47
if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
  throw new TelemetryApiError('Prometheus baseUrl must use http or https', 0, ...);
}
```

**Test parity** — `PrometheusClientTest.kt` mirrors `prometheus-client.test.ts`:
- trailing slash normalization
- Bearer header when token provided
- `PROMETHEUS_BASE_URL` env fallback
- `status: error` envelope throws `TelemetryApiError`
- bearer token not leaked in error JSON

---

### `BuildPromql.kt` (utility, transform)

**Analog:** `query/build-promql.ts` (lines 1-95)

**Label escaping:**

```typescript
// build-promql.ts lines 6-8
export function escapePromqlLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
```

**Kotlin:** `.replace("\\", "\\\\").replace("\"", "\\\"")`

**Label selector** — user-scoped LD attribution labels:

```typescript
// build-promql.ts lines 30-38
const base = `service="${service}",ld_flag_key="${flagKey}",ld_variation_id="${variationId}",ld_context_kind="user"`;
```

**Cohort type:**

```typescript
// build-promql.ts line 4
export type Cohort = 'treatment' | 'control';
```

**Kotlin:** `enum class Cohort { treatment, control }`

**Query builders** — port verbatim PromQL strings:

| Function | v1 lines | Key assertion |
|----------|----------|---------------|
| `buildErrorRateQuery` | 42-56 | `status=~"5.."`, ratio of error/total rates |
| `buildLatencyP95Query` | 58-66 | `histogram_quantile(0.95, ...) * 1000` |
| `buildSampleCountQuery` | 68-76 | `sum(increase(http_requests_total...))` |
| `buildMetricQuery` | 78-95 | switch on `MetricType` enum |

**Metric type dispatch:**

```typescript
// build-promql.ts lines 84-93
switch (metricType) {
  case 'error_rate': return buildErrorRateQuery(...);
  case 'latency_p95': return buildLatencyP95Query(...);
  default: throw new UnsupportedMetricTypeError(...);
}
```

**Kotlin:** `when (metricType) { MetricType.error_rate -> ...; MetricType.latency_p95 -> ...; else -> throw UnsupportedMetricTypeError(...) }`

**Window default:** `policy.windowSeconds ?? 300` → `[300s]` suffix.

**Tests:** port `promql-builder.test.ts` — escape quotes/backslashes, user context label, 300s window, cohort variation IDs, unsupported metric throws.

---

### `ParseResponse.kt` (utility, transform)

**Analog:** `query/parse-response.ts` (lines 1-52)

**Result type** — sealed class for discriminated union:

```typescript
// parse-response.ts lines 1-3
export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'no_data' | 'non_finite_value' };
```

**Kotlin target:**

```kotlin
sealed class ParseResult {
    data class Ok(val value: Double) : ParseResult()
    data class Fail(val reason: ParseFailReason) : ParseResult()
}

enum class ParseFailReason { no_data, non_finite_value }
```

**Vector parsing** — first sample `[timestamp, valueString]`:

```typescript
// parse-response.ts lines 21-29
const first = result[0] as { value?: [number, string] };
if (!first?.value || first.value.length < 2) {
  return { ok: false, reason: 'no_data' };
}
return parseSampleValue(first.value[1]);
```

**Scalar parsing** — `[timestamp, valueString]` tuple at root.

**Non-finite rejection:**

```typescript
// parse-response.ts lines 10-13
if (valueString === 'NaN' || valueString === '+Inf' || valueString === '-Inf') {
  return { ok: false, reason: 'non_finite_value' };
}
```

**Tests:** load fixtures from `src/test/resources/fixtures/` — port `parse-response.test.ts` scenarios (vector pass, scalar pass, empty vector, NaN).

---

### `EvaluateGatePolicy.kt` (service, request-response)

**Analog:** `evaluate/evaluate-gate-policy.ts` (lines 1-132)

**Validation at boundary:**

```typescript
// evaluate-gate-policy.ts line 34
const runContext = GateRunContextSchema.parse(runContextInput);
```

**Kotlin:** require non-blank `flagKey`, `treatmentVariationId`, `controlVariationId` on `GateRunContext` before queries.

**Parallel queries** — 4 instant queries per policy:

```typescript
// evaluate-gate-policy.ts lines 38-52
const [treatmentData, controlData, treatmentSampleData, controlSampleData] =
  await Promise.all([
    client.queryInstant(buildMetricQuery(policy.metricType, policy, runContext, 'treatment')),
    client.queryInstant(buildMetricQuery(policy.metricType, policy, runContext, 'control')),
    client.queryInstant(buildSampleCountQuery(policy, runContext, 'treatment')),
    client.queryInstant(buildSampleCountQuery(policy, runContext, 'control')),
  ]);
```

**Kotlin:** `coroutineScope { listOf(async { ... }, ...).awaitAll() }`

**Fail-closed helper:**

```typescript
// evaluate-gate-policy.ts lines 15-27
function failResult(policy, reason, extra?) {
  return { verdict: 'fail', metricType: policy.metricType, threshold: policy.threshold,
    metadata: { reason, ...extra?.metadata }, ...extra };
}
```

**Sample size gate:**

```typescript
// evaluate-gate-policy.ts lines 70-78
if (treatmentSampleParsed.value < minSampleSize) {
  return failResult(policy, 'insufficient_samples', {
    metadata: { reason: 'insufficient_samples', cohort: 'treatment', observed, required: minSampleSize },
  });
}
```

**Threshold comparison** — treatment minus control delta:

```typescript
// evaluate-gate-policy.ts lines 98-108
const observedDelta = treatmentParsed.value - controlParsed.value;
if (observedDelta > policy.threshold) {
  return { verdict: 'fail', ..., metadata: { reason: 'threshold_exceeded' } };
}
```

**Note:** pass when `observedDelta <= threshold` (inclusive at boundary — see test "passes when delta equals threshold").

**Prometheus error swallowing:**

```typescript
// evaluate-gate-policy.ts lines 120-130
if (error instanceof TelemetryApiError) {
  return failResult(policy, 'prometheus_error', {
    metadata: { reason: 'prometheus_error', status: error.status, errorType: error.context?.errorType },
  });
}
throw error;
```

**Kotlin:** `metricType` in result should be `policy.metricType.name` (string wire format).

**Tests:** mock `PrometheusClient` with queued responses — port `evaluate-gate-policy.test.ts` (pass at threshold, fail exceeded, empty treatment, insufficient samples, prometheus error).

---

### `EvaluateStageGates.kt` (service, request-response)

**Analog:** `evaluate/evaluate-stage-gates.ts` (lines 1-21)

**Sequential evaluation** — policies evaluated in order (not parallel):

```typescript
// evaluate-stage-gates.ts lines 11-14
const results = [];
for (const policy of policies) {
  results.push(await evaluateGatePolicy(client, policy, runContext));
}
```

**Aggregate verdict:**

```typescript
// evaluate-stage-gates.ts lines 16-20
const verdict = results.every((result) => result.verdict === 'pass') ? 'pass' : 'fail';
return { verdict, results };
```

**Kotlin:** `suspend fun evaluateStageGates(...): StageGateEvaluation` — simple for-loop, no coroutine parallelism needed.

**Tests:** spy/mock `evaluateGatePolicy` — port `evaluate-stage-gates.test.ts` (all pass, any fail).

---

### `RunPreflight.kt` (service, request-response)

**Analog:** `preflight/run-preflight.ts` (lines 1-149)

**Five check IDs** — fixed order:

```typescript
// run-preflight.test.ts lines 35-41
['metric_flow_treatment', 'metric_flow_control', 'min_sample_treatment', 'min_sample_control', 'context_kind_user']
```

**Probe policy fallback:**

```typescript
// run-preflight.ts lines 32-42
function probePolicy(policies, runContext) {
  return policies[0] ?? {
    metricType: 'error_rate', threshold: 0, serviceName: runContext.flagKey,
  };
}
```

**Kotlin:** `policies.firstOrNull() ?: GatePolicyInput(MetricType.error_rate, 0.0, runContext.flagKey)`

**Two parallel sample-count queries:**

```typescript
// run-preflight.ts lines 56-63
const [treatmentSampleData, controlSampleData] = await Promise.all([
  client.queryInstant(buildSampleCountQuery(policy, runContext, 'treatment')),
  client.queryInstant(buildSampleCountQuery(policy, runContext, 'control')),
]);
```

**Block reason summarization:**

```typescript
// run-preflight.ts lines 27-29, 143-148
const failed = checks.filter((item) => item.status === 'fail');
return failed.map((item) => item.detail ?? item.id).join('; ');
// ...
blockReason: status === 'fail' ? summarizeFailures(checks) : undefined,
```

**Prometheus error path** — populate all 5 checks as fail:

```typescript
// run-preflight.ts lines 124-137
checks.push(
  check('metric_flow_treatment', 'fail', { detail: 'Prometheus query failed' }),
  // ... all five checks fail
);
```

**Tests:** port `run-preflight.test.ts` — pass when samples present, fail on missing treatment flow.

---

### `TelemetryModule.kt` (barrel exports)

**Analog:** `index.ts` (lines 1-33)

Export public API matching v1 barrel:
- `createPrometheusClient`, `PrometheusClient`, `PrometheusInstantQueryData`
- `TelemetryAdapterError`, `TelemetryApiError`, `UnsupportedMetricTypeError`
- `evaluateGatePolicy`, `evaluateStageGates`, `runPreflightChecks`
- `buildErrorRateQuery`, `buildLatencyP95Query`, `buildMetricQuery`, `buildSampleCountQuery`, `escapePromqlLabelValue`
- `parseInstantQueryResult`, `ParseResult`
- Re-export contract types from `:contracts` (`GateEvaluationResult`, `GateRunContext`, `PreflightReport`, `StageGateEvaluation`, `PrometheusClientConfig`)

Package-level KDoc mirroring `LdAdapterModule.kt` style with link to v1 `index.ts`.

---

### Test harness (`TelemetryIntegrationTest.kt`, fixtures)

**Analog:** `__tests__/telemetry-integration.test.ts` (nock); Phase 9 `LaunchDarklyProviderTest.kt`

**HTTP mocking:** use **OkHttp MockWebServer** (not nock). Enqueue `/api/v1/query` responses keyed by `query` search param.

**Fixtures:** copy verbatim from `packages/telemetry/src/__tests__/fixtures/` to `src/test/resources/fixtures/`:

| Fixture | Used for |
|---------|----------|
| `prometheus-vector-pass.json` | parse + gate pass |
| `prometheus-scalar-pass.json` | scalar parse |
| `prometheus-vector-empty.json` | no_data |
| `prometheus-nan-value.json` | non_finite_value |
| `prometheus-sample-count-high.json` | preflight + sample gates |
| `prometheus-sample-count-low.json` | insufficient samples |
| `prometheus-treatment-error-rate.json` | error rate cohort |
| `prometheus-control-error-rate.json` | control baseline |
| `prometheus-treatment-error-rate-fail.json` | threshold breach |
| `prometheus-treatment-latency.json` | latency gate |
| `prometheus-control-latency.json` | control latency |

**Integration routing** — mirror `replyForQuery` from `telemetry-integration.test.ts` lines 40-66: match on `treatment-var-id` / `control-var-id` + query shape (`increase(`, `histogram_quantile`, `status=~"5.."`).

**Unit tests without HTTP:** `BuildPromqlTest`, `ParseResponseTest`, `EvaluateGatePolicyTest` — JUnit 5 + kotlin.test like `RateLimitedClientTest.kt`.

**Coroutine tests:** use `runTest { }` from `kotlinx-coroutines-test` for suspend client and evaluate functions.

---

## Shared Patterns

### Contracts as single source of truth

**Source:** `packages/contracts/src/telemetry.ts`; Phase 8 `Pipeline.kt` for `GatePolicyInput`
**Apply to:** all telemetry query/evaluate/preflight functions

```typescript
import type { GatePolicyInput, GateRunContext } from '@ff-promo/contracts';
```

Kotlin: `import com.ffpromo.contracts.GatePolicyInput` — never duplicate telemetry DTO shapes outside `:contracts`.

### Validate at module boundary

**Source:** `evaluate-gate-policy.ts` line 34, `run-preflight.ts` line 50
**Apply to:** `evaluateGatePolicy`, `runPreflightChecks`

```typescript
const runContext = GateRunContextSchema.parse(runContextInput);
```

Kotlin: validate required `GateRunContext` fields before PromQL/HTTP calls.

### Fail-closed gate evaluation

**Source:** `evaluate-gate-policy.ts` lines 55-96, `parse-response.ts`
**Apply to:** `EvaluateGatePolicy.kt`, `ParseResponse.kt`

Empty vectors, NaN/Inf, insufficient samples, and Prometheus errors all yield `verdict: fail` — never pass on missing data.

### User-scoped metric labels

**Source:** `build-promql.ts` line 35
**Apply to:** `BuildPromql.kt`

All queries include `ld_context_kind="user"` — preflight `context_kind_user` check depends on treatment sample presence.

### Treatment vs control delta comparison

**Source:** `evaluate-gate-policy.ts` lines 98-108
**Apply to:** `EvaluateGatePolicy.kt`

Gate passes when `(treatmentValue - controlValue) <= threshold`; fails when strictly greater.

### Prometheus 503 retry only

**Source:** `prometheus-client.ts` lines 109-116
**Apply to:** `PrometheusClient.kt`

Unlike LD adapter rate limiter, telemetry retries inline: 2 retries on HTTP 503 only; no retry on 4xx or other 5xx.

### Bearer token hygiene

**Source:** `prometheus-client.test.ts` lines 100-116
**Apply to:** `PrometheusClient.kt`, error context maps

Never include bearer token in exception messages or serialized error context.

### Test fixture reuse

**Source:** `packages/telemetry/src/__tests__/fixtures/*.json`
**Apply to:** all Kotlin telemetry tests

Copy fixtures unchanged — enables diff-free behavioral parity with v1 vitest suite.

---

## Anti-Patterns to Avoid

| Anti-pattern | Why | Do instead |
|--------------|-----|------------|
| Prometheus Java client library | v1 uses raw HTTP query API | OkHttp GET `/api/v1/query` per v1 |
| Separate rate limiter wrapper | Telemetry has simpler retry (503 only) | Inline retry in `PrometheusClient` |
| Parallel stage gate evaluation | v1 evaluates policies sequentially | for-loop in `EvaluateStageGates` |
| Pass gate on empty Prometheus data | v1 fail-closed | Return `fail` with `no_data` / `insufficient_samples` |
| Duplicate telemetry DTOs in telemetry module | Drift from contracts | `:contracts` `Telemetry.kt` only |
| Use `GateVerdict` for evaluation results | DB enum includes pending/skipped | Use `GateVerdictResult` (pass/fail) from `Telemetry.kt` |
| String metricType in Kotlin builders | `GatePolicyInput` uses `MetricType` enum | `when (policy.metricType)` with enum branches |
| Wiring telemetry into worker in Phase 10 | Out of scope unless plan says so | Export module; worker import Phase 11 |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Kotlin PromQL string builders | utility | transform | No PromQL code in Kotlin yet — port from v1 pure functions |
| `ParseResult` sealed class | utility | transform | No result-type parsing in Kotlin codebase |
| Inline 503 retry (not rate limiter) | middleware | request-response | LD uses `RateLimitedClient`; telemetry uses simpler p-retry in client |
| `TelemetryIntegrationTest.kt` MockWebServer query routing | test | request-response | v1 uses nock URI matching; MockWebServer is idiomatic substitute |

---

## v1 Patterns to Reuse

| v1 artifact | Phase 10 Kotlin target |
|-------------|------------------------|
| `packages/contracts/src/telemetry.ts` | `contracts/Telemetry.kt` |
| `packages/telemetry/src/index.ts` | `telemetry/TelemetryModule.kt` |
| `packages/telemetry/src/errors/telemetry-adapter-error.ts` | `errors/TelemetryAdapterError.kt` |
| `packages/telemetry/src/client/prometheus-client.ts` | `client/PrometheusClient.kt` |
| `packages/telemetry/src/query/build-promql.ts` | `query/BuildPromql.kt` |
| `packages/telemetry/src/query/parse-response.ts` | `query/ParseResponse.kt` |
| `packages/telemetry/src/evaluate/evaluate-gate-policy.ts` | `evaluate/EvaluateGatePolicy.kt` |
| `packages/telemetry/src/evaluate/evaluate-stage-gates.ts` | `evaluate/EvaluateStageGates.kt` |
| `packages/telemetry/src/preflight/run-preflight.ts` | `preflight/RunPreflight.kt` |
| `packages/telemetry/src/__tests__/*.test.ts` | `src/test/kotlin/.../*Test.kt` |
| `packages/telemetry/src/__tests__/fixtures/*.json` | test fixtures (verbatim copy) |
| `kotlin/modules/ld-adapter/.../LdApiClient.kt` | OkHttp + `Dispatchers.IO` HTTP pattern |
| `kotlin/modules/ld-adapter/.../LdAdapterError.kt` | Exception hierarchy pattern |
| `kotlin/modules/contracts/.../ContractsJsonTest.kt` | `TelemetryJsonTest.kt` structure |
| `kotlin/settings.gradle.kts` | add `:telemetry` module include |

---

## Metadata

**Analog search scope:** `packages/telemetry/src/` (26 files), `packages/contracts/src/telemetry.ts`, `kotlin/modules/ld-adapter/`, `kotlin/modules/contracts/`, Phase 9 `09-PATTERNS.md`
**Files scanned:** ~35 source + test files
**Kotlin telemetry codebase:** none (greenfield module)
**Pattern extraction date:** 2026-06-22
