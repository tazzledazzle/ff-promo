# Architecture Research

**Domain:** Telemetry-gated feature flag promotion orchestration
**Researched:** 2026-06-20
**Confidence:** HIGH (patterns verified across LaunchDarkly docs, GitLab Feature Gates design, Argo Rollouts/Flagger architecture, and industry orchestrator references)

## Standard Architecture

Telemetry-gated flag promotion systems share a common shape: a **control plane orchestrator** sits between operators, a **flag provider** (LaunchDarkly), and an **observability backend**. The orchestrator owns promotion state and stage progression; the flag provider owns runtime flag evaluation; telemetry answers whether it is safe to advance.

This project is explicitly an **orchestration layer, not a flag store** — the same pattern GitLab describes as a standalone Control Plane decoupled from the application monolith, and the same pattern progressive-delivery tools (Flagger, Argo Rollouts) use when a controller reconciles desired rollout state against live metrics.

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Client / Operator Layer                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────────────┐ │
│  │  Dashboard   │   │     CLI      │   │  External CI / automation hooks   │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────────┬───────────────────┘ │
│         │                  │                          │                      │
│         └──────────────────┴──────────────────────────┘                      │
│                                    │ REST                                    │
├────────────────────────────────────┴─────────────────────────────────────────┤
│                         Control Plane (Orchestrator)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │  Promotion API  │  │ Pipeline Engine  │  │   Gate Evaluation Service  │  │
│  │  (auth, RBAC)   │──│ (stage FSM)      │──│ (SLO checks, soak windows) │  │
│  └────────┬────────┘  └────────┬─────────┘  └─────────────┬──────────────┘  │
│           │                    │                           │                 │
│  ┌────────┴────────┐  ┌────────┴─────────┐  ┌─────────────┴──────────────┐  │
│  │ Policy /        │  │ Scheduler /      │  │ Alert & Notification       │  │
│  │ Guardrail Store │  │ Reconciler       │  │ Dispatcher                 │  │
│  └────────┬────────┘  └────────┬─────────┘  └─────────────┬──────────────┘  │
│           │                    │                           │                 │
├───────────┴────────────────────┴───────────────────────────┴─────────────────┤
│                              Adapter Layer                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐          ┌─────────────────────────────────┐   │
│  │ Flag Provider Adapter   │          │ Telemetry Provider Adapter      │   │
│  │ (LaunchDarkly v1)       │          │ (Prometheus / Datadog / etc.)   │   │
│  │ read state, patch rules │          │ query error rate, latency SLOs  │   │
│  └────────────┬────────────┘          └──────────────┬──────────────────┘   │
├───────────────┴──────────────────────────────────────┴─────────────────────────┤
│                              Persistence Layer                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ Pipeline defs    │  │ Promotion runs   │  │ Audit / event log        │  │
│  │ (guardrails)     │  │ (live state)     │  │ (immutable history)      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                      │
         ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│   LaunchDarkly      │              │ Observability stack │
│ (flag eval @ edge)  │              │ (metrics, traces)   │
└─────────────────────┘              └─────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Promotion API** | Authenticated entry point for starting, pausing, resuming promotions; pipeline/guardrail CRUD; status queries | REST service with RBAC separating platform engineers (policy) from developers (run within bounds) |
| **Pipeline Engine** | State machine for environment transitions (dev → staging → prod) and sub-stages (pre-release, canary, stagger); enforces guardrails before writes | Finite-state machine with explicit transitions; idempotent stage advancement |
| **Policy / Guardrail Store** | Durable definitions: SLO thresholds, soak durations, audience sizing, allowed environments, approval requirements | Relational or document store; versioned pipeline templates |
| **Promotion Run Store** | Live execution state per flag promotion: current stage, timestamps, gate results, pause reason | Separate from policy — many runs per pipeline definition |
| **Scheduler / Reconciler** | Periodic control loop: find active runs, evaluate gates, advance or pause | Background worker with lease/locking; interval-driven (Flagger-style) or event-driven |
| **Gate Evaluation Service** | Pull telemetry, compare to thresholds, require sustained pass over soak window | Provider-agnostic metric queries; treatment vs. baseline or absolute SLO |
| **Flag Provider Adapter** | Read flag state; apply targeting/allocation changes for current stage | LaunchDarkly REST API (flag get, patch targeting rules, environment-scoped updates) |
| **Telemetry Provider Adapter** | Query error rate and latency for flag-scoped or service-scoped metrics | Prometheus PromQL, Datadog queries, etc. — pluggable like Argo Rollouts metric providers |
| **Alert Dispatcher** | Notify operators on pause/breach; no auto-rollback in v1 | Webhook, Slack, PagerDuty adapters |
| **Audit / Event Log** | Append-only record of stage changes, gate outcomes, operator actions | Event table or event stream for dashboard timeline and compliance |
| **CLI / Dashboard** | Human surfaces over the same API | CLI wraps REST; dashboard polls/subscribes for live status + telemetry charts |

## Recommended Project Structure

```
src/
├── domain/                    # Core types: Pipeline, Stage, PromotionRun, GatePolicy, RunStatus
│   ├── pipeline.ts            # Pipeline definition + guardrail schema
│   ├── promotion-run.ts       # Runtime state machine types
│   └── gate-result.ts         # Evaluation verdict, breach details
├── adapters/
│   ├── flags/
│   │   ├── provider.ts        # FlagProvider interface (read, applyStage)
│   │   └── launchdarkly/      # LaunchDarkly REST client + mapping
│   ├── telemetry/
│   │   ├── provider.ts        # TelemetryProvider interface (queryMetric)
│   │   └── prometheus/        # First telemetry backend (or datadog/)
│   └── notifications/         # Alert channel adapters
├── engine/
│   ├── pipeline-engine.ts     # Stage FSM: advance, pause, resume
│   ├── gate-evaluator.ts      # SLO comparison + soak window logic
│   └── reconciler.ts          # Control loop: tick active runs
├── api/
│   ├── routes/                # REST handlers
│   ├── auth/                  # RBAC middleware
│   └── dto/                   # Request/response mapping
├── persistence/
│   ├── repositories/          # Pipeline, PromotionRun, AuditEvent repos
│   └── migrations/
├── cli/                       # Command-line client (uses API)
└── web/                       # Dashboard SPA (uses API)
```

### Structure Rationale

- **domain/:** Keeps pipeline policy separate from promotion execution — mirrors AnalysisTemplate vs AnalysisRun (Argo Rollouts) and GitLab's Control Plane vs rollout instance.
- **adapters/:** Flag and telemetry integrations change independently; v2 multi-provider support extends here without touching engine logic.
- **engine/:** Single place for stage transitions and gate logic — the reconciler should not embed provider-specific query syntax.
- **api/ + cli/ + web/:** All surfaces are thin clients over the control plane; avoids duplicating business rules in the dashboard.

## Architectural Patterns

### Pattern 1: Control-Plane Orchestrator (Reconciliation Loop)

**What:** A background reconciler periodically loads active promotion runs, evaluates health, and drives state forward or pauses on breach. Same pattern as Flagger's canary analysis loop and Argo Rollouts' analysis controller.

**When to use:** Always — telemetry gating requires continuous evaluation during soak windows, not one-shot checks at stage entry.

**Trade-offs:** (+) Handles delayed metric ingestion, transient spikes, and stuck runs. (−) Requires idempotent advancement, distributed locking, and clear run lifecycle semantics.

**Example:**
```typescript
async function reconcileRun(run: PromotionRun): Promise<void> {
  if (run.status !== "ACTIVE") return;

  const stage = run.currentStage;
  const gateResult = await gateEvaluator.evaluate(run, stage);

  await auditLog.append({ runId: run.id, gateResult });

  if (gateResult.verdict === "FAIL") {
    await pipelineEngine.pause(run, gateResult.reason);
    await alerts.dispatchPaused(run, gateResult);
    return;
  }

  if (gateResult.verdict === "PASS" && stage.soakComplete) {
    await pipelineEngine.advance(run); // may write to LaunchDarkly
  }
}
```

### Pattern 2: Policy Template vs. Promotion Run

**What:** Separate **pipeline definition** (reusable guardrails and stage graph) from **promotion run** (one flag's live execution). Argo Rollouts uses AnalysisTemplate/AnalysisRun; GitLab stores gate definitions in Control Plane while rollouts progress independently per feature.

**When to use:** Platform engineers define pipelines once; developers start runs against a flag within guardrail bounds.

**Trade-offs:** (+) Auditability, reuse, RBAC separation. (−) Must snapshot pipeline version onto run at start to avoid mid-flight policy drift.

**Example:**
```typescript
interface PipelineDefinition {
  id: string;
  version: number;
  stages: StageDefinition[];  // dev-pre → dev-canary → staging → prod-stagger
  guardrails: { maxErrorRate: number; maxP99LatencyMs: number; minSoakMinutes: number };
}

interface PromotionRun {
  id: string;
  flagKey: string;
  pipelineId: string;
  pipelineVersion: number;    // frozen at creation
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  currentStageIndex: number;
  stageStartedAt: Date;
  lastGateResult?: GateResult;
}
```

### Pattern 3: Provider Adapter Boundary

**What:** Orchestrator speaks only to narrow interfaces for flags and telemetry. LaunchDarkly, Datadog, and Prometheus details stay in adapters.

**When to use:** Required for v1 LaunchDarkly adapter and future multi-provider/telemetry expansion.

**Trade-offs:** (+) Testability with fakes; engine stays provider-agnostic. (−) Mapping stage intent → provider-specific API calls is non-trivial (LD targeting rules, segments, percentages).

**Example:**
```typescript
interface FlagProvider {
  getFlag(projectKey: string, flagKey: string, env: string): Promise<FlagState>;
  applyStage(run: PromotionRun, stage: StageDefinition): Promise<void>;
}

interface TelemetryProvider {
  queryErrorRate(scope: MetricScope, window: TimeWindow): Promise<number>;
  queryP99Latency(scope: MetricScope, window: TimeWindow): Promise<number>;
}
```

### Pattern 4: Pause-and-Alert (Not Closed-Loop Rollback)

**What:** On telemetry breach, transition run to `PAUSED`, stop stage advancement, alert operators. Do not automatically revert flag targeting in v1.

**When to use:** This project's explicit v1 failure mode — reduces false-positive rollback blast radius.

**Trade-offs:** (+) Safer for flags with side effects; operator retains judgment. (−) Requires clear dashboard/alert UX; stale "partially rolled out" state until manual action.

## Data Flow

### Request Flow (Developer Starts Promotion)

```
Developer (CLI/Dashboard/API)
    ↓ POST /promotions { flagKey, pipelineId }
Promotion API → validate RBAC + guardrails
    ↓
Pipeline Engine → create PromotionRun (ACTIVE, stage 0)
    ↓
Flag Provider Adapter → read current LD flag state (baseline)
    ↓
Flag Provider Adapter → apply pre-release/canary targeting for stage 0
    ↓
Promotion Run Store ← persist run + audit event
    ↓
Response: { runId, status, currentStage }
```

### Control Loop Flow (Telemetry-Gated Advancement)

```
Scheduler (every N seconds)
    ↓
Reconciler → load ACTIVE promotion runs
    ↓
For each run:
    Gate Evaluator → Telemetry Adapter (error rate, p99 latency)
    ↓
    Compare vs guardrails + check soak window elapsed
    ↓
    ├─ FAIL  → Pipeline Engine.pause() → Alert Dispatcher → Audit Log
    ├─ PENDING (soak/metrics incomplete) → no-op, wait next tick
    └─ PASS  → Pipeline Engine.advance()
                    ↓
               Flag Provider Adapter → patch LD targeting (next sub-stage or env)
                    ↓
               Promotion Run Store + Audit Log
```

### Read Flow (Dashboard Status)

```
Dashboard
    ↓ GET /promotions/{runId}
Promotion API → Promotion Run Store (state, history)
    ↓
Gate Evaluator → latest telemetry snapshot (optional live query)
    ↓
Response: { stage, status, gateHistory, currentMetrics, ldDeepLink }
```

### Key Data Flows

1. **Configuration flow (platform engineer):** Guardrail/pipeline definitions flow into Policy Store only — never directly to LaunchDarkly until a promotion run applies a stage.
2. **Write flow (stage advancement):** Pipeline Engine → Flag Provider Adapter → LaunchDarkly API. Orchestrator is the only component that mutates flag targeting during automated promotion.
3. **Read flow (safety):** Gate Evaluator → Telemetry Adapter → observability backend. Flag Provider may be read before writes to detect external manual changes (drift detection is a v2 concern; v1 should at least log LD state at stage boundaries).
4. **Audit flow:** Every transition, gate evaluation, pause, and manual resume appends to Audit Log — dashboard timeline and post-incident review depend on this.

### Data Flow Direction Summary

| From | To | Direction | Payload |
|------|-----|-----------|---------|
| Clients | Promotion API | Inbound commands | start, pause, resume, configure |
| Promotion API | Engine + Stores | Internal | validated intents |
| Engine | Flag Provider Adapter | Outbound write | stage targeting spec |
| Gate Evaluator | Telemetry Adapter | Outbound read | metric queries |
| Engine | Alert Dispatcher | Outbound notify | pause/breach events |
| Stores | Clients | Outbound read | run state, audit history |
| LaunchDarkly | Flag Provider Adapter | Inbound read | current flag configuration |
| Observability | Telemetry Adapter | Inbound read | time-series metrics |

## Suggested Build Order

Dependencies between components — recommended phase sequencing for roadmap:

```
1. Domain models + Persistence
        ↓
2. Flag Provider Adapter (LaunchDarkly read/write)
        ↓
3. Promotion API (minimal: start run, get status, list runs)
        ↓
4. Pipeline Engine (manual stage advance — no telemetry yet)
        ↓
5. Policy / Guardrail Store + platform CRUD API
        ↓
6. Telemetry Adapter + Gate Evaluator
        ↓
7. Scheduler / Reconciler (automated gate loop)
        ↓
8. Alert Dispatcher (pause-on-breach)
        ↓
9. CLI
        ↓
10. Dashboard (status, controls, telemetry viz)
```

### Build Order Rationale

| Step | Why this order | Blocks |
|------|----------------|--------|
| **1. Domain + persistence** | Everything else needs Pipeline, PromotionRun, and audit types | All features |
| **2. LD adapter** | Core value is orchestrated flag changes — prove read/write early | Engine, API |
| **3. Minimal API** | Enables integration testing without UI | CLI, dashboard, automation |
| **4. Engine (manual)** | Validates stage FSM and LD mapping before telemetry complexity | Automated gating |
| **5. Guardrail store** | Platform engineer config is independent of telemetry plumbing | Self-service bounds |
| **6–7. Telemetry + reconciler** | Automated gating is the differentiator but depends on stable stage machinery | Alerts, full MVP |
| **8. Alerts** | Meaningful only once automated pause exists | Operator response loop |
| **9–10. CLI + dashboard** | Thin clients; API must be stable first | User-facing completeness |

**Parallelization note:** Telemetry adapter (6) can start in parallel with guardrail store (5) once domain types exist. CLI (9) can begin as soon as API (3) stabilizes — do not block CLI on dashboard.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–50 concurrent promotion runs | Single service + single worker + Postgres/SQLite; in-process scheduler |
| 50–500 runs | Dedicated worker process; leader-elected reconciler; index active runs by status |
| 500+ runs | Shard reconciler by run ID; rate-limit LaunchDarkly and telemetry API calls; cache metric queries per scope/window |

### Scaling Priorities

1. **First bottleneck:** Telemetry query fan-out — each reconciler tick may query metrics per active run. Mitigate with query caching (30–60s TTL), batching runs that share the same metric scope, and configurable reconcile interval.
2. **Second bottleneck:** LaunchDarkly API rate limits on stage advancement — use idempotent writes, exponential backoff, and avoid re-patching when computed targeting matches current state.

## Anti-Patterns

### Anti-Pattern 1: Flag Store Duplication

**What people do:** Persist flag targeting as source of truth and periodically sync to LaunchDarkly.

**Why it's wrong:** Creates split-brain with LD SDK evaluation; teams already use LD; migration friction violates project constraints.

**Do this instead:** Treat LaunchDarkly as runtime source of truth for flag state; orchestrator stores *intent* (promotion run stage) and writes through the adapter.

### Anti-Pattern 2: Synchronous Gate Check on API Request

**What people do:** Block `POST /advance` until telemetry query returns healthy.

**Why it's wrong:** Metrics lag; long requests time out; no soak-window semantics.

**Do this instead:** API enqueues intent; reconciler evaluates over time windows (Flagger interval / Argo AnalysisRun sampling model).

### Anti-Pattern 3: Embedding LD API Calls in Dashboard/CLI

**What people do:** Dashboard reads LaunchDarkly directly for promotion logic.

**Why it's wrong:** Guardrails bypassed; audit trail fragmented; RBAC inconsistent.

**Do this instead:** All promotion mutations and gate state through Promotion API; LD links for deep inspection only.

### Anti-Pattern 4: Auto-Rollback in v1

**What people do:** Revert targeting automatically on any threshold breach (LaunchDarkly Guarded Rollouts default, GitLab HFRS auto-recovery).

**Why it's wrong:** Explicitly out of scope — false positives and side-effectful flags need operator judgment.

**Do this instead:** Pause + alert; expose manual resume/rollback actions in API/CLI/dashboard.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **LaunchDarkly** | REST API via adapter: get flag, patch targeting rules / segments / rollout weights per environment | Release Pipelines API (beta) exists natively — this product adds opinionated env progression, external telemetry gates, pause-not-rollback. Use LD-API-Version header for beta endpoints if mirroring pipeline concepts. |
| **Observability (Prometheus/Datadog)** | Pull-based metric queries scoped by service, env, or flag attribute | Argo Rollouts pattern: pluggable metric providers with success conditions. v1: error rate + p99 latency only. |
| **Alerting (Slack/PagerDuty/webhook)** | Push on pause/breach events | Decouple from gate evaluation — alert failure must not block pause transition. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API ↔ Engine | Sync service calls in-process (monolith) or command queue (split) | Start with in-process; extract worker when reconcile load grows |
| Engine ↔ Flag Adapter | Sync, idempotent `applyStage` | Retry-safe; log request/response for audit |
| Reconciler ↔ Gate Evaluator | Sync per run per tick | Evaluator is pure given cached metrics |
| Gate Evaluator ↔ Telemetry Adapter | Sync query | Timeout → treat as inconclusive (stay PENDING, do not advance) |
| All ↔ Audit Log | Append-only writes | Never update historical gate results |

## Comparison to Adjacent Systems

Understanding where this product sits helps avoid re-implementing the wrong layer:

| System | What it orchestrates | Telemetry gating | Flag-specific |
|--------|---------------------|------------------|---------------|
| **Flagger / Argo Rollouts** | K8s deployments, traffic split | Built-in analysis controller | No — infra-level |
| **LaunchDarkly Release Pipelines** | LD flag phases natively | Guarded rollouts via LD metrics | Yes — but LD-centric, auto-rollback |
| **GitLab Feature Gates** | Gate enablement across envs/rings | HFRS composite metrics, auto-recovery | Yes — full platform scope |
| **ff-promo (this project)** | LD flag promotion across envs | External SLO telemetry, pause-and-alert | Yes — orchestration layer only |

**Positioning:** ff-promo is closest to GitLab's **Automated Workflows + Control Plane** combined with Argo's **AnalysisTemplate/AnalysisRun** split, applied to LaunchDarkly instead of custom gate storage or Kubernetes workloads.

## Sources

- [GitLab Feature Gates design doc](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/feature_gates/) — Control plane, automated workflows, telemetry-gated stage promotion, federated topology (HIGH)
- [LaunchDarkly Release Pipelines API (beta)](https://launchdarkly.com/docs/api/release-pipelines-beta) — Phase-based flag progression, guarded rollout config (HIGH)
- [LaunchDarkly architecture deep dive](https://launchdarkly.com/docs/tutorials/ld-arch-deep-dive) — Flag as control point, progressive delivery feedback loop (HIGH)
- [Flagger — How it works](https://docs.flagger.app/usage/how-it-works) — Canary analysis loop, metric thresholds, periodic reconciliation (HIGH)
- [Argo Rollouts — Architecture](https://argo-rollouts.readthedocs.io/en/stable/architecture/) — AnalysisTemplate/AnalysisRun, metric providers, controller reconciliation (HIGH)
- [Orchestrated release pattern (toggle.top)](https://toggle.top/ci-cd-pipeline-patterns-for-deploying-to-cloud-mobile-and-pi) — Thin orchestrator sequencing flags + observability gates (MEDIUM)
- [Feature flag rollout LLD (metrics-gated progression)](https://www.techinterview.org/post/3233469722/lld-feature-flag-rollout/) — Scheduler-driven gate evaluation, pause on breach (MEDIUM)

---
*Architecture research for: Feature Flag Promotion System (telemetry-gated orchestration over LaunchDarkly)*
*Researched: 2026-06-20*
