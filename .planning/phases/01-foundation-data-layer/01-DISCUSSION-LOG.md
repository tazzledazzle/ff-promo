# Phase 1: Foundation & Data Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 1-Foundation & Data Layer
**Areas discussed:** Audit event schema, Domain model scope, Temporal skeleton depth, Monorepo bootstrap

---

## Audit Event Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Milestones only | Stage transitions, operator actions, gate pass/fail verdicts | ✓ |
| Every gate evaluation tick | Full PromQL query results each reconciler cycle | |
| Hybrid | Milestones always; gate ticks sampled or on breach only | |

**User's choice:** Milestones only

| Option | Description | Selected |
|--------|-------------|----------|
| Structured actor | actorType + actorId + optional displayName | ✓ |
| Simple string | actor email or "system" only | |
| Full request context | actor + IP + user-agent + correlation ID | |

**User's choice:** Structured actor

| Option | Description | Selected |
|--------|-------------|----------|
| JSON payload column | gate metrics, thresholds, LD flag key, environment in metadata | ✓ |
| Minimal | action + timestamp only; details in gate_results table | |
| Rich narrative | human-readable message field plus JSON metadata | |

**User's choice:** JSON payload column

| Option | Description | Selected |
|--------|-------------|----------|
| Retain forever | Append-only, no TTL in v1 | ✓ |
| Partition by month | Archive old partitions but keep queryable | |

**User's choice:** Retain forever

---

## Domain Model Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full core schema | PipelineDefinition, PromotionRun, GateResult, AuditEvent from day one | ✓ |
| Run + audit only | Defer PipelineDefinition to Phase 7 | |
| Audit-only MVP | Just AuditEvent + PromotionRun stub | |

**User's choice:** Full core schema

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized relational | Pipeline → Stages → GatePolicy as separate rows | ✓ |
| JSON blob | Single pipeline_config JSON column | |
| Hybrid | Core fields relational, guardrails as JSON | |

**User's choice:** Normalized relational

| Option | Description | Selected |
|--------|-------------|----------|
| Dual source | Postgres canonical for PromotionRun; Temporal for execution state | ✓ |
| Postgres-only | Temporal workflow is thin | |
| Temporal-primary | Workflow state is canonical | |

**User's choice:** Dual source

| Option | Description | Selected |
|--------|-------------|----------|
| Separate GateResult table | Queryable history; audit references result IDs | ✓ |
| Audit log only | Gate outcomes in audit metadata JSON | |
| Both | GateResult table plus milestone audit entries | |

**User's choice:** Separate GateResult table

---

## Temporal Skeleton Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-wired FSM skeleton | Env stage states, pause/resume/abort signals, stub activities | ✓ |
| Empty workflow | Start workflow, persist run ID only | |
| Full stage loop stub | Simulated gate pass/fail with sleep timers | |

**User's choice:** Pre-wired FSM skeleton

| Option | Description | Selected |
|--------|-------------|----------|
| Standard signals | pause, resume, abort, gatePassed, gateFailed | ✓ |
| Minimal | pause and abort only | |
| Extended | Also advanceStage, updateGuardrails mid-run | |

**User's choice:** Standard signals

| Option | Description | Selected |
|--------|-------------|----------|
| Stub activities | persistRunState, recordAuditEvent, evaluateGate (mock pass) | ✓ |
| Persistence-only | Real DB writes; no gate activities | |
| No activities | Workflow updates DB directly in Phase 4 | |

**User's choice:** Stub activities

| Option | Description | Selected |
|--------|-------------|----------|
| Docker Compose | Postgres + Temporal dev server | ✓ |
| Temporal CLI only | temporal server start-dev | |

**User's choice:** Docker Compose

---

## Monorepo Bootstrap

| Option | Description | Selected |
|--------|-------------|----------|
| Full monorepo scaffold | apps/api, worker, web, cli + packages/contracts, db | ✓ |
| Core packages only | packages/db, contracts, apps/worker | |
| Single app | apps/worker with inline Prisma | |

**User's choice:** Full monorepo scaffold

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm + Turborepo | Per research STACK.md | ✓ |
| pnpm workspaces only | No Turborepo until multiple apps | |
| npm workspaces | Simpler | |

**User's choice:** pnpm + Turborepo

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest + testcontainers | Integration tests for DB + audit queries | ✓ |
| Vitest unit only | Integration tests deferred | |
| Smoke test script only | Formal test suite in Phase 4 | |

**User's choice:** Vitest + testcontainers

| Option | Description | Selected |
|--------|-------------|----------|
| Seed data | Sample pipeline + mock run for local dev | ✓ |
| Empty DB | Tests create fixtures inline | |

**User's choice:** Seed data

---

## Claude's Discretion

None.

## Deferred Ideas

None.
