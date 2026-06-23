# Requirements: Feature Flag Promotion System

**Defined:** 2026-06-20
**Core Value:** Flags promote safely across environments only when telemetry confirms the rollout is healthy — failed gates pause promotion and alert operators rather than silently shipping broken changes.

## v1 Requirements

### Provider Integration

- [x] **PROV-01**: System reads flag state from LaunchDarkly (variations, targeting rules, environment)
- [x] **PROV-02**: System writes targeting updates to LaunchDarkly via semantic patch API
- [x] **PROV-03**: System resolves LaunchDarkly variation IDs per environment before promotion writes

### Promotion Pipeline

- [x] **PIPE-01**: Platform engineer defines multi-environment promotion pipeline (dev → staging → prod)
- [x] **PIPE-02**: Developer can start a promotion run for a flag through the defined pipeline
- [x] **PIPE-03**: System advances flag to next environment only when telemetry gates pass for current stage
- [x] **PIPE-04**: System blocks advancement when telemetry gates fail (holds at current environment)

### Telemetry Gates

- [x] **TELE-01**: Platform engineer configures error rate SLO threshold per pipeline stage
- [x] **TELE-02**: Platform engineer configures latency (p95) SLO threshold per pipeline stage
- [x] **TELE-03**: System evaluates SLO gates against Prometheus metrics for the target service
- [x] **TELE-04**: System runs pre-flight health checks before promotion starts (metric flow, minimum sample size, context kind alignment)

### Guardrails & Access

- [x] **GRD-01**: Platform engineer configures guardrails (SLO thresholds, allowed environments, promotion policies)
- [x] **GRD-02**: Developer can trigger promotion within configured guardrail bounds without platform team intervention
- [x] **GRD-03**: System enforces guardrails server-side (rejects out-of-bounds promotion requests)

### API

- [x] **API-01**: Operator can create, start, pause, resume, and abort promotion runs via REST API
- [x] **API-02**: Operator can query promotion run status and gate evaluation history via REST API
- [x] **API-03**: Platform engineer can configure pipelines and guardrails via REST API

### Dashboard

- [x] **UI-01**: Operator can view active and historical promotion runs with current environment stage
- [x] **UI-02**: Operator can view telemetry gate status (pass/fail, metric values) per promotion run
- [x] **UI-03**: Operator can trigger promotion actions (start, pause, resume, abort) from dashboard
- [x] **UI-04**: Operator can configure guardrails and pipelines from dashboard

### Safety & Compliance

- [x] **SAFE-01**: System records audit trail for all promotion events (actor, action, timestamp, gate results)
- [x] **SAFE-02**: Operator can emergency-stop an in-flight promotion immediately via API or dashboard

## v2.0 Kotlin Migration Requirements

**Milestone:** Re-implement backend in Kotlin with v1 behavioral parity. Next.js dashboard retained.

### Platform

- [x] **KOT-01**: Gradle Kotlin DSL multi-module monorepo builds all backend services from repo root
- [ ] **KOT-02**: Kotlin REST API exposes v1-compatible OpenAPI contract (same paths, request/response JSON shapes)
- [x] **KOT-03**: PostgreSQL schema preserved via Flyway; domain model matches v1 Prisma schema
- [x] **KOT-04**: Docker Compose dev stack runs Kotlin API + worker against postgres + temporal
- [ ] **KOT-05**: TypeScript backend (`apps/api`, `apps/worker`, `packages/*`) deprecated from active deploy path
- [ ] **KOT-06**: Parity test suite validates Kotlin behavior against v1 requirement catalog (23 reqs)

### Functional Parity (re-implemented on Kotlin)

All v1 functional requirements below are **in scope for v2** — status resets to pending until Kotlin phase completes. TypeScript v1 remains the reference implementation during migration.

| v1 ID | v2 Phase | Parity focus |
|-------|----------|--------------|
| PROV-01–03 | Phase 9 | LaunchDarkly read/write/resolution |
| TELE-01–04 | Phase 10 | SLO config types + PromQL gates + preflight |
| PIPE-01–04 | Phases 11, 14 | Engine progression + pipeline CRUD |
| GRD-01–03 | Phase 14 | Guardrail validation + server enforcement |
| API-01–03 | Phases 12, 14 | Promotion + pipeline REST |
| UI-01–04 | Phases 13, 14 | Dashboard against Kotlin API |
| SAFE-01–02 | Phases 8, 11 | Audit trail + emergency stop |

## v2 Feature Requirements (post-Kotlin)

Deferred until after Kotlin cutover. Not in v2.0 roadmap phases 8–14.

### Promotion Pipeline

- **PIPE-05**: Sub-stage rollout within environment transitions (pre-release → canary → stagger percentages)
- **PIPE-06**: Unified pipeline run as single tracked unit across all environments and sub-stages

### Telemetry & Alerting

- **TELE-05**: System pauses promotion and sends alert on telemetry breach (Slack/PagerDuty integrations)
- **TELE-06**: Soak time intervals between sub-stages after gates pass

### Interfaces

- **API-04**: CLI for developer promotion workflows from terminal
- **GRD-04**: Role-based access control (platform admin vs developer roles)

### Governance

- **GRD-05**: Approval gates configurable per pipeline stage
- **GRD-06**: Pipeline templates for reusable promotion patterns

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic rollback on telemetry breach | v1 blocks advancement; rollback is manual operator decision (reduces false-positive blast radius) |
| Multi-provider support beyond LaunchDarkly | Prove orchestration with one adapter first; v2 expansion |
| Custom business metric gates | v1 SLO gates (error rate + latency) only; business metrics require attribution infrastructure |
| Flag authoring / segment management | Orchestration layer complements LaunchDarkly; does not replace flag store |
| A/B experiment design | Different product surface; integrate with LD experiments separately |
| GitOps-as-source-of-truth | Provider-as-runtime model; Git sync is v2+ |
| Infrastructure-level canary (K8s/Argo) | Orchestrates flag targeting; deployment canaries are separate concern |

## Traceability

### v1.0 TypeScript (shipped)

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAFE-01 | Phase 1 | Complete (TS) |
| PROV-01 | Phase 2 | Complete (TS) |
| PROV-02 | Phase 2 | Complete (TS) |
| PROV-03 | Phase 2 | Complete (TS) |
| TELE-03 | Phase 3 | Complete (TS) |
| TELE-04 | Phase 3 | Complete (TS) |
| PIPE-02 | Phase 4 | Complete (TS) |
| PIPE-03 | Phase 4 | Complete (TS) |
| PIPE-04 | Phase 4 | Complete (TS) |
| SAFE-02 | Phase 4 | Complete (TS) |
| API-01 | Phase 5 | Complete (TS) |
| API-02 | Phase 5 | Complete (TS) |
| UI-01 | Phase 6 | Complete (TS) |
| UI-02 | Phase 6 | Complete (TS) |
| UI-03 | Phase 6 | Complete (TS) |
| PIPE-01 | Phase 7 | Complete (TS) |
| TELE-01 | Phase 7 | Complete (TS) |
| TELE-02 | Phase 7 | Complete (TS) |
| GRD-01 | Phase 7 | Complete (TS) |
| GRD-02 | Phase 7 | Complete (TS) |
| GRD-03 | Phase 7 | Complete (TS) |
| API-03 | Phase 7 | Complete (TS) |
| UI-04 | Phase 7 | Complete (TS) |

### v2.0 Kotlin (planned)

| Requirement | Phase | Status |
|-------------|-------|--------|
| KOT-01 | Phase 8 | Complete |
| KOT-03 | Phase 8 | Complete |
| KOT-04 | Phase 8 | Complete |
| SAFE-01 | Phase 8 | Complete (Kotlin parity) |
| PROV-01 | Phase 9 | Pending |
| PROV-02 | Phase 9 | Pending |
| PROV-03 | Phase 9 | Pending |
| TELE-01 | Phase 10 | Pending |
| TELE-02 | Phase 10 | Pending |
| TELE-03 | Phase 10 | Pending |
| TELE-04 | Phase 10 | Pending |
| PIPE-02 | Phase 11 | Pending |
| PIPE-03 | Phase 11 | Pending |
| PIPE-04 | Phase 11 | Pending |
| SAFE-02 | Phase 11 | Pending |
| API-01 | Phase 12 | Pending |
| API-02 | Phase 12 | Pending |
| KOT-02 | Phase 12 | Pending |
| UI-01 | Phase 13 | Pending |
| UI-02 | Phase 13 | Pending |
| UI-03 | Phase 13 | Pending |
| PIPE-01 | Phase 14 | Pending |
| GRD-01 | Phase 14 | Pending |
| GRD-02 | Phase 14 | Pending |
| GRD-03 | Phase 14 | Pending |
| API-03 | Phase 14 | Pending |
| UI-04 | Phase 14 | Pending |
| KOT-05 | Phase 14 | Pending |
| KOT-06 | Phase 14 | Pending |

**Coverage:**
- v2.0 platform requirements (KOT-01–06): 6 total, mapped: 6 ✓
- v2.0 functional parity (re-mapped v1 IDs): 23 total, mapped: 23 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-20*
*Last updated: 2026-06-20 — v2.0 Kotlin migration milestone*
