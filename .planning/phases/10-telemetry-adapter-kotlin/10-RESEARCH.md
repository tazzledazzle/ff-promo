# Phase 10: Telemetry Adapter (Kotlin) - Research

**Researched:** 2026-06-22
**Domain:** Prometheus PromQL gate evaluation, cohort delta comparison, preflight health checks
**Confidence:** HIGH (v1 reference); HIGH (OkHttp + MockWebServer pattern from Phase 9)

## Summary

Phase 10 ports `packages/telemetry` to **`kotlin/modules/telemetry`** with behavioral parity against v1 nock/MockWebServer tests. v1 uses hand-rolled `fetch` to Prometheus `/api/v1/query` with p-retry on 503 [VERIFIED: `prometheus-client.ts`]. PromQL builders in `build-promql.ts` are pure functions — **golden string parity is the critical contract** for TELE-03 [VERIFIED: `promql-builder.test.ts`]. Gate evaluation compares treatment vs control cohort deltas (not absolute SLO) per policy threshold [VERIFIED: `evaluate-gate-policy.ts`].

**Primary recommendation:** Add **`kotlin/modules/telemetry`** depending on **`:contracts`** (extend with `Telemetry.kt` from `packages/contracts/src/telemetry.ts`). Use **OkHttp** for Prometheus instant queries (same stack as ld-adapter). Port PromQL builders verbatim; port `parseInstantQueryResult` fail-closed semantics. Test with **MockWebServer** + copied v1 JSON fixtures.

**TELE-01/02 note:** Per-stage SLO threshold *configuration* lives in `GatePolicyInput` (already in `Pipeline.kt` from Phase 8). Phase 10 implements *evaluation* of those policies — configuration parity is Phase 14 guardrails; contracts already encode `error_rate` + `latency_p95` via `MetricType` enum.

<user_constraints>
## Locked Decisions

- **TELE-03/04:** Kotlin evaluation + preflight match v1 semantics
- **Parity baseline:** `packages/telemetry` tests and fixtures are golden reference
- **Cohort model:** treatment vs control delta comparison (D-04 from v1)
- **Fail-closed:** parse errors → gate fail, not throw (except unexpected errors)
- **ld_context_kind="user"** hardcoded in PromQL label selector (v1 behavior)

### Claude's Discretion

- OkHttp vs java.net.http (recommend OkHttp — consistent with ld-adapter)
- Retry: port p-retry 503-only semantics vs Resilience4j (recommend port v1)
- GatePolicyInput location: already in Pipeline.kt; Telemetry.kt for eval types only

### Out of Scope Phase 10

- Worker activity wiring (Phase 11)
- Ktor routes (Phase 12)
- Live Prometheus in CI (MockWebServer only)
- Custom PromQL / non-standard metric types
</user_constraints>

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| TELE-03 | SLO gates against Prometheus | evaluateGatePolicy + evaluateStageGates + PromQL builders |
| TELE-04 | Pre-flight health checks | runPreflightChecks (metric flow, min sample, context kind) |
| TELE-01 | Configure error_rate threshold per stage | GatePolicyInput.metricType + threshold (contracts); eval uses them |
| TELE-02 | Configure latency_p95 threshold per stage | Same; buildLatencyP95Query |
</phase_requirements>

## Standard Stack

| Library | Version | Purpose |
|---------|---------|---------|
| OkHttp | 4.12.0 | Prometheus HTTP client (reuse pin from Phase 9) |
| kotlinx-serialization-json | 1.8.0 | Parse Prometheus JSON envelope |
| kotlinx-coroutines | 1.10.1 | Async queryInstant |
| mockwebserver | 4.12.0 | nock port |
| JUnit 5 | 5.11.4 | Tests |

**NOT:** Prometheus Java client library (unnecessary for instant query API)

## Architecture

```
kotlin/modules/
  contracts/Telemetry.kt          # GateRunContext, GateEvaluationResult, PreflightReport, PrometheusClientConfig
  telemetry/
    client/PrometheusClient.kt
    query/BuildPromql.kt, ParseResponse.kt
    evaluate/EvaluateGatePolicy.kt, EvaluateStageGates.kt
    preflight/RunPreflight.kt
    errors/TelemetryAdapterError.kt
```

## v1 Plan Wave Mapping

| v1 Phase 3 | Phase 10 |
|------------|----------|
| 03-01 scaffold + client | 10-01 module + Telemetry.kt + PrometheusClient |
| 03-02 PromQL + parser | 10-02 build-promql + parse-response golden tests |
| 03-03 evaluate + preflight | 10-03 gate evaluation + stage gates + preflight |
| 03-04 integration tests | 10-04 MockWebServer + fixtures + docs |

## Pitfalls

1. **PromQL string drift** — copy builders line-for-line; golden tests assert exact strings
2. **Scalar vs vector parsing** — port both paths in parseInstantQueryResult
3. **NaN/Inf** — fail-closed as non_finite_value
4. **Latency ms conversion** — `* 1000` on histogram_quantile result
5. **minSampleSize default 0** — both cohorts must pass sample check when > 0

---
*Research complete. Ready for PLAN.md generation.*
