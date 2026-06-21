# Project Research Summary

**Project:** Feature Flag Promotion System (ff-promo)
**Domain:** Telemetry-gated feature flag promotion orchestration (LaunchDarkly adapter)
**Researched:** 2026-06-20
**Confidence:** HIGH

## Executive Summary

ff-promo is a **control-plane orchestration layer**, not a feature flag store. Experts build progressive delivery systems as a reconciler sitting between operators, a flag provider (LaunchDarkly), and an observability backend. The orchestrator owns promotion state and stage progression; LaunchDarkly owns runtime evaluation; external telemetry answers whether it is safe to advance. This matches patterns from Flagger/Argo Rollouts (periodic reconciliation against metrics), GitLab Feature Gates (decoupled control plane), and LaunchDarkly Release Pipelines — but the product's gap is **cross-environment progression gated on org-owned SLO telemetry**, with deliberate **pause-and-alert** instead of auto-rollback.

The recommended approach is a **TypeScript pnpm monorepo** with **Temporal** for durable multi-hour promotion workflows (canary/stagger timers, signal-based pause/resume), a **Fastify REST API** plus **Temporal worker** for orchestration logic, **PostgreSQL + Prisma** for pipeline config and audit, **LaunchDarkly REST API** (semantic patch, not the evaluation SDK) for targeting writes, and **Prometheus PromQL** for v1 telemetry gates. CLI and Next.js dashboard are thin clients over the same API. All four research streams agree: prove LD read/write early, add telemetry gating before polishing UX, and defer multi-provider, auto-rollback, and business-metric gates to v2.

The dominant risks are integration and semantics, not framework choice. **Split-brain** between orchestrator state and manual LaunchDarkly edits, **cohort-blind aggregate metrics** that miss regressions or fire false positives, **context-kind mismatch** between flag evaluation and metrics, and **write-then-measure races** (SDK propagation lag) can all make the system look healthy while shipping broken changes — or erode operator trust through noisy pauses. Mitigate by designating the orchestrator as sole writer during active promotions, re-reading LD state every reconciliation cycle, gating on treatment-vs-control deltas with baseline capture and sample minimums, enforcing propagation buffers before gate windows, and shipping actionable pause alerts with full forensics. See [PITFALLS.md](./PITFALLS.md) for the full prevention checklist.

## Key Findings

### Recommended Stack

A TypeScript monorepo (`apps/api`, `apps/worker`, `apps/web`, `apps/cli`; `packages/contracts`, `db`, `ld-adapter`, `telemetry`) is the right shape for four surfaces sharing Zod schemas and typed clients. **Temporal** replaces hand-rolled job queues for durable timers across pre-release → canary → stagger windows and pause/resume signals. **Fastify 5 + Zod** serves the REST control plane; **Next.js 16 App Router** serves the ops dashboard as a BFF over the API — not as the primary backend.

**Core technologies:**
- **TypeScript 5.8 + Node 24 LTS + pnpm + Turborepo** — shared contracts across API, worker, CLI, dashboard
- **Temporal (server 1.27+, TS SDK 1.18.1)** — durable promotion workflows with pause/resume signals and multi-hour stage timers
- **Fastify 5.8 + Zod 4.4** — schema-first REST API with OpenAPI generation for CLI client
- **PostgreSQL 16+ + Prisma 7.8** — pipeline definitions, promotion runs, append-only audit log
- **launchdarkly-api 20.0.0 (REST, semantic patch)** — flag targeting writes; do **not** use `@launchdarkly/node-server-sdk` for orchestration
- **Prometheus HTTP API (PromQL)** — v1 telemetry gates (error rate + p95 latency); Datadog/New Relic deferred to v2
- **Next.js 16 + React 19 + Tanstack Query + shadcn/ui** — pipeline status dashboard with polling widgets
- **Commander 15** — CLI wrapping the REST API for developer workflows
- **Vitest + @temporalio/testing + testcontainers** — workflow and integration testing

Critical version pins: `LD-API-Version: 20240415` on all LaunchDarkly REST calls; Temporal worker SDK matched to server compatibility matrix. Portfolio/early-stage variant: Temporal dev server via Docker Compose, API-key auth instead of Better Auth initially — but **never SQLite** for concurrent pipeline state.

See [STACK.md](./STACK.md) for full dependency list, monorepo layout, and alternatives considered.

### Expected Features

Every competitor models multi-environment promotion, sub-stage percentage rollouts, telemetry gates, pause on breach, status dashboard, alerting, REST API, CLI, provider adapter, audit trail, and emergency stop. ff-promo's differentiators are **orchestration atop an existing provider** (zero migration), **external SLO telemetry gating environment transitions** (not just in-env guarded rollouts), **unified pre-release → canary → stagger model per transition**, and **pause-and-alert over auto-rollback**.

**Must have (table stakes — v1 launch):**
- LaunchDarkly provider adapter (read flag state, write targeting) — foundation
- Multi-environment pipeline (dev → staging → prod) — core value
- Sub-stage rollout (pre-release, canary, stagger) within each transition
- SLO telemetry gates (error rate + latency) with pause on breach
- Alerting on pause/breach/completion
- Platform guardrail configuration + developer self-service trigger within bounds
- REST API + CLI + pipeline status dashboard
- Audit trail + emergency stop/abort

**Should have (v1.x after core validation):**
- Approval gates per stage — many teams need sign-off; can start with platform-approved prod promotions
- Slack/PagerDuty integrations — Slack webhook sufficient for v1 MVP
- Pipeline templates, soak intervals, operator override (dismiss breach)
- Promotion history/comparison views

**Defer (v2+):**
- Multi-provider adapters, custom business metric gates, auto-rollback on breach
- Flag authoring, A/B experiment orchestration, GitOps flag sync, webhook/custom gate types
- Multi-flag batch promotion

See [FEATURES.md](./FEATURES.md) for dependency graph and competitor analysis.

### Architecture Approach

The system follows a **control-plane orchestrator with adapter boundaries**: Promotion API (auth/RBAC) → Pipeline Engine (stage FSM, implemented as Temporal workflows) → Gate Evaluation Service → Flag Provider Adapter (LaunchDarkly) + Telemetry Provider Adapter (Prometheus). Policy/guardrail definitions are separate from promotion runs (AnalysisTemplate/AnalysisRun pattern). All surfaces (CLI, dashboard, CI) are thin clients over the Promotion API — never embed LD API calls in the UI.

**Major components:**
1. **Promotion API (Fastify)** — authenticated entry for start/pause/resume/abort, pipeline CRUD, status queries
2. **Pipeline Engine + Temporal Worker** — durable stage FSM for env transitions and sub-stages; signal-based pause/resume
3. **Gate Evaluation Service** — pull telemetry, compare to guardrails, enforce soak windows and sample minimums
4. **Flag Provider Adapter (`packages/ld-adapter`)** — LD REST semantic patch; sole writer during active promotions
5. **Telemetry Provider Adapter (`packages/telemetry`)** — PromQL queries for error rate and latency
6. **Persistence (PostgreSQL)** — pipeline definitions, live promotion runs, append-only audit/event log
7. **CLI + Dashboard** — Commander CLI and Next.js dashboard as API clients

Key patterns: reconciliation loop (not synchronous gate checks on API requests), policy template vs promotion run with version snapshot at start, provider adapter interfaces for v2 expansion, pause-and-alert failure mode in v1.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for data flows, build order, and anti-patterns.

### Critical Pitfalls

1. **Split-brain with LaunchDarkly UI** — manual LD edits during active promotions desync orchestrator state from reality; designate orchestrator as sole writer, re-read LD state every cycle, pause on drift
2. **Cohort-blind telemetry gates** — aggregate service metrics miss canary regressions or fire on unrelated incidents; gate on treatment-vs-control delta with baseline capture and consecutive breach windows
3. **Context kind / randomization unit mismatch** — flag buckets by `user` but metrics emit by `organization`; add pre-promotion health checks validating evaluation + metric alignment
4. **Blind environment copy-promotion** — copying staging targeting verbatim to prod causes variation ID mismatches and wrong percentages; reset to pre-release 0% on env entry, resolve variation IDs per environment
5. **SDK propagation lag (write-then-measure race)** — gates evaluate stale cohorts if started immediately after LD write; insert propagation buffer and confirm exposure shift before gate windows
6. **Duplicating LD Guarded Rollouts** — rebuilding LD's statistical engine while neglecting cross-env progression; scope v1 to what LD doesn't do: multi-env pipeline, platform guardrails, external telemetry, unified operator UX
7. **Pause without actionable context** — generic "gate failed" alerts erode trust faster than auto-rollback; every pause must include metric values, cohort sizes, baseline/delta, stage, and LD deep link

See [PITFALLS.md](./PITFALLS.md) for 10 critical pitfalls, "looks done but isn't" checklist, and recovery strategies.

## Implications for Roadmap

Based on combined research, **7 phases** in dependency order. Temporal workflows replace the architecture doc's generic scheduler/reconciler — gate evaluation and stage advancement become workflow activities with durable timers.

### Phase 1: Foundation — Domain, Persistence & Workflow Scaffolding
**Rationale:** Everything depends on shared domain types, audit trail, and Temporal infrastructure. Establishes scope boundary (orchestration layer, not flag store) before any integration work.
**Delivers:** Monorepo scaffold (pnpm/Turborepo), domain models (`PipelineDefinition`, `PromotionRun`, `GateResult`), Prisma schema + migrations, append-only audit event log, Temporal dev server in Docker Compose, basic workflow skeleton
**Addresses:** Audit trail foundation; pipeline state store prerequisite for all features
**Avoids:** Pitfall 8 (scope creep into LD guarded rollout clone); audit gaps; storing promotion state in LD comments

### Phase 2: LaunchDarkly Adapter — Read/Write Integration
**Rationale:** Highest integration risk; core value is orchestrated flag changes. Must prove semantic patch writes before building pipeline logic on top.
**Delivers:** `packages/ld-adapter` with `FlagProvider` interface, semantic patch writes (`updatePercentageRollout`, `turnFlagOn`), per-environment variation ID resolution, sticky `rolloutBucketBy` enforcement, rate limiting with exponential backoff, write confirmation + propagation delay hooks
**Uses:** `launchdarkly-api@20.0.0`, `LD-API-Version: 20240415`
**Implements:** Flag Provider Adapter boundary from architecture
**Avoids:** Pitfalls 1 (split-brain — reconciliation hooks), 6 (propagation lag), 9 (non-sticky bucketing), 10 (429 retry storms)

### Phase 3: Telemetry Gates — Health Checks & SLO Evaluation
**Rationale:** Core differentiator (external SLO gating) depends on adapter interfaces from Phase 2 and domain types from Phase 1. Can start PromQL adapter in parallel with Phase 2 once metric scope types exist.
**Delivers:** `packages/telemetry` Prometheus adapter, pre-promotion health checks (evaluations + metrics + context kind alignment), baseline capture at promotion start, treatment-vs-control delta queries, consecutive breach logic, propagation-aware gate window start
**Addresses:** SLO telemetry gates (error rate + latency) — P1 feature
**Avoids:** Pitfalls 2 (cohort-blind gates), 3 (context kind mismatch), 6 (write-then-measure race)

### Phase 4: Promotion Pipeline — Temporal Workflow & Environment Progression
**Rationale:** Combines LD adapter + telemetry gates into the full stage FSM. This is where cross-env progression (dev → staging → prod) and sub-stages (pre-release → canary → stagger) become real.
**Delivers:** Temporal promotion workflow with durable stage timers and pause/resume signals, environment transition protocol (reset to pre-release on env entry), sample minimum + time dual requirements, drift detection (re-read LD vs expected state), `@slack/webhook` alerting on pause
**Addresses:** Multi-environment pipeline, sub-stage rollout, pause on breach, alerting — all P1
**Avoids:** Pitfalls 1 (drift reconciliation), 4 (blind env copy), 5 (insufficient sample), 8 (focus on env progression not LD clone)

### Phase 5: API & CLI — Control Plane Surfaces
**Rationale:** Thin clients require stable orchestration behavior underneath. Operator actions (pause/resume/abort) and structured alert payloads depend on Phase 4 pipeline existing.
**Delivers:** Fastify REST API (`apps/api`) with OpenAPI spec, Zod-validated endpoints (start/pause/resume/abort/status), Commander CLI (`apps/cli`) with promote/status/pause/resume commands, structured pause alert payloads, API key auth (Better Auth/OIDC deferred)
**Uses:** Fastify 5, Commander 15, openapi-fetch, `@temporalio/client`
**Implements:** Promotion API from architecture
**Avoids:** Pitfall 7 (pause without context — structured alert schema)

### Phase 6: Dashboard — Status, Forensics & Telemetry Viz
**Rationale:** Dashboard is a read-heavy client over Phase 5 API. Needs promotion events and gate history to be populated before UI is meaningful.
**Delivers:** Next.js dashboard (`apps/web`) with pipeline status views, promotion timeline with gate annotations, expected-vs-observed LD state drift display, telemetry charts (Recharts), gate-waiting visibility (propagation buffer, sample progress)
**Uses:** Next.js 16, Tanstack Query, shadcn/ui, Recharts
**Avoids:** Pitfall 7 (forensics view); anti-pattern of embedding LD API calls in dashboard

### Phase 7: Guardrails & Self-Service — Platform Config & RBAC
**Rationale:** Wraps proven pipeline behavior with platform engineer configuration and developer self-service bounds. Server-side guardrail enforcement must be validated against real promotion flows, not built in isolation.
**Delivers:** Pipeline/guardrail CRUD API, RBAC (platform engineer vs developer roles), server-side guardrail validation on every promote request, self-service promotion trigger within bounds, pipeline preview before confirm, runbook links in alerts
**Addresses:** Platform guardrails + dev self-service — P1 features
**Avoids:** Self-service guardrail bypass (PITFALLS security table); dual-user UX confusion

### Phase Ordering Rationale

- **Foundation before adapters:** Domain types and audit log are prerequisites for every integration and compliance requirement
- **LD adapter before pipeline:** Stage advancement writes to LaunchDarkly — prove read/write semantics (variation IDs, sticky bucketing, rate limits) before building the FSM
- **Telemetry gates before full pipeline automation:** Manual stage advance (architecture step 4) can be a Phase 4 milestone before automated reconciler, but gate semantics must be correct before self-service
- **API/CLI before dashboard:** CLI enables CI integration testing without UI investment; dashboard depends on stable API events
- **Guardrails last:** RBAC and self-service enforcement wrap behavior that must exist and be testable first
- **Parallelization:** Telemetry adapter (Phase 3) can start once domain metric types exist, parallel to late Phase 2 work; CLI (Phase 5) can begin when minimal API endpoints stabilize, parallel to late Phase 4

### Research Flags

Phases likely needing `/gsd-plan-phase --research-phase` during planning:
- **Phase 2:** LaunchDarkly semantic patch edge cases (variation ID resolution per env, atomic multi-instruction patches, 429 rate limit budgets) — complex provider integration
- **Phase 3:** Cohort delta query contract (treatment vs control labeling, baseline semantics, minimum sample thresholds) — requires validation against team's actual metric schema
- **Phase 4:** Temporal workflow design for multi-hour stages with pause/resume signals and idempotent LD writes — durable timer + activity retry patterns

Phases with standard patterns (likely skip research-phase):
- **Phase 1:** TypeScript monorepo + Prisma + Temporal local dev — well-documented, established patterns
- **Phase 5:** Fastify REST + Commander CLI + OpenAPI — standard platform tooling patterns
- **Phase 6:** Next.js ops dashboard with Tanstack Query polling — established internal-tools pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm versions verified 2026-06-20; LD REST vs SDK distinction confirmed in official docs; Temporal fit for multi-hour orchestration well-documented |
| Features | HIGH | Table stakes validated against LaunchDarkly, Statsig, Unleash, Harness, Codefresh, Flagger official docs; MVP scope clearly bounded |
| Architecture | HIGH | Control-plane + reconciliation loop verified across GitLab Feature Gates, Flagger, Argo Rollouts, LD Release Pipelines |
| Pitfalls | HIGH | LaunchDarkly official docs plus production post-mortems; pitfall-to-phase mapping actionable |

**Overall confidence:** HIGH

### Gaps to Address

- **Metric labeling contract:** Research assumes Prometheus metrics are filterable by flag/variant labels — must validate against target team's observability schema during Phase 3 spike; fallback may require absolute SLO mode only
- **Treatment vs control delta semantics:** PROJECT.md specifies error rate + latency thresholds but not comparison mode — planning must decide absolute SLO vs relative delta per gate (PITFALLS recommends both modes documented)
- **Zod 4 + Fastify type provider compatibility:** STACK flags as "validate in spike" — quick compatibility check in Phase 1
- **Better Auth vs API-key-only:** MEDIUM confidence on Better Auth for RBAC; portfolio project can defer to API keys, but Phase 7 needs an explicit auth decision before self-service
- **Temporal Cloud vs self-hosted:** Infrastructure choice affects Phase 1 setup but not architecture — decide during Phase 1 planning based on deployment target
- **Concurrent LD guarded rollouts:** Mutual exclusion with orchestrator-managed flags needs LD API investigation during Phase 2 — may require operational policy rather than API enforcement

## Sources

### Primary (HIGH confidence)
- [LaunchDarkly REST API](https://launchdarkly.com/docs/api) — semantic patch, API versioning
- [LaunchDarkly Release Pipelines](https://docs.launchdarkly.com/home/releases/release-pipelines/) — competitor baseline for multi-env promotion
- [LaunchDarkly Guarded Rollouts & Health Checks](https://docs.launchdarkly.com/home/releases/guarded-rollouts/) — gate patterns to complement, not duplicate
- [Temporal TypeScript SDK docs](https://docs.temporal.io/develop/typescript/set-up-your-local-typescript) — durable workflows, signals, timers
- [GitLab Feature Gates design doc](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/feature_gates/) — control plane architecture
- [Flagger — How it works](https://docs.flagger.app/usage/how-it-works) — reconciliation loop pattern
- [Argo Rollouts Architecture](https://argo-rollouts.readthedocs.io/en/stable/architecture/) — AnalysisTemplate/AnalysisRun pattern
- npm registry (2026-06-20) — version verification for Temporal, Fastify, Next.js, Prisma, launchdarkly-api

### Secondary (MEDIUM confidence)
- [Headout Studio: Canary rollback metric selection](https://www.headout.studio/canary-deployment-with-automated-rollback/) — aggregate vs delta false positives
- [Statsig Release Pipeline docs](https://docs.statsig.com/release-pipeline/overview) — competitor feature comparison
- [Codefresh Promotions](https://codefresh.io/docs/docs/promotions/promotions-overview/) — promotion flow patterns
- Deployment gate / PromQL patterns (OneUptime, NthLayer) — SLO query templates

### Tertiary (needs validation during implementation)
- Better Auth RBAC integration with Next.js 16 Route Handlers — verify auth-in-handler pattern during Phase 7
- LD Release Pipelines API (beta) mutual exclusion with orchestrator — operational policy may suffice

---
*Research completed: 2026-06-20*
*Ready for roadmap: yes*
