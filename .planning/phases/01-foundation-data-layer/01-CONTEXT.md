# Phase 1: Foundation & Data Layer - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish durable domain persistence and audit infrastructure for all promotion activity. Phase 1 delivers: PostgreSQL schema for pipeline definitions, promotion runs, and gate results; append-only audit log; Temporal workflow skeleton with pre-wired stage states and signals; full monorepo scaffold with local Docker Compose stack. Does NOT include LaunchDarkly integration, real telemetry queries, REST API endpoints, or dashboard UI — those are later phases.

</domain>

<decisions>
## Implementation Decisions

### Audit Event Schema
- **D-01:** Log milestones only — stage transitions, operator actions, and gate pass/fail verdicts (not every reconciler tick)
- **D-02:** Structured actor identity — `actorType` (user | system | api_key) + `actorId` + optional `displayName`
- **D-03:** Gate forensics in JSON metadata column — metric values, thresholds, LD flag key, environment, stage context
- **D-04:** Retain audit events forever in v1 — append-only, no TTL or archival

### Domain Model Scope
- **D-05:** Full core schema in Phase 1 — `PipelineDefinition`, `PromotionRun`, `GateResult`, `AuditEvent` tables from day one
- **D-06:** Normalized relational pipeline storage — `Pipeline` → `Stage` (env order) → `GatePolicy` per stage as separate rows
- **D-07:** Dual source of truth for run state — `PromotionRun` in Postgres is canonical; Temporal holds workflow execution state (signals, timers)
- **D-08:** Separate `GateResult` table — queryable history per run/stage; audit milestone entries reference result IDs

### Temporal Skeleton Depth
- **D-09:** Pre-wired FSM skeleton — workflow with environment stage states, pause/resume/abort signal handlers, stub activities
- **D-10:** Standard signals defined in Phase 1 — `pause`, `resume`, `abort`, `gatePassed`, `gateFailed`
- **D-11:** Stub activities only — `persistRunState`, `recordAuditEvent`, `evaluateGate` (returns mock pass for local dev)
- **D-12:** Local dev via Docker Compose — Postgres + Temporal dev server in `docker-compose.yml`

### Monorepo Bootstrap
- **D-13:** Full monorepo scaffold — `apps/api`, `apps/worker`, `apps/web`, `apps/cli` + `packages/contracts`, `packages/db` per STACK.md
- **D-14:** pnpm workspaces + Turborepo for build/test/lint orchestration
- **D-15:** Vitest + testcontainers for integration tests covering DB persistence and audit queries
- **D-16:** Seed data — sample pipeline (dev → staging → prod) + mock promotion run for local dev and demo

### Claude's Discretion
None — all key decisions captured explicitly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Core value, constraints, key decisions (orchestration layer, pause-and-alert posture)
- `.planning/REQUIREMENTS.md` — SAFE-01 audit trail requirement mapped to this phase
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria

### Research (stack & architecture)
- `.planning/research/STACK.md` — Monorepo layout, technology versions (TypeScript, Prisma, Temporal, pnpm, Turborepo)
- `.planning/research/ARCHITECTURE.md` — Component boundaries, persistence layer design, promotion run vs pipeline definition separation
- `.planning/research/PITFALLS.md` — Split-brain prevention, audit forensics quality (Phase 1 should establish append-only audit from day one)

</canonical_refs>

<code_context>
## Existing Code Insights

Greenfield project — no application source code exists yet. GSD tooling installed under `.claude/`.

### Reusable Assets
- None — first implementation phase

### Established Patterns
- Research prescribes TypeScript monorepo with `apps/*` and `packages/*` separation
- Prisma in `packages/db` as shared data access layer
- Temporal worker in `apps/worker`; API/web/cli shells scaffolded but not functional until later phases

### Integration Points
- `apps/worker` connects to Postgres via `packages/db` and Temporal via `@temporalio/*`
- Future phases will add real activities to the workflow skeleton defined here
- Audit query interface in data layer will be consumed by REST API (Phase 5) and dashboard (Phase 6)

</code_context>

<specifics>
## Specific Ideas

- Audit log should support operator forensics on pause events — JSON metadata must include enough context for dashboard timeline views in Phase 6
- Seed pipeline should mirror the dev → staging → prod environment progression decided at project initialization
- Workflow skeleton should mirror the environment-stage FSM that Phase 4 will flesh out with real gate evaluation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---
*Phase: 1-Foundation & Data Layer*
*Context gathered: 2026-06-20*
