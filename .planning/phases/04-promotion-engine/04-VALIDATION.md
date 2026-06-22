# Phase 4 Validation Strategy

**Phase:** Promotion Engine  
**Requirements:** PIPE-02, PIPE-03, PIPE-04, SAFE-02

## Automated Gate

| Command | When |
|---------|------|
| `pnpm --filter @ff-promo/worker test` | Per task / plan |
| `pnpm -w exec vitest run --project worker` | Wave merge / phase gate |
| `pnpm exec vitest run --project ld-adapter` | Regression (Phase 2) |
| `pnpm exec vitest run --project telemetry` | Regression (Phase 3) |

## Requirement → Test Map

| Req | Behavior | Test file pattern |
|-----|----------|-------------------|
| PIPE-02 | Start pending run → workflow runs | `start-promotion-run`, `promotion-engine.integration` |
| PIPE-03 | Advance only after gate pass | `promotion-engine.integration`, workflow tests |
| PIPE-04 | Gate fail pauses with pauseReason | `evaluate-gate.activity`, integration |
| SAFE-02 | Abort stops in-flight promotion | `promotion.signals`, integration abort |
| D-05/D-06 | Preflight fail → aborted, no GateResult | `run-preflight.activity` |
| D-12 | One GateResult per policy | `evaluate-gate.activity` |

## CI Dependencies

- testcontainers Postgres (existing worker/db pattern)
- Temporal `TestWorkflowEnvironment` (no external Temporal server)
- nock for LD + Prometheus HTTP (no live credentials)
