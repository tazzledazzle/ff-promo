---
phase: 04-promotion-engine
plan: 03
subsystem: worker
tags: [temporal-workflow, gate-evaluation, promotion-fsm]
requires:
  - phase: 04-02
    provides: runPreflight, applyStageTargeting activities
provides:
  - Real evaluateGate with GateResult persistence (D-11–D-14)
  - Extended promotionWorkflow orchestration (D-01, D-05, D-17, D-21)
affects: [04-04]
tech-stack:
  added: []
  patterns: [preflight-once-then-stage-loop, hasAborted guards before side effects]
key-files:
  created:
    - apps/worker/src/__tests__/helpers/mock-activities.ts
    - apps/worker/src/__tests__/evaluate-gate.activity.test.ts
  modified:
    - apps/worker/src/activities/evaluate-gate.ts
    - apps/worker/src/workflows/promotion.workflow.ts
    - apps/worker/src/__tests__/promotion.workflow.test.ts
requirements-completed: [PIPE-03, PIPE-04]
duration: 35min
completed: 2026-06-22
---

# Phase 4 Plan 03 Summary

**Replaced evaluateGate stub with real telemetry evaluation and extended the workflow to orchestrate preflight → targeting → gates per stage.**

## Accomplishments

- `evaluateGate`: `evaluateStageGates`, one GateResult per policy, `gate_evaluated` audit events, `pauseReason` on fail
- `promotionWorkflow`: preflight once; per stage `applyStageTargeting` → `evaluateGate`; D-17 `hasAborted()` guards; `pauseReason` on gate fail
- Workflow tests use mocked activities for fast FSM coverage (gate fail pause, preflight abort, D-17)

## Verification

- `pnpm --filter @ff-promo/worker run build` — pass
- Workflow tests require Docker testcontainers (CI)
