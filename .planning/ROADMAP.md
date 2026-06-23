# Roadmap: Feature Flag Promotion System

## Milestones

- ✅ **v1.0 TypeScript** — Phases 1–7 (shipped 2026-06-22)
- 📋 **v2.0 Kotlin** — Phases 8–14 (planned)

## Overview

v1 delivered a telemetry-gated feature flag promotion orchestrator in TypeScript (pnpm monorepo, Fastify, Temporal, Prisma, Next.js). **v2 re-implements the backend in Kotlin** with behavioral parity, v1-compatible REST contracts, and the existing Next.js dashboard pointed at the new services. Phases follow the same horizontal layers as v1 so each slice can be validated against the TypeScript reference before cutover.

**Target stack:** Gradle Kotlin DSL multi-module, Ktor REST, Exposed + Flyway, Temporal Java SDK (Kotlin), LaunchDarkly Java SDK, kotlinx-serialization contracts. Dashboard remains Next.js (API contract stable via OpenAPI).

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- v2 continues numbering from Phase 8 (no reset)

<details>
<summary>✅ v1.0 TypeScript (Phases 1–7) — SHIPPED 2026-06-22</summary>

- [x] **Phase 1: Foundation & Data Layer** - Domain models, PostgreSQL persistence, audit trail, Temporal workflow scaffolding
- [x] **Phase 2: LaunchDarkly Adapter** - Read flag state, semantic patch writes, per-environment variation ID resolution
- [x] **Phase 3: Telemetry Adapter** - Prometheus SLO evaluation and pre-flight health checks
- [x] **Phase 4: Promotion Engine** - Temporal pipeline orchestration with environment progression and emergency stop
- [x] **Phase 5: REST API** - Programmatic promotion control and status/history queries
- [x] **Phase 6: Operator Dashboard** - Pipeline status, telemetry visualization, and promotion actions
- [x] **Phase 7: Guardrails & Self-Service** - Platform configuration, server-side enforcement, developer self-service within bounds

See git history and `.planning/phases/0*-*/` for v1 plan summaries. All v1 requirements except SAFE-01 checkbox drift are implemented in TypeScript.

</details>

### 📋 v2.0 Kotlin (Planned)

- [x] **Phase 8: Kotlin Foundation & Data Layer** - Gradle monorepo, kotlinx-serialization contracts, Exposed/Flyway, audit repositories, Temporal worker shell (completed 2026-06-20)
- [ ] **Phase 9: LaunchDarkly Adapter (Kotlin)** - Flag read/write parity with v1 ld-adapter
- [ ] **Phase 10: Telemetry Adapter (Kotlin)** - PromQL builder, gate evaluation, preflight checks
- [ ] **Phase 11: Promotion Engine (Kotlin)** - Temporal workflow, activities, pause/resume/abort signals
- [ ] **Phase 12: REST API (Kotlin)** - Ktor routes matching v1 OpenAPI contract
- [ ] **Phase 13: Dashboard Integration** - Next.js dashboard runs against Kotlin API (BFF unchanged)
- [ ] **Phase 14: Guardrails, Parity & Cutover** - Pipeline CRUD, guardrail enforcement, contract tests, TS backend deprecation

## Phase Details

<details>
<summary>v1.0 Phase Details (Phases 1–7, complete)</summary>

### Phase 1: Foundation & Data Layer

**Goal**: System has durable domain persistence and audit infrastructure for all promotion activity
**Depends on**: Nothing (first phase)
**Requirements**: SAFE-01
**Success Criteria**: Persisted pipelines/runs/gates; append-only audit; Temporal skeleton
**Plans:** 6/6 complete

### Phase 2: LaunchDarkly Adapter

**Goal**: System reads and writes LaunchDarkly flag state reliably per environment
**Depends on**: Phase 1
**Requirements**: PROV-01, PROV-02, PROV-03
**Plans:** 4/4 complete

### Phase 3: Telemetry Adapter

**Goal**: System evaluates SLO gates and pre-flight checks against Prometheus
**Depends on**: Phase 1
**Requirements**: TELE-03, TELE-04
**Plans:** 4/4 complete

### Phase 4: Promotion Engine

**Goal**: Flags promote across environments with telemetry-gated progression and emergency stop
**Depends on**: Phases 2, 3
**Requirements**: PIPE-02, PIPE-03, PIPE-04, SAFE-02
**Plans:** 4/4 complete

### Phase 5: REST API

**Goal**: Operators control and query promotions programmatically via REST
**Depends on**: Phase 4
**Requirements**: API-01, API-02
**Plans:** 4/4 complete

### Phase 6: Operator Dashboard

**Goal**: Operators visualize runs, gate forensics, and trigger control actions in the browser
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03
**Plans:** 4/4 complete
**UI hint**: yes

### Phase 7: Guardrails & Self-Service

**Goal**: Platform engineers configure pipelines/guardrails; developers self-serve within server-enforced bounds
**Depends on**: Phases 5, 6
**Requirements**: PIPE-01, TELE-01, TELE-02, GRD-01, GRD-02, GRD-03, API-03, UI-04
**Plans:** 4/4 complete
**UI hint**: yes

</details>

### Phase 8: Kotlin Foundation & Data Layer

**Goal**: Kotlin backend has the same durable domain model and audit infrastructure as v1 TypeScript
**Depends on**: v1.0 complete (reference implementation)
**Requirements**: KOT-01, KOT-03, KOT-04, SAFE-01
**Success Criteria** (what must be TRUE):

  1. `./gradlew build` succeeds for all Kotlin modules from repo root
  2. Flyway migrations create the same PostgreSQL schema as v1 Prisma (pipelines, stages, gate policies, promotion runs, audit events, config audit)
  3. Kotlin repositories persist and load nested pipeline + promotion run graphs matching v1 integration test scenarios
  4. Temporal Kotlin worker process starts and registers workflow/activity stubs against dev Temporal server
  5. Docker Compose stack runs Kotlin worker + postgres + temporal without TypeScript API/worker

**Plans:** 5/5 complete

Plans:
**Wave 0**

- [x] 08-01-PLAN.md — Gradle kotlin/ subroot + kotlinx-serialization contracts (KOT-01)

**Wave 1** *(blocked on Wave 0)*

- [x] 08-02-PLAN.md — Flyway V1/V2 SQL port + Exposed tables + DatabaseFactory (KOT-03)

**Wave 2** *(blocked on Wave 1)*

- [x] 08-03-PLAN.md — Five repositories + SAFE-01 integration tests ported from v1

**Wave 3** *(blocked on Wave 2)*

- [x] 08-04-PLAN.md — Temporal worker shell, stub activities, workflow signals (KOT-04, SAFE-01)

**Wave 4** *(blocked on Wave 3)*

- [x] 08-05-PLAN.md — Docker Compose kotlin profile + README dev workflow (KOT-04)

### Phase 9: LaunchDarkly Adapter (Kotlin)

**Goal**: Kotlin services read flag state and apply semantic targeting patches with the same behavior as v1
**Depends on**: Phase 8
**Requirements**: PROV-01, PROV-02, PROV-03
**Success Criteria** (what must be TRUE):

  1. Kotlin adapter reads flag variations and environment targeting state from LaunchDarkly REST API
  2. Kotlin adapter applies semantic patch targeting updates atomically per environment
  3. Kotlin adapter resolves variation IDs per environment before writes (same edge cases as v1 nock tests)
  4. Rate limiting and retry behavior matches v1 adapter contract tests

**Plans**: TBD

### Phase 10: Telemetry Adapter (Kotlin)

**Goal**: Kotlin services evaluate error_rate and latency_p95 gates and run preflight checks against Prometheus
**Depends on**: Phase 8
**Requirements**: TELE-03, TELE-04, TELE-01, TELE-02
**Success Criteria** (what must be TRUE):

  1. PromQL queries for error_rate and latency_p95 produce identical query strings to v1 for equivalent inputs
  2. Gate evaluation returns pass/fail verdicts matching v1 golden fixtures for sample Prometheus responses
  3. Preflight checks detect missing metrics, insufficient sample size, and context misalignment
  4. Shared contract types encode per-stage SLO thresholds (error_rate + latency_p95 required per stage)

**Plans**: TBD

### Phase 11: Promotion Engine (Kotlin)

**Goal**: Kotlin Temporal workflow orchestrates multi-environment promotion with pause, resume, and abort
**Depends on**: Phases 9, 10
**Requirements**: PIPE-02, PIPE-03, PIPE-04, SAFE-02
**Success Criteria** (what must be TRUE):

  1. Operator can start a promotion run that progresses dev → staging → prod when gates pass
  2. Failed telemetry gates pause advancement at current environment (no silent skip)
  3. Operator can pause, resume, and emergency-abort in-flight runs via Temporal signals
  4. Gate results and audit events persist through Kotlin activities with same action taxonomy as v1

**Plans**: TBD

### Phase 12: REST API (Kotlin)

**Goal**: Ktor exposes v1-compatible REST endpoints for promotion control and read queries
**Depends on**: Phase 11
**Requirements**: API-01, API-02, KOT-02
**Success Criteria** (what must be TRUE):

  1. All v1 promotion-run endpoints respond with equivalent status codes and JSON shapes (OpenAPI diff clean)
  2. Operator can create, start, pause, resume, and abort runs via Kotlin API
  3. Operator can query run status, gate results, and audit events via Kotlin API
  4. API key auth and error response envelope match v1 (`error`, `message` fields)

**Plans**: TBD

### Phase 13: Dashboard Integration

**Goal**: Existing Next.js dashboard operates fully against the Kotlin backend
**Depends on**: Phase 12
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):

  1. `/runs` list and `/runs/[id]` detail pages load data from Kotlin API via BFF proxy
  2. Operator sees gate forensics and live workflow status on run detail
  3. Control bar actions (start, pause, resume, abort) succeed against Kotlin API
  4. Existing web Vitest integration tests pass with MSW handlers pointed at Kotlin contract fixtures

**Plans**: TBD

**UI hint**: yes

### Phase 14: Guardrails, Parity & Cutover

**Goal**: Kotlin backend achieves full v1 feature parity including pipeline configuration; TypeScript backend retired from active path
**Depends on**: Phase 13
**Requirements**: PIPE-01, GRD-01, GRD-02, GRD-03, API-03, UI-04, KOT-05, KOT-06
**Success Criteria** (what must be TRUE):

  1. Platform engineer can create/deactivate pipelines with gate policies via Kotlin POST/PATCH /v1/pipelines
  2. Server rejects out-of-bounds promotion requests (inactive pipeline, flagKey mismatch, missing metrics)
  3. Dashboard `/pipelines` pages work against Kotlin API (list, create, detail, deactivate)
  4. Contract/parity test suite compares Kotlin vs v1 behavior for all 23 v1 requirements
  5. README and Docker Compose document Kotlin as default backend; TypeScript apps marked deprecated or archived

**Plans**: TBD

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 8 → 9 → 10 → 11 → 12 → 13 → 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Data Layer | v1.0 | 6/6 | Complete | 2026-06-22 |
| 2. LaunchDarkly Adapter | v1.0 | 4/4 | Complete | 2026-06-22 |
| 3. Telemetry Adapter | v1.0 | 4/4 | Complete | 2026-06-22 |
| 4. Promotion Engine | v1.0 | 4/4 | Complete | 2026-06-22 |
| 5. REST API | v1.0 | 4/4 | Complete | 2026-06-22 |
| 6. Operator Dashboard | v1.0 | 4/4 | Complete | 2026-06-22 |
| 7. Guardrails & Self-Service | v1.0 | 4/4 | Complete | 2026-06-22 |
| 8. Kotlin Foundation & Data Layer | v2.0 | 5/5 | Complete | 2026-06-20 |
| 9. LaunchDarkly Adapter (Kotlin) | v2.0 | 0/TBD | Not started | - |
| 10. Telemetry Adapter (Kotlin) | v2.0 | 0/TBD | Not started | - |
| 11. Promotion Engine (Kotlin) | v2.0 | 0/TBD | Not started | - |
| 12. REST API (Kotlin) | v2.0 | 0/TBD | Not started | - |
| 13. Dashboard Integration | v2.0 | 0/TBD | Not started | - |
| 14. Guardrails, Parity & Cutover | v2.0 | 0/TBD | Not started | - |

## Research Flags

Phases likely needing `/gsd-plan-phase --research-phase`:

- **Phase 8:** Gradle module layout, Exposed vs jOOQ, Flyway from Prisma schema, kotlinx-serialization validation patterns
- **Phase 9:** LaunchDarkly Java SDK vs hand-rolled REST (parity with v1 semantic patch builder)
- **Phase 10:** Prometheus HTTP client in Kotlin, PromQL string parity with v1 `build-promql.ts`
- **Phase 11:** Temporal Java SDK + Kotlin coroutines in activities, workflow signal naming parity
- **Phase 14:** Contract testing strategy (Pact, golden files, or shared OpenAPI conformance suite)

Phases with standard patterns (likely skip research-phase):

- **Phase 12:** Ktor routing + OpenAPI (well-documented Fastify → Ktor port)
- **Phase 13:** Next.js BFF proxy unchanged; env var swap only

---
*Roadmap created: 2026-06-20 (v1)*
*Last updated: 2026-06-20 — v2.0 Kotlin migration milestone added*
