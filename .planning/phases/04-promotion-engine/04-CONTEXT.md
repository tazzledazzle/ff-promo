# Phase 4: Promotion Engine - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the Temporal promotion workflow to real orchestration: start promotion runs (PIPE-02), apply LaunchDarkly targeting per environment stage, evaluate telemetry gates via `@ff-promo/telemetry` (PIPE-03/04), run pre-flight before promotion starts (TELE-04 wiring), persist gate results and audit events, and support emergency abort (SAFE-02). Phase 4 replaces stub `evaluateGate` and connects Phase 2 (`ld-adapter`) + Phase 3 (`telemetry`) inside `apps/worker` activities.

Does NOT include REST API or CLI start/control (Phase 5), dashboard (Phase 6), pipeline/guardrail configuration UI (Phase 7), sub-stage rollouts (PIPE-05/06), soak timers (TELE-06), or external alerting (TELE-05).

</domain>

<decisions>
## Implementation Decisions

### Stage Progression & LD Write Ordering
- **D-01:** **Gate before stage index advance** — at each stage: enter stage → apply LD targeting for **current** stage's environment → evaluate gates → increment `currentStageIndex` only when all stage policies pass (PIPE-03)
- **D-02:** **No LD write to the next environment until current stage gates pass** — advancement is index + audit milestone, not a premature cross-env write
- **D-03:** **Single gate evaluation per stage attempt** — one `evaluateStageGates` call per loop iteration; no polling timer or auto-retry interval in v1
- **D-04:** **On gate fail: pause run** — set status `paused` with `pauseReason` from telemetry metadata; operator `resume` re-enters same stage (re-apply + re-evaluate)

### Pre-flight (TELE-04 Wiring)
- **D-05:** **Pre-flight once at workflow start** — call `runPreflightChecks` before any LD writes or stage processing
- **D-06:** **Pre-flight fail blocks promotion** — fail closed: persist run as `aborted` (or terminal non-active state), record audit event with `PreflightReport`, exit workflow without stage advancement
- **D-07:** **Pre-flight does not create GateResult rows** — audit milestone + structured metadata only; gate results remain runtime evaluations per stage

### LaunchDarkly Integration (PROV-02/03)
- **D-08:** **New `applyStageTargeting` activity** — wraps `@ff-promo/ld-adapter` `applyTargeting` with `TargetingIntent` derived from pipeline/run + current stage environment
- **D-09:** **Resolve variation IDs per stage** — at stage entry, `getFlagState` for that stage's `environmentKey`; derive treatment/control variation `_id`s for `GateRunContext` (PROV-03)
- **D-10:** **LD writes via existing semantic patch path only** — no LaunchDarkly server SDK; reuse rate-limited client from Phase 2

### Telemetry Gate Evaluation
- **D-11:** **Replace stub `evaluateGate`** — activity loads stage `GatePolicy[]`, builds `GateRunContext`, calls `evaluateStageGates` from `@ff-promo/telemetry`
- **D-12:** **Persist one `GateResult` per policy** — each `GateEvaluationResult` → `GateResultRepository.create`; stage activity returns aggregate pass/fail
- **D-13:** **Gate forensics in metadata** — store `treatmentValue`, `controlValue`, `observedDelta`, `metadata.reason` in GateResult + audit `gate_evaluated` events (extends D-03 Phase 1)
- **D-14:** **Fail closed inherits Phase 3** — empty data, insufficient samples, prometheus errors → stage fail → pause (no advancement)

### Starting Runs (PIPE-02)
- **D-15:** **Worker-side start mechanism only** — `startPromotionRun` helper (Temporal client + DB) transitions `pending` → `active` and starts `promotionWorkflow`; usable from worker integration tests and a documented dev script
- **D-16:** **No REST/CLI user-facing start in Phase 4** — Phase 5 exposes API-01; Phase 4 proves engine via worker tests

### Emergency Stop (SAFE-02)
- **D-17:** **Immediate abort via existing `abortSignal`** — workflow breaks stage loop, persists `aborted`, records `run_aborted` audit; no further LD writes after abort observed
- **D-18:** **Abort helper for tests** — Temporal test client sends `abortSignal`; REST/dashboard abort deferred to Phase 5/6

### Activity Architecture
- **D-19:** **New activities:** `runPreflight`, `applyStageTargeting`, real `evaluateGate`; keep `persistRunState` + `recordAuditEvent`
- **D-20:** **Env/config at activity boundary** — activities construct LD/telemetry clients with factory + env fallback; workflow code stays deterministic (no `process.env` in workflow)
- **D-21:** **Workflow remains orchestration-only** — no direct adapter imports in `promotion.workflow.ts`; extend loop for preflight + apply targeting steps

### Claude's Discretion
- Exact `TargetingIntent` / rollout percentage for v1 environment stages (e.g., 100% to stage env vs seed canary intent)
- Terminal status for pre-flight fail (`aborted` vs `pending` with reason)
- `startPromotionRun` packaging (npm script name, whether bundled as exported activity vs standalone module)
- Whether `gatePassed`/`gateFailed` signals stay unused in v1 (activity return is source of truth) or get wired for future external gate injection
- Integration test strategy: nock both LD + Prometheus at activity layer vs workflow-level with mocked activities

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — pause-and-alert posture, no auto-rollback, environment-based progression
- `.planning/REQUIREMENTS.md` — PIPE-02, PIPE-03, PIPE-04, SAFE-02 (Phase 4); TELE-03/04 complete (Phase 3)
- `.planning/ROADMAP.md` — Phase 4 goal and success criteria

### Prior Phase Context
- `.planning/phases/01-foundation-data-layer/01-CONTEXT.md` — Temporal skeleton, signals, dual source of truth (D-07), GateResult persistence (D-08)
- `.planning/phases/03-telemetry-adapter/03-CONTEXT.md` — delta-vs-control gates, pre-flight checks, fail-closed policy, adapter purity (no worker wiring in Phase 3)

### Stack & Architecture
- `.planning/research/STACK.md` — Temporal worker in `apps/worker`, adapter packages pattern
- `.planning/research/ARCHITECTURE.md` — promotion run vs pipeline separation, audit forensics

### Existing Code (integration points)
- `apps/worker/src/workflows/promotion.workflow.ts` — stage loop, pause/resume/abort handlers (extend, don't rewrite)
- `apps/worker/src/workflows/signals.ts` — pause, resume, abort, gatePassed, gateFailed
- `apps/worker/src/activities/evaluate-gate.ts` — stub to replace
- `apps/worker/src/activities/persist-run-state.ts` — canonical Postgres state
- `apps/worker/src/activities/record-audit-event.ts` — audit milestones
- `packages/telemetry/src/evaluate/evaluate-stage-gates.ts` — stage gate evaluation
- `packages/telemetry/src/preflight/run-preflight.ts` — TELE-04
- `packages/ld-adapter/src/provider/launch-darkly-provider.ts` — LD read/write surface
- `packages/db/prisma/schema.prisma` — PromotionRun, Stage, GatePolicy, GateResult, AuditEvent
- `packages/contracts/src/telemetry.ts` — GateRunContext, GateEvaluationResult, PreflightReport
- `packages/contracts/src/launchdarkly.ts` — ApplyTargetingInput, GetFlagStateInput

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `promotionWorkflow` — FSM with pause-on-fail loop already matches PIPE-04; add preflight + applyTargeting steps before `evaluateGate`
- `evaluateGate` stub — loads run/pipeline/stage from DB; extend to load `gatePolicies` and call telemetry
- `GateResultRepository` + `PromotionRunRepository` — persistence patterns established in Phase 1
- `@ff-promo/ld-adapter` — `createLaunchDarklyProvider`, variation resolver, semantic patch writes
- `@ff-promo/telemetry` — `evaluateStageGates`, `runPreflightChecks`, `createPrometheusClient`
- Worker integration tests (`promotion.workflow.test.ts`) — Temporal test env + testcontainers DB seed pattern

### Established Patterns
- Activities throw on missing `DATABASE_URL`; disconnect Prisma in `finally`
- Adapter packages are pure; worker activities orchestrate and persist
- Fail-closed telemetry (Phase 3) aligns with workflow pause-on-fail (Phase 1 skeleton)
- Audit actions: `stage_entered`, `stage_advanced`, `gate_evaluated` — extend metadata for forensics

### Integration Points
- Workflow `PromotionWorkflowInput` may need flagKey/projectKey or load from DB in first activity
- `currentStageIndex` in Postgres must stay in sync with workflow loop (already on stage_advanced)
- Phase 5 API will call same Temporal signals (pause/resume/abort) and start workflow via shared helper

</code_context>

<specifics>
## Specific Ideas

- Pre-flight should run before any LD mutation — catches unwired metrics before flag changes
- Gate fail should surface enough metadata for Phase 5 API forensics and Phase 6 dashboard timeline
- PIPE-02 in Phase 4 means "engine can start a run" — not necessarily a polished developer UX yet

</specifics>

<deferred>
## Deferred Ideas

- **Sub-stage rollouts (PIPE-05/06)** — v2; v1 is environment-per-stage only
- **Soak timers between stages (TELE-06)** — not in v1
- **Slack/PagerDuty alerting (TELE-05)** — Phase 5+ monitoring
- **REST/CLI start and control (API-01, API-04)** — Phase 5
- **Dashboard abort button (UI-03)** — Phase 6; SAFE-02 signal wiring starts in Phase 4
- **Automatic gate polling / auto-resume after telemetry recovers** — conflicts with pause-and-alert; manual resume only
- **Automatic rollback on gate fail** — explicitly out of scope per PROJECT.md
- **External gate injection via gatePassed/gateFailed signals** — optional future; activity evaluation is v1 source of truth

</deferred>

---
*Phase: 4-Promotion Engine*
*Context gathered: 2026-06-22*
