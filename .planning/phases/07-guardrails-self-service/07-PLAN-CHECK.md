# Phase 7 Plan Check

**Phase:** 07-guardrails-self-service — Guardrails & Self-Service  
**Checked:** 2026-06-22  
**Plans verified:** 4 (07-01 through 07-04)  
**Verdict:** **PASSED** (after minor revisions applied)

---

## Executive Summary

Phase 7 plans cover all eight roadmap requirements (PIPE-01, TELE-01, TELE-02, GRD-01, GRD-02, GRD-03, API-03, UI-04) across four waves with valid dependencies and complete task structure. Locked CONTEXT decisions D-01–D-21 are implemented; deferred scope (GRD-04, API-04, etc.) is excluded.

**Revisions applied during check:**
1. `07-RESEARCH.md` — Open Questions marked **(RESOLVED)** with plan references
2. `07-02-PLAN.md` — Reordered Tasks 2↔3 (write integration tests before route implementation; TDD)
3. `07-03-PLAN.md` — Reordered Tasks 1↔2 (write guardrail integration tests before wiring)

**Recommendation:** Proceed with `/gsd-execute-phase 7`.

---

## Coverage Summary

| Requirement | Plans | Tasks | Status |
|-------------|-------|-------|--------|
| PIPE-01 | 07-02 | 07-02 T2–T3 | Covered |
| TELE-01 | 07-01, 07-02, 07-04 | Contracts, API create, form editors | Covered |
| TELE-02 | 07-01, 07-02, 07-04 | Same as TELE-01 | Covered |
| GRD-01 | 07-01, 07-02 | GuardrailService + API create validation | Covered |
| GRD-02 | 07-03, 07-04 | Existing promotion endpoints + picker filter | Covered |
| GRD-03 | 07-01, 07-03 | GuardrailService + createRun/startRun hooks | Covered |
| API-03 | 07-02 | POST/PATCH/GET extensions | Covered |
| UI-04 | 07-04 | /pipelines list, new, detail | Covered |

### Roadmap Success Criteria

| # | Criterion | Plan coverage |
|---|-----------|---------------|
| 1 | Multi-environment pipelines (dev→staging→prod) | 07-02 POST, 07-04 fixed 3-stage form |
| 2 | Error rate + latency p95 thresholds per stage | 07-01 contracts, 07-02 API, 07-04 form |
| 3 | Configure guardrails via REST + dashboard | 07-02 API, 07-04 UI (v1 minimal GRD-01 per D-02) |
| 4 | Developer self-service within bounds | 07-03 GRD-02 flow |
| 5 | Server-side rejection of out-of-bounds requests | 07-01 + 07-03 GuardrailService |

---

## Plan Summary

| Plan | Tasks | Files | Wave | depends_on | Structure |
|------|-------|-------|------|------------|-----------|
| 07-01 | 3 | 8 | 0 | [] | Valid |
| 07-02 | 3 | 9 | 1 | 07-01 | Valid (reordered) |
| 07-03 | 3 | 5 | 2 | 07-02 | Valid (reordered) |
| 07-04 | 3 | 16 | 3 | 07-03 | Valid |

---

## Dimension Results

### 1. Requirement Coverage — PASS

All eight requirement IDs appear in plan `requirements` frontmatter with implementing tasks. No PROJECT.md requirements relevant to Phase 7 are silently dropped.

### 2. Task Completeness — PASS

`gsd-sdk query verify.plan-structure` reports `valid: true` for all four plans. All auto tasks have files, action, verify, done. TDD tasks include behavior blocks.

### 3. Dependency Correctness — PASS

Acyclic chain: 07-01 → 07-02 → 07-03 → 07-04. No forward references or cycles.

### 4. Key Links Planned — PASS

Critical wiring documented in `must_haves.key_links` and task actions:
- GuardrailService → contracts (07-01)
- PipelineService → GuardrailService → repository (07-02)
- promotion-run.service → GuardrailService (07-03)
- Dashboard pages → api-client → API routes (07-04)

### 5. Scope Sanity — PASS (1 warning)

| Plan | Tasks | Files | Assessment |
|------|-------|-------|------------|
| 07-01 | 3 | 8 | OK |
| 07-02 | 3 | 9 | OK |
| 07-03 | 3 | 5 | OK |
| 07-04 | 3 | 16 | Warning — high file count; acceptable for UI-04 mirroring Phase 6 cadence |

### 6. Verification Derivation — PASS

`must_haves.truths` are user-observable (platform engineer creates pipeline, developer rejected on wrong flagKey, etc.). Artifacts map to truths with key_links specifying wiring method.

### 7. Context Compliance — PASS

| Decision | Status |
|----------|--------|
| D-01–D-21 (locked) | All referenced in task actions |
| Deferred (GRD-04, API-04, etc.) | Absent from plans |
| Discretion areas | Handled (PATCH, fixed 3-stage form, GuardrailPolicySchema without DB column) |

**Note:** D-08 documents `validatePromotionRequest({ pipelineId, flagKey })`; plans use `{ pipeline, flagKey }` with caller fetching pipeline — equivalent enforcement, matches RESEARCH Pattern 2.

### 7b. Scope Reduction Detection — PASS

No silent reduction of locked decisions. D-02 minimal v1 (derive guardrails from pipeline fields, export GuardrailPolicySchema without DB persistence) is explicit in CONTEXT and plans.

### 7c. Architectural Tier Compliance — PASS

Tasks align with RESEARCH Architectural Responsibility Map:
- Guardrail enforcement in API tier (07-01, 07-03)
- Pipeline CRUD validation in contracts + API (07-01, 07-02)
- UI in browser tier with BFF proxy (07-04)
- No auth logic in client-only tier

### 8. Nyquist Compliance — PASS

`07-VALIDATION.md` exists. All tasks have `<automated>` verify commands.

| Task | Plan | Wave | Automated Command | Status |
|------|------|------|-------------------|--------|
| T1 contracts | 07-01 | 0 | `pnpm --filter @ff-promo/contracts run build` | ✅ |
| T2 guardrail unit | 07-01 | 0 | `vitest run --project api guardrail.service` | ✅ |
| T3 repository | 07-01 | 0 | `vitest run --project db pipeline.integration` | ✅ |
| T1 audit migration | 07-02 | 1 | `prisma migrate deploy && db build` | ✅ |
| T2 API tests (TDD) | 07-02 | 1 | `test -f pipelines.create.test.ts` | ✅ |
| T3 routes/service | 07-02 | 1 | `vitest run --project api pipelines.create pipelines.list` | ✅ |
| T1 guardrail tests | 07-03 | 2 | `test -f guardrails.integration.test.ts` | ✅ |
| T2 wire guardrails | 07-03 | 2 | `vitest run --project api guardrails.integration` | ✅ |
| T3 picker filter | 07-03 | 2 | `vitest run --project web create-run && web build` | ✅ |
| T1 api-client | 07-04 | 3 | `vitest run --project web api-client && web build` | ✅ |
| T2 pipeline pages | 07-04 | 3 | `pnpm --filter @ff-promo/web run build` | ✅ |
| T3 MSW tests | 07-04 | 3 | `vitest run --project web -t pipeline` | ✅ |

**Sampling:** Each wave has ≥2 vitest-based verifies per 3-task window. TDD scaffold tasks use `test -f` file-existence gate before implementation.

### 9. Cross-Plan Data Contracts — PASS

Shared entities (PipelineCreateInput, PipelineResponse, GuardrailViolation) flow contracts → repository → API → web without conflicting transforms. listAll API + client-side activeOnly filter is consistent (RESEARCH A5).

### 10. CLAUDE.md Compliance — PASS

- Vitest (not Jest)
- Fastify + Zod contracts
- Shared `@ff-promo/contracts`
- No Next.js as primary backend
- Telemetry v1: error_rate + latency_p95 only
- Pause-and-alert / API-boundary rejection pattern

### 11. Research Resolution — PASS (after fix)

Open Questions section updated to `(RESOLVED)` with plan-backed decisions.

### 12. Pattern Compliance — PASS

Plans reference `07-PATTERNS.md` in context and cite analogs (promotion-runs routes, runs/new form, runs-table, use-run-mutations). Shared patterns (Zod at repository boundary, actor on mutations, api-error shape) included.

---

## Issues Found and Resolved

### Fixed During Check

| # | Dimension | Severity | Description | Fix applied |
|---|-----------|----------|-------------|-------------|
| 1 | research_resolution | blocker | RESEARCH Open Questions unresolved | Marked RESOLVED in 07-RESEARCH.md |
| 2 | key_links_planned | blocker | 07-02 Task 2 verify ran tests before Task 3 created them | Swapped tasks 2↔3 |
| 3 | key_links_planned | blocker | 07-03 Task 1 verify ran tests before Task 2 created them | Swapped tasks 1↔2 |

### Remaining Warnings (non-blocking)

| # | Dimension | Severity | Description | Recommendation |
|---|-----------|----------|-------------|----------------|
| 1 | scope_sanity | warning | 07-04 lists 16 files_modified | Monitor during execution; split only if context degrades |
| 2 | pattern_compliance | info | PATTERNS.md uses `unprocessable()` naming; plans use `unprocessableEntity()` | Align with existing api-error.ts naming at implementation |

---

## Structured Issues (post-fix)

```yaml
issues: []
```

---

## Recommendation

**Proceed with execution:**

```bash
/gsd-execute-phase 7
```

Execute plans in wave order (07-01 → 07-02 → 07-03 → 07-04). After all four SUMMARY files exist, run `/gsd-verify-work 07` against the manual checklist in `07-VALIDATION.md`.

---

*Checker: gsd-plan-checker | Gate: Revision (iteration 1, passed after auto-fixes)*
