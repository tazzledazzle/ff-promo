# Feature Flag Promotion System

## What This Is

A production-grade orchestration layer that automates feature flag promotion across environments (dev → staging → prod) with telemetry-gated progression through pre-release, canary, and stagger periods. Platform engineers configure guardrails and pipelines; application developers trigger and monitor self-service promotions. Integrates with LaunchDarkly as the first provider adapter.

## Core Value

Flags promote safely across environments only when telemetry confirms the rollout is healthy — failed gates pause promotion and alert operators rather than silently shipping broken changes.

## Requirements

### Validated

- v1.0 TypeScript milestone shipped 2026-06-22 — see Traceability (v1.0) for requirement-level status

### Active (v2.0 Kotlin Migration)

- [ ] Re-implement backend services in Kotlin (Gradle multi-module: API, worker, adapters, data layer)
- [ ] Preserve v1 REST API contract — Next.js dashboard continues without rewrite
- [ ] Maintain PostgreSQL domain schema and audit semantics via Flyway + Exposed
- [ ] Achieve behavioral parity with v1 TypeScript for all 23 functional requirements
- [ ] Retire TypeScript backend from active deploy path after parity validation

### Validated (v1.0 TypeScript — shipped 2026-06-22)

- [x] Orchestrate environment-based promotion pipeline (dev → staging → prod)
- [x] Gate each promotion stage on error rate and latency SLO thresholds
- [x] LaunchDarkly adapter for flag state reads and targeting updates
- [x] REST API for programmatic promotion control
- [x] Web dashboard for pipeline status, promotion controls, and telemetry visualization
- [x] Platform guardrails configurable by release engineers
- [x] Developer self-service promotion within guardrail constraints

### Deferred from v1 Active

- [ ] Support pre-release, canary, and stagger rollout periods within each environment transition (PIPE-05, v2 features)
- [ ] Pause promotion and alert on telemetry breach integrations (TELE-05, v2 features)
- [ ] CLI for programmatic promotion control (API-04, v2 features)

### Out of Scope

- Automatic rollback on telemetry breach — v1 pauses and alerts; rollback is manual (reduces blast radius of false positives)
- Multi-provider support beyond LaunchDarkly — deferred to v2 after orchestration is proven
- Custom business metric gates — v1 focuses on SLO-style error rate and latency thresholds
- Flag authoring or A/B experiment design — system orchestrates promotion, not flag creation

## Context

Progressive delivery is table stakes for production systems, but most teams either promote flags manually or rely entirely on provider-native percentage rollouts without telemetry feedback loops. This product fills the gap: an opinionated promotion orchestrator that enforces environment progression with measurable safety gates.

Target users:
- **Platform / release engineers** — define promotion pipelines, SLO thresholds, environment policies, and alerting
- **Application developers** — trigger promotions, monitor rollout health, respond to paused pipelines

Integration model: orchestration layer on top of LaunchDarkly. The system reads flag state and telemetry, decides when to advance or pause, and writes targeting changes back to LaunchDarkly.

## Constraints

- **Integration**: LaunchDarkly as first provider adapter — proves orchestration before expanding
- **Telemetry**: Error rate and latency SLO thresholds only in v1 — keeps gate logic focused and testable
- **Failure mode**: Pause-and-alert on breach — operators decide whether to rollback or resume
- **Interface**: API, CLI, and dashboard all required in v1 — operators and developers need different surfaces
- **Promotion model**: Environment-based progression (dev → staging → prod) with sub-stages (pre-release, canary, stagger) within transitions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Orchestration layer, not standalone flag store | Teams already use LaunchDarkly; avoid migration friction | — Pending |
| Environment-based stages over fixed percentages | Matches how teams actually ship; percentages vary per flag | — Pending |
| Pause-and-alert over auto-rollback | Prevents false-positive rollbacks from noisy telemetry | — Pending |
| LaunchDarkly first adapter | Widely adopted, rich API for targeting updates | — Pending |
| SLO gates only in v1 | Error rate + latency are universal, testable, and sufficient for MVP | — Pending |
| Dual user model (platform + devs) | Platform sets guardrails, devs self-serve within bounds | v1 shipped |
| v2 Kotlin backend | JVM ecosystem, Exposed/Flyway, Ktor; keep Next.js dashboard | In progress |
| v1 TS as parity reference | De-risk migration with side-by-side contract tests | Phase 14 cutover |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-20 after initialization*
