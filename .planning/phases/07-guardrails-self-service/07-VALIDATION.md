# Phase 7: Guardrails & Self-Service — Validation Map

**Phase:** 07-guardrails-self-service  
**Requirements:** PIPE-01, TELE-01, TELE-02, GRD-01, GRD-02, GRD-03, API-03, UI-04  
**Framework:** Vitest 4.1.9 (`api`, `db`, `web` projects)  
**Last updated:** 2026-06-22

## Requirement → Test Coverage

| Req ID | Behavior | Test Type | Plan | Automated Command | File (created in plan) | Status |
|--------|----------|-----------|------|-------------------|------------------------|--------|
| GRD-01 | Reject pipeline missing error_rate gate policy | Unit | 07-01 | `pnpm exec vitest run --project api -t guardrail.service` | `apps/api/src/__tests__/guardrail.service.test.ts` | Planned |
| GRD-01 | Reject pipeline missing latency_p95 gate policy | Unit | 07-01 | `pnpm exec vitest run --project api -t guardrail.service` | `apps/api/src/__tests__/guardrail.service.test.ts` | Planned |
| GRD-01 | Reject duplicate stage environments | Unit | 07-01 | `pnpm exec vitest run --project api -t guardrail.service` | `apps/api/src/__tests__/guardrail.service.test.ts` | Planned |
| GRD-01 | Reject non-monotonic dev→staging→prod order | Unit | 07-01 | `pnpm exec vitest run --project api -t guardrail.service` | `apps/api/src/__tests__/guardrail.service.test.ts` | Planned |
| GRD-01 | Create valid 3-env pipeline via API | Integration | 07-02 | `pnpm exec vitest run --project api -t pipelines.create` | `apps/api/src/__tests__/pipelines.create.test.ts` | Planned |
| PIPE-01 | Pipeline persists dev, staging, prod stages | Integration | 07-02 | `pnpm exec vitest run --project api -t pipelines.create` | `apps/api/src/__tests__/pipelines.create.test.ts` | Planned |
| TELE-01 | error_rate threshold persisted per stage | Integration | 07-02 | `pnpm exec vitest run --project api -t pipelines.create` | `apps/api/src/__tests__/pipelines.create.test.ts` | Planned |
| TELE-02 | latency_p95 threshold persisted per stage | Integration | 07-02 | `pnpm exec vitest run --project api -t pipelines.create` | `apps/api/src/__tests__/pipelines.create.test.ts` | Planned |
| API-03 | POST /v1/pipelines returns 201 | Integration | 07-02 | `pnpm exec vitest run --project api -t pipelines.create` | `apps/api/src/__tests__/pipelines.create.test.ts` | Planned |
| API-03 | PATCH /v1/pipelines/:id deactivates pipeline | Integration | 07-02 | `pnpm exec vitest run --project api -t pipelines.create` | `apps/api/src/__tests__/pipelines.create.test.ts` | Planned |
| API-03 | GET list includes isActive; GET detail includes gatePolicies | Integration | 07-02 | `pnpm exec vitest run --project api -t pipelines.list` | `apps/api/src/__tests__/pipelines.list.test.ts` | Planned |
| GRD-03 | Reject createRun when flagKey mismatches pipeline | Integration | 07-03 | `pnpm exec vitest run --project api -t guardrails.integration` | `apps/api/src/__tests__/guardrails.integration.test.ts` | Planned |
| GRD-03 | Reject createRun when pipeline inactive | Integration | 07-03 | `pnpm exec vitest run --project api -t guardrails.integration` | `apps/api/src/__tests__/guardrails.integration.test.ts` | Planned |
| GRD-03 | Reject startRun after pipeline deactivated | Integration | 07-03 | `pnpm exec vitest run --project api -t guardrails.integration` | `apps/api/src/__tests__/guardrails.integration.test.ts` | Planned |
| GRD-02 | Valid createRun + startRun self-service flow | Integration | 07-03 | `pnpm exec vitest run --project api -t guardrails.integration` | `apps/api/src/__tests__/guardrails.integration.test.ts` | Planned |
| GRD-02 | /runs/new picker filters inactive pipelines | Integration | 07-03 | `pnpm exec vitest run --project web -t create-run` | `apps/web/src/app/runs/new/page.tsx` | Planned |
| UI-04 | Pipeline form validation prevents empty name submit | MSW integration | 07-04 | `pnpm exec vitest run --project web -t pipeline` | `apps/web/src/__tests__/integration/pipeline-form.test.tsx` | Planned |
| UI-04 | Successful form submit navigates to pipeline detail | MSW integration | 07-04 | `pnpm exec vitest run --project web -t pipeline` | `apps/web/src/__tests__/integration/pipeline-form.test.tsx` | Planned |
| D-21 | Repository deactivate sets isActive false | DB integration | 07-01 | `pnpm exec vitest run --project db -t pipeline.integration` | `packages/db/src/__tests__/pipeline.integration.test.ts` | Planned |
| D-12 | PipelineConfigAudit on create/deactivate | Integration | 07-02 | `pnpm exec vitest run --project api -t pipelines.create` | `apps/api/src/__tests__/pipelines.create.test.ts` | Planned |

## Decision Coverage (CONTEXT.md)

| Decision | Plan | Verification |
|----------|------|----------------|
| D-01 Reuse Pipeline/Stage/GatePolicy | 07-01, 07-02 | No new pipeline tables except audit |
| D-02 GuardrailPolicy minimal v1 | 07-01 | GuardrailPolicySchema exported; enforcement from pipeline fields |
| D-03 Extend contracts | 07-01 | `pnpm --filter @ff-promo/contracts run build` |
| D-04 Immutable create + deactivate | 07-01, 07-02 | PATCH metadata only; no stage mutation |
| D-05 POST /v1/pipelines | 07-02 | pipelines.create test |
| D-06 PATCH /v1/pipelines/:id | 07-02 | deactivate test |
| D-07 Extend GET list/detail | 07-02 | pipelines.list test |
| D-08 GuardrailService in createRun/startRun | 07-03 | guardrails.integration test |
| D-09 Reuse existing promotion endpoints | 07-03 | No new promotion routes |
| D-10 Hard reject rules | 07-01 | guardrail.service unit tests |
| D-11 Monotonic stage order | 07-01 | guardrail.service unit tests |
| D-12 Config audit with actor | 07-02 | PipelineConfigAudit + create test |
| D-13 /pipelines list | 07-04 | build + manual checklist |
| D-14 /pipelines/new form | 07-04 | pipeline-form MSW test |
| D-15 /pipelines/[id] detail + deactivate | 07-04 | build + manual checklist |
| D-16 api-client CRUD | 07-04 | api-client test |
| D-17 No RBAC v1 | all | No Better Auth tasks |
| D-18 Actor metadata | 07-02, 07-04 | platform vs dev actorIds in payloads |
| D-19 API integration tests | 07-02, 07-03 | pipelines.create + guardrails.integration |
| D-20 MSW form tests | 07-04 | pipeline-form.test.tsx |
| D-21 Repository deactivate | 07-01 | pipeline.integration test |

## Multi-Source Coverage Audit

| Source | Item | Plan |
|--------|------|------|
| GOAL | Platform configures guardrails; developers self-serve | 07-02, 07-03, 07-04 |
| GOAL | Server-side enforcement | 07-01, 07-03 |
| REQ | PIPE-01 | 07-02 |
| REQ | TELE-01, TELE-02 | 07-01, 07-02, 07-04 |
| REQ | GRD-01 | 07-01, 07-02 |
| REQ | GRD-02 | 07-03, 07-04 |
| REQ | GRD-03 | 07-01, 07-03 |
| REQ | API-03 | 07-02 |
| REQ | UI-04 | 07-04 |
| RESEARCH | GuardrailService | 07-01, 07-03 |
| RESEARCH | PipelineConfigAudit | 07-02 |
| RESEARCH | listAll + isActive badge | 07-01, 07-02, 07-04 |
| RESEARCH | Fixed 3-stage form | 07-04 |
| CONTEXT | D-01–D-21 (except deferred) | See decision table |

**Excluded (not gaps):** GRD-04, API-04, GRD-05/06, PIPE-05/06, TELE-05/06 per CONTEXT deferred.

## Sampling Rate

| Gate | Command |
|------|---------|
| Per task (guardrail unit) | `pnpm exec vitest run --project api guardrail.service` |
| Per task (pipeline API) | `pnpm exec vitest run --project api pipelines.create pipelines.list` |
| Per task (enforcement) | `pnpm exec vitest run --project api guardrails.integration` |
| Per task (web) | `pnpm exec vitest run --project web -t pipeline` |
| Per wave merge | `pnpm test` |
| Phase verification | `/gsd-verify-work 07` — full suite green |

## Manual Verification Checklist (end of phase)

1. Start stack: API :3000, web :3001, PostgreSQL via docker compose.
2. Open `/pipelines` — seeded and created pipelines show with Active/Inactive badges and stage counts.
3. Create pipeline at `/pipelines/new` — fixed dev/staging/prod rows; submit lands on detail with thresholds visible.
4. Deactivate pipeline from detail — badge updates to Inactive; pipeline still visible in list.
5. Open `/runs/new` — inactive pipeline not in picker; active pipeline auto-fills flagKey.
6. Create run with matching flagKey — succeeds; override flagKey in API (curl) — returns 403 forbidden.
7. Confirm PATCH cannot mutate stages (structural change requires new POST with bumped version).

## Out of Scope (deferred per CONTEXT)

- GRD-04 RBAC / Better Auth
- API-04 CLI
- GRD-05 approval gates, GRD-06 templates
- PIPE-05/06 sub-stage rollouts
- TELE-05/06 alerting and soak time
- Per-role UI hiding
