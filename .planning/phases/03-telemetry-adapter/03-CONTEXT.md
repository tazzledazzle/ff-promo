# Phase 3: Telemetry Adapter - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build `packages/telemetry`: a Prometheus query adapter that evaluates SLO gates (error rate, p95 latency) and runs pre-flight health checks before promotion starts. Phase 3 delivers TELE-03 and TELE-04 — the evaluator that reads existing `GatePolicy` rows from Postgres and queries Prometheus via `/api/v1/query`. Does NOT include guardrail configuration UI/API (TELE-01/02 in Phase 7), Temporal workflow wiring (Phase 4), REST endpoints (Phase 5), or dashboard visualization (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Cohort Attribution & PromQL Contract
- **D-01:** Metrics attributed via standard OpenTelemetry/LD labels — instrumented apps emit `service`, `ld_flag_key`, `ld_variation_id` (or variation name), and `ld_context_kind`
- **D-02:** Gate verdicts use **delta vs control** — compare treatment cohort error rate / p95 latency to control cohort; fail when delta exceeds policy threshold (not absolute treatment-only SLO in v1)
- **D-03:** Enforce **`user` context kind** — adapter expects `ld_context_kind=user` on series; pre-flight verifies alignment with LD rollout bucket context from Phase 2
- **D-04:** **Built-in PromQL** from `GatePolicy` + run context (flag key, variation IDs, serviceName, windowSeconds) — do not store raw PromQL templates in GatePolicy in v1
- **D-05:** Service scoping uses existing `GatePolicy.serviceName` field (already in Prisma schema)

### Missing / Stale Data Policy
- **D-06:** **Fail closed** when Prometheus returns empty or no matching series — no promotion advancement on missing data
- **D-07:** **Fail below minSampleSize** — `GatePolicy.minSampleSize` is a hard floor; insufficient request/sample count = gate fail
- **D-08:** **Window-bound instant queries** — use `GatePolicy.windowSeconds` as the evaluation window in rate/histogram PromQL (`[window]`); data outside window counts as no data
- **D-09:** **All stage policies must pass** — a stage with multiple GatePolicies (e.g. `error_rate` + `latency_p95`) fails if any single policy fails

### Pre-flight Health Checks (TELE-04)
- **D-10:** Pre-flight runs **before promotion start** and verifies: (1) metric flow — queries return data for treatment and control, (2) minimum sample size met, (3) `user` context kind present on series
- **D-11:** Pre-flight failure **blocks promotion start** (fail closed, consistent with D-06)
- **D-12:** Pre-flight reuses the same query/evaluation machinery as runtime gates but returns a structured health report (not persisted as GateResult until Phase 4 wires it)

*Note: Pre-flight area was not explicitly discussed — decisions inferred from cohort + missing-data choices and TELE-04 requirement scope.*

### Local Dev & Testing
- **D-13:** **nock HTTP mocks** for unit/CI (mirror `@ff-promo/ld-adapter`); **optional docker-compose Prometheus profile** for manual e2e (not required in CI)
- **D-14:** `createPrometheusClient(config)` with **config param + env fallback** — `PROMETHEUS_BASE_URL`, optional bearer token; document in `.env.example`
- **D-15:** Package at **`packages/telemetry`** per STACK.md, mirroring `ld-adapter` layout (client, evaluate, preflight, fixtures, tests)
- **D-16:** **JSON fixtures** for Prometheus API responses under `src/__tests__/fixtures/`

### Claude's Discretion
- Exact PromQL expressions for `error_rate` and `latency_p95` delta-vs-control given standard labels
- Pre-flight response shape and error taxonomy (distinct from gate fail reasons)
- Docker Compose Prometheus optional profile wiring and seed scrape config
- Whether to normalize `latency_p95` vs `p95_latency_ms` metricType strings across seed/tests (schema uses free string)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — SLO gates only in v1, pause-and-alert posture, Prometheus as v1 telemetry source
- `.planning/REQUIREMENTS.md` — TELE-03 (evaluate SLO gates), TELE-04 (pre-flight health checks)
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, research flag on cohort delta query contract

### Stack & Architecture
- `.planning/research/STACK.md` — `packages/telemetry`, Prometheus HTTP API `/api/v1/query`, monorepo layout
- `.planning/phases/01-foundation-data-layer/01-CONTEXT.md` — GatePolicy schema fields, evaluateGate stub (D-11), GateResult persistence pattern
- `.planning/phases/02-launchdarkly-adapter/02-RESEARCH.md` — `rolloutContextKind` / `rolloutBucketBy` defaults for user context alignment

### Existing Code (integration points)
- `packages/db/prisma/schema.prisma` — `GatePolicy`, `GateResult` models
- `packages/contracts/src/pipeline.ts` — `GatePolicyInputSchema` (metricType, threshold, serviceName, windowSeconds, minSampleSize)
- `packages/contracts/src/gate-result.ts` — gate result contracts
- `apps/worker/src/activities/evaluate-gate.ts` — stub to replace in Phase 4 (Phase 3 builds adapter only)
- `packages/ld-adapter/` — adapter package pattern (client factory, rate limiting, nock tests, public exports)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GatePolicy` rows in Postgres with `metricType`, `threshold`, `serviceName`, `windowSeconds`, `minSampleSize` — evaluator reads these; no schema migration expected unless adding optional fields is unavoidable
- Seed pipeline (`packages/db/src/seed.ts`) defines `error_rate` (0.01) and `latency_p95` (500ms) policies for `demo-service` — use as fixture baseline
- `@ff-promo/ld-adapter` — mirror package structure: `client/`, contracts in `@ff-promo/contracts`, vitest project in root `vitest.config.ts`, nock integration tests

### Established Patterns
- Adapter packages are config-injected (no secrets from process.env inside core logic); env fallback at factory boundary
- Fail-closed resolution (Phase 2 variation/rule resolvers) — apply same posture to missing telemetry data
- Worker `evaluateGate` stub always passes — Phase 3 does not wire worker; Phase 4 swaps stub for real adapter calls

### Integration Points
- Phase 4 Temporal activity will call `packages/telemetry` with `GatePolicy[]` + run context (flagKey, treatment/control variation IDs, environment)
- `GateResultRepository` persists verdicts — adapter returns structured evaluation results; persistence stays in worker/API layer
- Metric type strings in seed (`latency_p95`) vs some tests (`p95_latency_ms`) — normalize during implementation

</code_context>

<specifics>
## Specific Ideas

- Cohort comparison is the v1 differentiator — absolute service-level SLOs alone don't catch canary regressions relative to control
- Pre-flight should catch "metrics not wired" before any LD writes happen in Phase 4
- Optional docker Prometheus is for operator manual validation, not CI gate

</specifics>

<deferred>
## Deferred Ideas

- **Pre-flight UX details** — explicit discussion deferred; inferred from TELE-04 + fail-closed choices
- **TELE-01/02 threshold configuration UI/API** — Phase 7 guardrails; Phase 3 consumes existing GatePolicy rows only
- **Datadog / other telemetry backends** — v2 per PROJECT.md
- **Inconclusive/third verdict state** — rejected; fail closed preferred
- **Raw PromQL templates in GatePolicy** — rejected for v1; built-in queries only

</deferred>

---
*Phase: 3-Telemetry Adapter*
*Context gathered: 2026-06-22*
