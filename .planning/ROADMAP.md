# Roadmap: Feature Flag Promotion System

## Overview

Build a telemetry-gated feature flag promotion orchestrator in horizontal layers: establish domain persistence and audit foundation, prove LaunchDarkly and Prometheus adapter integrations, implement the Temporal promotion engine with environment progression and safety controls, expose REST control plane endpoints, deliver the operator dashboard, and wrap with platform guardrails and developer self-service. Each layer unlocks the next until flags promote safely across dev → staging → prod only when SLO gates pass.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation & Data Layer** - Domain models, PostgreSQL persistence, audit trail, Temporal workflow scaffolding (completed 2026-06-22)
- [x] **Phase 2: LaunchDarkly Adapter** - Read flag state, semantic patch writes, per-environment variation ID resolution (completed 2026-06-22)
- [x] **Phase 3: Telemetry Adapter** - Prometheus SLO evaluation and pre-flight health checks (completed 2026-06-22)
- [ ] **Phase 4: Promotion Engine** - Temporal pipeline orchestration with environment progression and emergency stop
- [ ] **Phase 5: REST API** - Programmatic promotion control and status/history queries
- [ ] **Phase 6: Operator Dashboard** - Pipeline status, telemetry visualization, and promotion actions
- [ ] **Phase 7: Guardrails & Self-Service** - Platform configuration, server-side enforcement, developer self-service within bounds

## Phase Details

### Phase 1: Foundation & Data Layer

**Goal**: System has durable domain persistence and audit infrastructure for all promotion activity
**Depends on**: Nothing (first phase)
**Requirements**: SAFE-01
**Success Criteria** (what must be TRUE):

  1. System persists pipeline definitions, promotion runs, and gate results across restarts
  2. Every promotion event (actor, action, timestamp, gate results) is recorded in an append-only audit log
  3. Operator can query audit history for a promotion run via the data layer
  4. Temporal worker can start a durable promotion workflow skeleton tied to a persisted run record

**Plans:** 6/6 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Monorepo workspace and app/package shells (pnpm, turbo)
- [x] 01-06-PLAN.md — Docker Compose, Vitest harness, testcontainers setup (D-12, D-15)
- [x] 01-02-PLAN.md — Prisma schema, Zod contracts, [BLOCKING] initial migration

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-03-PLAN.md — Repositories, append-only audit, SAFE-01 integration tests

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Temporal worker FSM skeleton with signals and stub activities

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Seed data, smoke tests, README dev workflow

### Phase 2: LaunchDarkly Adapter

**Goal**: System reliably reads and writes flag targeting state in LaunchDarkly per environment
**Depends on**: Phase 1
**Requirements**: PROV-01, PROV-02, PROV-03
**Success Criteria** (what must be TRUE):

  1. Operator can read flag variations, targeting rules, and environment state from LaunchDarkly
  2. System applies targeting updates to LaunchDarkly via semantic patch API
  3. System resolves correct variation IDs per environment before any promotion write
  4. System handles LaunchDarkly rate limits without corrupting flag state

**Plans:** 4/4 plans complete

Plans:
**Wave 0**

- [x] 02-01-PLAN.md — ld-adapter scaffold, contracts, LD client factory

**Wave 1** *(blocked on Wave 0)*

- [x] 02-02-PLAN.md — GET flag state (PROV-01) + variation/rule resolvers (PROV-03)

**Wave 2** *(blocked on Wave 1)*

- [x] 02-03-PLAN.md — Semantic patch writes (PROV-02) + rate limiting

**Wave 3** *(blocked on Wave 2)*

- [x] 02-04-PLAN.md — nock HTTP integration tests + public exports

### Phase 3: Telemetry Adapter

**Goal**: System evaluates SLO gates and pre-flight health checks against Prometheus metrics
**Depends on**: Phase 1
**Requirements**: TELE-03, TELE-04
**Success Criteria** (what must be TRUE):

  1. System evaluates error rate SLO gates against Prometheus metrics for the target service
  2. System evaluates latency (p95) SLO gates against Prometheus metrics for the target service
  3. Operator receives pre-flight health check results before promotion starts (metric flow, minimum sample size, context kind alignment)
  4. System blocks promotion start when pre-flight health checks fail

**Plans:** 4/4 plans complete

Plans:
**Wave 0**

- [x] 03-01-PLAN.md — telemetry scaffold, contracts, Prometheus client factory (D-14, D-15)

**Wave 1** *(blocked on Wave 0)*

- [x] 03-02-PLAN.md — Built-in PromQL builders + fail-closed response parser (TELE-03, D-04, D-06)

**Wave 2** *(blocked on Wave 1)*

- [x] 03-03-PLAN.md — Gate evaluation, stage gates, pre-flight health checks (TELE-03, TELE-04)

**Wave 3** *(blocked on Wave 2)*

- [x] 03-04-PLAN.md — nock HTTP integration tests + public exports + optional Prometheus profile (TELE-03, TELE-04)

### Phase 4: Promotion Engine

**Goal**: Flags advance across environments only when telemetry gates pass; failed gates hold progression
**Depends on**: Phase 2, Phase 3
**Requirements**: PIPE-02, PIPE-03, PIPE-04, SAFE-02
**Success Criteria** (what must be TRUE):

  1. Developer can start a promotion run for a flag through a defined pipeline
  2. System advances flag to the next environment only when telemetry gates pass for the current stage
  3. System holds at the current environment when telemetry gates fail (no silent advancement)
  4. Operator can emergency-stop an in-flight promotion immediately

**Plans**: TBD

### Phase 5: REST API

**Goal**: Operators control promotions and query status programmatically via REST
**Depends on**: Phase 4
**Requirements**: API-01, API-02
**Success Criteria** (what must be TRUE):

  1. Operator can create, start, pause, resume, and abort promotion runs via REST API
  2. Operator can query promotion run status and gate evaluation history via REST API
  3. API responses include structured gate forensics (metric values, pass/fail, stage context) on pause events

**Plans**: TBD

### Phase 6: Operator Dashboard

**Goal**: Operators monitor promotion health and control runs from a web interface
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):

  1. Operator can view active and historical promotion runs with current environment stage
  2. Operator can view telemetry gate status (pass/fail, metric values) per promotion run
  3. Operator can trigger promotion actions (start, pause, resume, abort) from the dashboard

**Plans**: TBD
**UI hint**: yes

### Phase 7: Guardrails & Self-Service

**Goal**: Platform engineers configure guardrails; developers self-serve promotions within enforced bounds
**Depends on**: Phase 6
**Requirements**: PIPE-01, TELE-01, TELE-02, GRD-01, GRD-02, GRD-03, API-03, UI-04
**Success Criteria** (what must be TRUE):

  1. Platform engineer can define multi-environment promotion pipelines (dev → staging → prod)
  2. Platform engineer can configure error rate and latency (p95) SLO thresholds per pipeline stage
  3. Platform engineer can configure guardrails (SLO thresholds, allowed environments, promotion policies) via REST API and dashboard
  4. Developer can trigger promotion within configured guardrail bounds without platform team intervention
  5. System rejects out-of-bounds promotion requests server-side

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Data Layer | 6/6 | Complete   | 2026-06-22 |
| 2. LaunchDarkly Adapter | 4/4 | Complete   | 2026-06-22 |
| 3. Telemetry Adapter | 4/4 | Complete    | 2026-06-22 |
| 4. Promotion Engine | 0/4 | Planned | - |
| 5. REST API | 0/TBD | Not started | - |
| 6. Operator Dashboard | 0/TBD | Not started | - |
| 7. Guardrails & Self-Service | 0/TBD | Not started | - |

## Research Flags

Phases likely needing `/gsd-plan-phase --research-phase`:

- **Phase 2:** LaunchDarkly semantic patch edge cases (variation ID resolution, atomic patches, 429 rate limits)
- **Phase 3:** Cohort delta query contract (treatment vs control labeling, baseline semantics, minimum sample thresholds)
- **Phase 4:** Temporal workflow design for multi-hour stages with pause/resume signals and idempotent LD writes

Phases with standard patterns (likely skip research-phase):

- **Phase 1:** TypeScript monorepo + Prisma + Temporal local dev
- **Phase 5:** Fastify REST + OpenAPI
- **Phase 6:** Next.js ops dashboard with Tanstack Query polling

---
*Roadmap created: 2026-06-20*
