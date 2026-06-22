# Phase 3: Telemetry Adapter - Research

**Researched:** 2026-06-22
**Domain:** Prometheus HTTP API adapter for cohort delta SLO gates and pre-flight health checks
**Confidence:** HIGH

## Summary

Phase 3 delivers `packages/telemetry`: a Prometheus instant-query adapter that evaluates `GatePolicy` rows (error rate, p95 latency) using **delta-vs-control cohort comparison** and runs **pre-flight health checks** before promotion starts. The adapter reads policies from Postgres (via caller-supplied DTOs); it does not wire Temporal activities (Phase 4), REST endpoints (Phase 5), or guardrail configuration UI (Phase 7).

Official Prometheus documentation confirms the integration surface: **`GET/POST /api/v1/query`** for instant evaluation, JSON envelope `{ status, data: { resultType, result } }`, and empty `result: []` vectors on successful queries with no matching series [CITED: prometheus.io/docs/prometheus/latest/querying/api]. Fail-closed behavior (D-06, D-07) maps directly to treating empty vectors, `"NaN"` sample values, and HTTP errors as gate failures.

Cohort delta gates require **separate treatment and control queries** (or a single PromQL subtraction expression) filtered by `ld_variation_id`, with shared scoping on `service`, `ld_flag_key`, and `ld_context_kind="user"`. This aligns with LaunchDarkly rollout defaults from Phase 2 (`rolloutContextKind: 'user'`, `rolloutBucketBy: 'user'`) and standard canary comparison patterns [CITED: prometheus.io/docs/prometheus/latest/querying/examples via GitHub; MEDIUM: OneUptime canary comparison blog].

**Primary recommendation:** Scaffold `packages/telemetry` mirroring `ld-adapter` — `createPrometheusClient(config)` with env fallback, built-in PromQL builders (no templates in GatePolicy), application-layer delta computation from treatment/control instant-query results, nock fixtures for CI, optional docker-compose Prometheus profile for manual validation.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Cohort Attribution & PromQL Contract
- **D-01:** Metrics attributed via standard OpenTelemetry/LD labels — instrumented apps emit `service`, `ld_flag_key`, `ld_variation_id` (or variation name), and `ld_context_kind`
- **D-02:** Gate verdicts use **delta vs control** — compare treatment cohort error rate / p95 latency to control cohort; fail when delta exceeds policy threshold (not absolute treatment-only SLO in v1)
- **D-03:** Enforce **`user` context kind** — adapter expects `ld_context_kind=user` on series; pre-flight verifies alignment with LD rollout bucket context from Phase 2
- **D-04:** **Built-in PromQL** from `GatePolicy` + run context (flag key, variation IDs, serviceName, windowSeconds) — do not store raw PromQL templates in GatePolicy in v1
- **D-05:** Service scoping uses existing `GatePolicy.serviceName` field (already in Prisma schema)

#### Missing / Stale Data Policy
- **D-06:** **Fail closed** when Prometheus returns empty or no matching series — no promotion advancement on missing data
- **D-07:** **Fail below minSampleSize** — `GatePolicy.minSampleSize` is a hard floor; insufficient request/sample count = gate fail
- **D-08:** **Window-bound instant queries** — use `GatePolicy.windowSeconds` as the evaluation window in rate/histogram PromQL (`[window]`); data outside window counts as no data
- **D-09:** **All stage policies must pass** — a stage with multiple GatePolicies (e.g. `error_rate` + `latency_p95`) fails if any single policy fails

#### Pre-flight Health Checks (TELE-04)
- **D-10:** Pre-flight runs **before promotion start** and verifies: (1) metric flow — queries return data for treatment and control, (2) minimum sample size met, (3) `user` context kind present on series
- **D-11:** Pre-flight failure **blocks promotion start** (fail closed, consistent with D-06)
- **D-12:** Pre-flight reuses the same query/evaluation machinery as runtime gates but returns a structured health report (not persisted as GateResult until Phase 4 wires it)

#### Local Dev & Testing
- **D-13:** **nock HTTP mocks** for unit/CI (mirror `@ff-promo/ld-adapter`); **optional docker-compose Prometheus profile** for manual e2e (not required in CI)
- **D-14:** `createPrometheusClient(config)` with **config param + env fallback** — `PROMETHEUS_BASE_URL`, optional bearer token; document in `.env.example`
- **D-15:** Package at **`packages/telemetry`** per STACK.md, mirroring `ld-adapter` layout (client, evaluate, preflight, fixtures, tests)
- **D-16:** **JSON fixtures** for Prometheus API responses under `src/__tests__/fixtures/`

### Claude's Discretion

- Exact PromQL expressions for `error_rate` and `latency_p95` delta-vs-control given standard labels
- Pre-flight response shape and error taxonomy (distinct from gate fail reasons)
- Docker Compose Prometheus optional profile wiring and seed scrape config
- Whether to normalize `latency_p95` vs `p95_latency_ms` metricType strings across seed/tests (schema uses free string)

### Deferred Ideas (OUT OF SCOPE)

- **Pre-flight UX details** — explicit discussion deferred; inferred from TELE-04 + fail-closed choices
- **TELE-01/02 threshold configuration UI/API** — Phase 7 guardrails; Phase 3 consumes existing GatePolicy rows only
- **Datadog / other telemetry backends** — v2 per PROJECT.md
- **Inconclusive/third verdict state** — rejected; fail closed preferred
- **Raw PromQL templates in GatePolicy** — rejected for v1; built-in queries only

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TELE-03 | System evaluates SLO gates against Prometheus metrics for the target service | `evaluateGatePolicy()` + `evaluateStageGates()` with built-in PromQL, delta-vs-control, fail-closed parsing; nock tests for pass/fail/missing-data/min-sample |
| TELE-04 | System runs pre-flight health checks before promotion starts (metric flow, minimum sample size, context kind alignment) | `runPreflightChecks()` reusing query helpers; structured `PreflightReport` with per-check status; blocks when any check fails |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Telemetry:** Error rate and latency SLO thresholds only in v1 — gate logic focused on these two metric types
- **Failure mode:** Pause-and-alert on breach — adapter returns fail verdicts; no auto-rollback
- **Integration:** Prometheus HTTP API via `/api/v1/query` as v1 telemetry source; Datadog deferred to v2
- **Monorepo layout:** `packages/telemetry` per STACK.md; worker consumes adapter in Phase 4 only
- **Do not use:** LaunchDarkly SDK for telemetry; custom Redis-only gate state; raw PromQL templates in GatePolicy (v1)
- **Stack lock:** TypeScript ~5.8, Zod 4.4.3, Vitest 4.1.9, native `fetch` for HTTP (no heavy Prometheus client SDK required)

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Prometheus HTTP client | **Adapter (`packages/telemetry`)** | — | External HTTP to Prometheus; adapter owns query execution and response parsing |
| Built-in PromQL generation | **Adapter** | Contracts (types only) | D-04 locks PromQL in code, not DB; builders live in adapter |
| Gate evaluation (pass/fail) | **Adapter** | Worker activity (Phase 4) | Adapter returns structured verdicts; worker persists `GateResult` |
| Pre-flight health checks | **Adapter** | Worker/API (Phase 4/5) | Adapter produces report; orchestrator decides block promotion start |
| GatePolicy persistence | **DB (`packages/db`)** | — | Phase 3 reads DTOs; no schema migration expected |
| GateResult persistence | **Worker + DB (Phase 4)** | — | Phase 3 returns evaluation objects only (D-12) |
| LD variation ID resolution | **ld-adapter (Phase 2)** | Worker passes IDs into telemetry run context | Telemetry adapter receives resolved variation IDs; does not call LD |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.8.3 | Adapter implementation | Monorepo standard |
| `zod` | 4.4.3 | Config + run-context validation | Shared with `@ff-promo/contracts` pattern from ld-adapter |
| Native `fetch` | Node 24+ | Prometheus `/api/v1/query` HTTP | Simple instant-query API; no SDK required [CITED: prometheus.io/docs/prometheus/latest/querying/api] |
| Vitest | 4.1.9 | Unit + HTTP contract tests | Phase 1 harness; add `telemetry` vitest project |
| `@ff-promo/contracts` | workspace | Shared DTOs for config, evaluation results, preflight report | Mirror ld-adapter → contracts boundary |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nock` | 14.0.15 | HTTP mocking in tests | CI unit/integration tests (D-13); mirror ld-adapter pattern |
| `p-retry` | 8.0.0 | Retry on transient 503/timeout | Optional — Prometheus returns 503 on query timeout [CITED: prometheus.io/docs/prometheus/latest/querying/api]; ld-adapter already uses p-retry |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `fetch` | `prometheus-query` npm wrappers | Extra dependency; wrappers often stale; instant query is one endpoint |
| Application-layer delta (2 queries) | Single PromQL `(treatment) - (control)` | Single query is possible but harder to debug forensics; two queries give clearer metadata per cohort |
| docker-compose Prometheus (manual) | testcontainers Prometheus in CI | Heavier CI; CONTEXT rejects Prometheus in CI gate (D-13) |
| `prom-client` | — | For exposing orchestrator metrics, not querying Prometheus; belongs in api/worker observability |

**Installation (in `packages/telemetry`):**

```bash
pnpm add zod@4.4.3 @ff-promo/contracts@workspace:*
pnpm add -D nock@14.0.15 typescript@~5.8.3
# Optional retry helper (already in monorepo via ld-adapter):
pnpm add p-retry@8.0.0
```

**Version verification (2026-06-22):**

```bash
npm view nock version      # 14.0.15
npm view zod version       # 4.4.3
npm view vitest version    # 4.1.9
npm view p-retry version   # 8.0.0
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `nock` | npm | ~12 yrs | High | github.com/nock/nock | OK | Approved — ld-adapter already uses 14.0.15 |
| `zod` | npm | ~6 yrs | Very high | github.com/colinhacks/zod | OK | Approved — monorepo standard |
| `p-retry` | npm | ~8 yrs | High | github.com/sindresorhus/p-retry | OK | Approved — ld-adapter dependency |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Phase 4 Worker (NOT Phase 3 scope)                  │
│  evaluateGate activity ──► packages/telemetry.evaluateStageGates()      │
│  preflight activity  ──► packages/telemetry.runPreflightChecks()          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ GatePolicy[] + GateRunContext
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        packages/telemetry                                │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────────────────┐  │
│  │ create       │   │ buildPromql()   │   │ parseInstantQueryResult()│  │
│  │ Prometheus   │──►│ error_rate      │──►│ fail-closed: empty/NaN   │  │
│  │ Client       │   │ latency_p95     │   │ vector + scalar types    │  │
│  └──────┬───────┘   │ sample_count    │   └──────────────────────────┘  │
│         │           └────────┬────────┘                                  │
│         │                    │                                           │
│         ▼                    ▼                                           │
│  GET /api/v1/query ◄── queryInstant() × N (treatment, control, samples) │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ evaluateGatePolicy: delta = treatment − control; compare threshold│   │
│  │ evaluateStageGates: ALL policies must pass (D-09)                 │   │
│  │ runPreflightChecks: metric_flow + min_sample + context_kind (D-10)│   │
│  └──────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS
                                ▼
                    ┌───────────────────────┐
                    │ Prometheus (or Mimir/   │
                    │ Thanos — compatible API)│
                    │ /api/v1/query           │
                    └───────────────────────┘
                                ▲
                                │ scraped metrics with labels:
                                │ service, ld_flag_key, ld_variation_id,
                                │ ld_context_kind=user, status, le
                    ┌───────────────────────┐
                    │ Instrumented apps     │
                    │ (OTel → Prometheus)   │
                    └───────────────────────┘
```

### Recommended Project Structure

```
packages/telemetry/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # public exports
    ├── client/
    │   └── prometheus-client.ts    # createPrometheusClient, queryInstant
    ├── query/
    │   ├── build-promql.ts         # built-in PromQL for error_rate, latency_p95, sample_count
    │   └── parse-response.ts       # envelope + vector/scalar parsing, fail-closed helpers
    ├── evaluate/
    │   ├── evaluate-gate-policy.ts # single GatePolicy → GateEvaluationResult
    │   └── evaluate-stage-gates.ts # GatePolicy[] → stage verdict (all must pass)
    ├── preflight/
    │   └── run-preflight.ts        # TELE-04 health report
    ├── errors/
    │   └── telemetry-adapter-error.ts
    └── __tests__/
        ├── fixtures/               # JSON Prometheus API responses (D-16)
        ├── prometheus-client.test.ts
        ├── evaluate-gate-policy.test.ts
        ├── evaluate-stage-gates.test.ts
        ├── run-preflight.test.ts
        └── promql-builder.test.ts
```

**Contracts additions (`packages/contracts/src/telemetry.ts`):**

```typescript
// Zod schemas — mirror launchdarkly.ts pattern
PrometheusClientConfigSchema   // baseUrl, bearerToken?
GateRunContextSchema           // flagKey, treatmentVariationId, controlVariationId
GateEvaluationResultSchema     // verdict, metricType, observedDelta, treatmentValue, controlValue, threshold, metadata
PreflightReportSchema          // status, checks[], blockReason?
```

### Pattern 1: Config-Injected Client Factory (mirror ld-adapter)

**What:** Factory accepts explicit config; env vars are fallback at boundary only.
**When to use:** All adapter entry points.
**Example:**

```typescript
// Source: packages/ld-adapter/src/client/ld-api-client.ts (pattern)
// Source: prometheus.io/docs/prometheus/latest/querying/api (endpoint)
export function createPrometheusClient(configInput: PrometheusClientConfig) {
  const config = PrometheusClientConfigSchema.parse(configInput);
  const baseUrl = (config.baseUrl ?? process.env.PROMETHEUS_BASE_URL ?? 'http://localhost:9090')
    .replace(/\/+$/, '');
  const bearerToken = config.bearerToken ?? process.env.PROMETHEUS_BEARER_TOKEN;

  return {
    config: { ...config, baseUrl },
    async queryInstant(query: string, opts?: { timeout?: string }) {
      const url = new URL('/api/v1/query', baseUrl);
      url.searchParams.set('query', query);
      if (opts?.timeout) url.searchParams.set('timeout', opts.timeout);
      const headers: Record<string, string> = {};
      if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
      const res = await fetch(url, { headers });
      // parse envelope; throw TelemetryApiError on non-2xx or status:"error"
    },
  };
}
```

### Pattern 2: Built-in PromQL with Cohort Labels (D-01, D-04)

**What:** Query builders take `GatePolicy` fields + `GateRunContext`; label values escaped before interpolation.
**When to use:** Every gate evaluation and preflight query.

**Label selector base (shared):**

```promql
{
  service="<serviceName>",
  ld_flag_key="<flagKey>",
  ld_variation_id="<variationId>",
  ld_context_kind="user"
}
```

**RESOLVED — error_rate PromQL (D-02, Claude's discretion):**

```promql
# Treatment error rate (ratio 0..1)
sum(rate(http_requests_total{service="...",ld_flag_key="...",ld_variation_id="<treatment>",ld_context_kind="user",status=~"5.."}[<window>]))
/
sum(rate(http_requests_total{service="...",ld_flag_key="...",ld_variation_id="<treatment>",ld_context_kind="user"}[<window>]))
```

Control uses identical expression with `controlVariationId`. **Delta** = `treatmentRate - controlRate`. **Fail** when `delta > policy.threshold` (threshold is absolute delta, e.g. 0.01 = 1pp) OR when either rate is unobservable (empty/NaN).

**RESOLVED — latency_p95 PromQL:**

```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{service="...",ld_flag_key="...",ld_variation_id="<treatment>",ld_context_kind="user"}[<window>])) by (le)
) * 1000
```

Control idem. **Delta** = `treatmentP95Ms - controlP95Ms`. **Fail** when `delta > policy.threshold` (threshold in ms, e.g. 500).

**RESOLVED — sample count for minSampleSize (D-07):**

```promql
sum(increase(http_requests_total{service="...",ld_flag_key="...",ld_variation_id="<variation>",ld_context_kind="user"}[<window>]))
```

Compare integer sample count ≥ `GatePolicy.minSampleSize` for **both** treatment and control independently.

**Window format:** `[${windowSeconds}s]` from `GatePolicy.windowSeconds` (default 300 from schema).

**Metric names:** Use STACK.md conventions (`http_requests_total`, `http_request_duration_seconds_bucket`, `status=~"5.."`). Document as contract in adapter README — instrumented apps must match.

### Pattern 3: Fail-Closed Result Parsing (D-06, D-07)

**What:** Central parser converts Prometheus responses to numeric values or explicit failure reasons.
**When to use:** After every `queryInstant` call.

| Condition | Verdict | Reason code |
|-----------|---------|-------------|
| HTTP non-2xx or `status: "error"` | fail | `prometheus_error` |
| `resultType: "vector"`, `result: []` | fail | `no_data` |
| Sample value `"NaN"` or `"+Inf"` | fail | `non_finite_value` |
| Sample count < `minSampleSize` | fail | `insufficient_samples` |
| Delta ≤ threshold | pass | — |
| Delta > threshold | fail | `threshold_exceeded` |

Handle both `vector` (single series) and `scalar` result types [CITED: prometheus.io/docs/prometheus/latest/querying/api#instant-queries].

### Pattern 4: Pre-flight Health Report (TELE-04, D-10–D-12)

**RESOLVED — PreflightReport shape (Claude's discretion):**

```typescript
{
  status: 'pass' | 'fail',
  checks: [
    { id: 'metric_flow_treatment', status: 'pass' | 'fail', detail?: string },
    { id: 'metric_flow_control', status: 'pass' | 'fail', detail?: string },
    { id: 'min_sample_treatment', status: 'pass' | 'fail', observed?: number, required?: number },
    { id: 'min_sample_control', status: 'pass' | 'fail', observed?: number, required?: number },
    { id: 'context_kind_user', status: 'pass' | 'fail', detail?: string },
  ],
  blockReason?: string,  // human-readable summary when status=fail
}
```

**RESOLVED — context_kind check:** Run sample-count or rate query with `ld_context_kind="user"` filter; pass when non-empty. Optionally run `count(http_requests_total{...,ld_context_kind!="user"})` as informational metadata only — preflight fails only when user-scoped series are absent (D-03).

Pre-flight uses **max** `minSampleSize` across supplied policies (strictest gate) for sample checks, or evaluates per-policy if policies differ — **RESOLVED:** use **max** across policies for preflight simplicity; runtime gates still enforce per-policy floors.

### Pattern 5: nock HTTP Tests (D-13, mirror ld-adapter)

**What:** Record Prometheus API JSON fixtures; intercept `GET /api/v1/query`.
**Example:**

```typescript
// Source: packages/ld-adapter/src/__tests__/launch-darkly-provider.test.ts (pattern)
nock('http://localhost:9090')
  .get('/api/v1/query')
  .query(true)
  .reply(200, treatmentErrorRateFixture);
```

Use `nock.cleanAll()` in `afterEach`. Assert `nock.isDone()` for full request coverage.

### Anti-Patterns to Avoid

- **Absolute treatment-only SLO in v1:** Violates D-02; canary regressions vs control would be missed
- **Storing PromQL in GatePolicy:** Violates D-04; keeps query contract in version-controlled code
- **Reading `process.env` inside evaluators:** Violates adapter pattern; env only in factory
- **Treating empty Prometheus result as pass:** Violates D-06 fail-closed
- **Using `@launchdarkly/node-server-sdk` for metrics:** Wrong integration surface
- **Unescaped label values in PromQL:** Risk of query injection if flag keys/IDs contain `"` or `\`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prometheus HTTP protocol | Custom TCP/JSON parser | `fetch` + Zod-validated response parser | Single documented endpoint; envelope is stable |
| PromQL rate/histogram math | Custom time-series math | PromQL `rate()`, `histogram_quantile()`, `increase()` | Counter resets, histogram buckets handled by Prometheus |
| HTTP test doubles | Custom mock server | `nock` 14.0.15 | Proven in ld-adapter; records fixtures |
| Gate verdict persistence | Adapter writes GateResult | Return DTO; worker persists (Phase 4) | Keeps adapter pure; testable without DB |
| Label value escaping | Ad-hoc string concat | Dedicated `escapePromqlLabelValue()` with unit tests | Prevents broken queries and injection |

**Key insight:** The adapter's job is **orchestration of well-known PromQL patterns**, not a metrics engine. All time-series computation stays in Prometheus.

## Common Pitfalls

### Pitfall 1: Empty Vector vs Zero Value

**What goes wrong:** `result: []` interpreted as "0% error rate" → false pass.
**Why it happens:** Prometheus returns `status: success` with empty vector when no series match.
**How to avoid:** Fail closed on empty vector before numeric parsing (D-06).
**Warning signs:** Tests only cover happy-path fixtures with data.

### Pitfall 2: Division by Zero → NaN

**What goes wrong:** No requests in window → `"NaN"` sample → treated as 0.
**Why it happens:** `0/0` in PromQL error-rate ratio.
**How to avoid:** Explicitly reject `"NaN"`, `"+Inf"`, `"-Inf"` strings.
**Warning signs:** Observed values in metadata show `"NaN"` but verdict is pass.

### Pitfall 3: Window Too Short for `rate()`

**What goes wrong:** Sparse scrapes → empty or misleading rates.
**Why it happens:** Prometheus recommends range ≥ 4× scrape interval [MEDIUM: Grafana PromQL skill / Prometheus docs].
**How to avoid:** Default `windowSeconds: 300` (seed) is safe for 15–60s scrape intervals; document minimum 60s floor in adapter if policy allows smaller windows.
**Warning signs:** Intermittent `no_data` on healthy services.

### Pitfall 4: Scalar vs Vector Result Types

**What goes wrong:** Parser assumes vector; aggregated queries return `resultType: "scalar"`.
**Why it happens:** PromQL aggregations without `by()` return scalar [CITED: prometheus.io/docs/prometheus/latest/querying/api].
**How to avoid:** Parser handles both `vector` and `scalar` in `parse-response.ts`.
**Warning signs:** `TypeError: Cannot read property 'metric' of undefined`.

### Pitfall 5: metricType String Drift

**What goes wrong:** Seed uses `latency_p95`; integration test uses `p95_latency_ms` → evaluator switch misses policy.
**Why it happens:** Free-string `metricType` in schema without enum.
**How to avoid:** **RESOLVED:** Canonical types `error_rate` and `latency_p95`; update `packages/db/src/__tests__/pipeline.integration.test.ts` and `gate-result.integration.test.ts` to use `latency_p95`; reject unknown types with fail + `unsupported_metric_type`.
**Warning signs:** Gate policies silently skipped.

### Pitfall 6: Ignoring `comparisonMode` Column

**What goes wrong:** DB default `comparisonMode: "absolute"` suggests alternate behavior.
**Why it happens:** Schema predates D-02 delta decision.
**How to avoid:** v1 adapter **always** delta-vs-control; ignore `comparisonMode` until Phase 7 configurability. Optional: set seed `comparisonMode` to `delta_vs_control` for documentation clarity (non-blocking schema change).
**Warning signs:** Planner tasks branch on `comparisonMode`.

## Code Examples

### Instant Query via fetch

```typescript
// Source: https://prometheus.io/docs/prometheus/latest/querying/api/#instant-queries
const url = new URL('/api/v1/query', baseUrl);
url.searchParams.set('query', promql);
const res = await fetch(url, { headers });
const body = await res.json();
if (body.status !== 'success') {
  throw new TelemetryApiError(body.error ?? 'Prometheus query failed', { errorType: body.errorType });
}
const { resultType, result } = body.data;
```

### Error Rate Ratio (treatment cohort)

```promql
// Source: https://github.com/prometheus/prometheus/blob/master/docs/querying/examples.md
// Source: .planning/research/STACK.md (Telemetry Gate Adapter v1)
sum(rate(http_requests_total{service="demo-service",ld_flag_key="demo-feature-flag",ld_variation_id="abc123",ld_context_kind="user",status=~"5.."}[300s]))
/
sum(rate(http_requests_total{service="demo-service",ld_flag_key="demo-feature-flag",ld_variation_id="abc123",ld_context_kind="user"}[300s]))
```

### P95 Latency (milliseconds)

```promql
// Source: .planning/research/STACK.md
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{service="demo-service",ld_flag_key="demo-feature-flag",ld_variation_id="abc123",ld_context_kind="user"}[300s])) by (le)
) * 1000
```

### Sample Count for minSampleSize

```promql
sum(increase(http_requests_total{service="demo-service",ld_flag_key="demo-feature-flag",ld_variation_id="abc123",ld_context_kind="user"}[300s]))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Absolute service-level SLO only | Cohort delta vs control with LD attribution labels | Phase 3 CONTEXT (2026-06-22) | Catches canary regressions relative to control |
| Raw PromQL in GatePolicy | Built-in query builders in adapter | Phase 3 CONTEXT (2026-06-22) | Query contract versioned with code |
| Stub `evaluateGate` always pass | Real Prometheus adapter (Phase 3) + worker wiring (Phase 4) | Phase 1 stub → Phase 3/4 | Gates become meaningful |

**Deprecated/outdated:**
- **`comparisonMode: "absolute"` as runtime behavior in v1:** Schema field exists but v1 evaluator uses delta-only per D-02

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Instrumented apps expose `http_requests_total` and `http_request_duration_seconds_bucket` with labels `service`, `ld_flag_key`, `ld_variation_id`, `ld_context_kind` | Pattern 2 | Gates always fail until metrics wired correctly |
| A2 | `ld_variation_id` label value matches LaunchDarkly variation `_id` from Phase 2 resolver | Pattern 2 | Cohort filters miss series |
| A3 | Error rate threshold is delta in ratio units (0.01 = 1 percentage point), latency threshold is delta in ms | Pattern 2 | Wrong pass/fail if thresholds interpreted as absolute treatment SLO |
| A4 | `status=~"5.."` matches app's HTTP status label convention | Pattern 2 | Error rate always zero or wrong if label is `status_code` instead |

## Open Questions

1. **Should adapter accept alternate metric/label names (e.g. `status_code` vs `status`)?**
   - What we know: STACK.md and seed assume `http_requests_total` + `status=~"5.."`
   - **RESOLVED:** v1 uses fixed metric/label contract documented in adapter; no configurability. Pre-flight failure surfaces miswired apps early (TELE-04).

2. **Single PromQL delta expression vs two queries per cohort?**
   - What we know: Both work; two queries improve forensics metadata (treatmentValue, controlValue on GateResult)
   - **RESOLVED:** Two queries per metric (treatment rate, control rate) + application delta. Clearer GateResult metadata for Phase 5 API forensics.

3. **Canonical `metricType` string for p95 latency?**
   - What we know: Seed uses `latency_p95`; some tests use `p95_latency_ms`
   - **RESOLVED:** Standardize on `latency_p95` everywhere; map only these two types in v1 evaluator.

4. **Docker Compose Prometheus profile contents?**
   - What we know: D-13 optional manual e2e; not CI
   - **RESOLVED:** Add `prometheus` profile with `prom/prometheus` + minimal `prometheus.yml` scraping a static exporter or `prometheus/demo` image; document `docker compose --profile prometheus up`. No seed metrics required for CI.

5. **Use `comparisonMode` from GatePolicy?**
   - What we know: DB default is `absolute`; CONTEXT locks delta for v1
   - **RESOLVED:** Ignore `comparisonMode` in Phase 3 evaluator; always delta-vs-control.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Package build/test | ✓ | v25.9.0 (≥24 required) | — |
| pnpm | Monorepo | ✓ | 10.33.0 | — |
| Docker | Optional Prometheus profile | ✓ | 27.0.3 | Skip profile; use nock in tests |
| Prometheus server | Manual e2e only | ✗ | — | nock fixtures for CI (D-13) |
| PostgreSQL | Phase 3 unit tests | ✗ (not required) | — | Telemetry tests do not need DB |

**Missing dependencies with no fallback:**
- none (Phase 3 adapter is HTTP-only + unit tests)

**Missing dependencies with fallback:**
- Prometheus server → nock HTTP mocks for CI

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` (add `telemetry` project — Wave 0) |
| Quick run command | `pnpm -w exec vitest run --project telemetry` |
| Full suite command | `pnpm test` (turbo all packages) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TELE-03 | Error rate delta gate pass | unit (nock) | `pnpm -w exec vitest run --project telemetry evaluate-gate-policy` | ❌ Wave 0 |
| TELE-03 | Error rate delta gate fail (threshold exceeded) | unit (nock) | same | ❌ Wave 0 |
| TELE-03 | Fail closed on empty Prometheus result | unit (nock) | same | ❌ Wave 0 |
| TELE-03 | Fail below minSampleSize | unit (nock) | same | ❌ Wave 0 |
| TELE-03 | Latency p95 delta gate pass/fail | unit (nock) | same | ❌ Wave 0 |
| TELE-03 | All stage policies must pass (D-09) | unit | `evaluate-stage-gates.test.ts` | ❌ Wave 0 |
| TELE-04 | Pre-flight pass when metrics flow + samples + context kind | unit (nock) | `run-preflight.test.ts` | ❌ Wave 0 |
| TELE-04 | Pre-flight fail blocks (missing treatment/control data) | unit (nock) | same | ❌ Wave 0 |
| TELE-03/04 | PromQL builder label escaping | unit | `promql-builder.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm -w exec vitest run --project telemetry`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/telemetry/` package scaffold (package.json, tsconfig, src/index.ts)
- [ ] `packages/contracts/src/telemetry.ts` — config, run context, evaluation result, preflight schemas
- [ ] `vitest.config.ts` — add `telemetry` project (mirror `ld-adapter`)
- [ ] Root `pnpm-workspace.yaml` already includes `packages/*` — no change
- [ ] `.env.example` — add `PROMETHEUS_BASE_URL`, `PROMETHEUS_BEARER_TOKEN`
- [ ] Normalize `p95_latency_ms` → `latency_p95` in db integration tests
- [ ] `src/__tests__/fixtures/` — Prometheus API JSON fixtures (vector, scalar, empty, error)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (optional) | Bearer token via `Authorization` header; config-injected, not logged |
| V3 Session Management | no | Stateless instant queries |
| V4 Access Control | no | Adapter has no RBAC; caller enforces |
| V5 Input Validation | yes | Zod on config + run context; `escapePromqlLabelValue()` on all label interpolations |
| V6 Cryptography | no | TLS assumed at transport layer (caller's Prometheus URL) |

### Known Threat Patterns for Prometheus Adapter

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PromQL injection via flagKey/variationId | Tampering | Label value escaping; never accept raw PromQL from user input (D-04) |
| Bearer token leakage in logs | Information disclosure | Do not log Authorization header; config redaction in errors |
| SSRF via Prometheus baseUrl | Spoofing/Tampering | Validate baseUrl is http(s); restrict to configured URL only; no user-supplied query URLs |
| Denial of service via expensive queries | Denial of service | Pass `timeout` query param; optional concurrency limit if needed |

## Sources

### Primary (HIGH confidence)

- [Prometheus HTTP API — instant queries](https://prometheus.io/docs/prometheus/latest/querying/api/#instant-queries) — envelope format, empty vectors, scalar/vector types, 400/422/503 errors
- [Prometheus query examples](https://github.com/prometheus/prometheus/blob/master/docs/querying/examples.md) — `rate()`, `sum by`, ratio patterns
- `.planning/research/STACK.md` — Telemetry Gate Adapter v1 PromQL baselines, monorepo layout
- `.planning/phases/03-telemetry-adapter/03-CONTEXT.md` — locked decisions D-01–D-16
- `packages/ld-adapter/` — adapter factory, nock tests, error taxonomy patterns
- `packages/contracts/src/pipeline.ts`, `packages/db/prisma/schema.prisma` — GatePolicy fields

### Secondary (MEDIUM confidence)

- [OneUptime canary OTel metrics comparison](https://oneuptime.com/blog/post/2026-02-06-canary-testing-opentelemetry-metrics/view) — treatment vs baseline error rate / p95 comparison pattern (verified against PromQL cookbook patterns)
- Phase 2 ld-adapter tests — `rolloutContextKind: 'user'` default aligns with D-03

### Tertiary (LOW confidence — flagged)

- Exact label names (`status` vs `status_code`) in user apps — assumed per STACK.md; confirm during Phase 4 integration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Prometheus instant query API verified; nock/zod already in monorepo
- Architecture: HIGH — mirrors proven ld-adapter pattern; CONTEXT decisions are explicit
- Pitfalls: HIGH — empty vector / NaN fail-closed verified against official API docs
- PromQL expressions: MEDIUM-HIGH — standard patterns from Prometheus docs + STACK; metric label contract assumes OTel conventions (A1, A4)

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (30 days — stable Prometheus API; verify if Prometheus 3.x breaking changes announced)
