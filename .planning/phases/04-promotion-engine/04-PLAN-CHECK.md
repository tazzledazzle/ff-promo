# Phase 4 Plan Check

**Status:** VERIFICATION PASSED (after revision)

## Revision
- **04-03 Task 2:** Added D-17 `hasAborted()` guards before `applyStageTargeting` and `evaluateGate`; abort-before-targeting test requirement.

## Summary
- 4 plans, 12 tasks, linear waves 0–3
- Requirements PIPE-02, PIPE-03, PIPE-04, SAFE-02 covered
- Decisions D-01–D-21 addressed (D-17 guard added in plan revision)

## Warnings (non-blocking)
- Activity timeout tier may need 2m for external I/O (executor discretion)
- 04-02 Task 1 verify is file-existence smoke only


**Phase:** Promotion Engine  
**Checked:** 2026-06-22  
**Plans verified:** 4 (04-01 through 04-04)  
**Verdict:** ISSUES FOUND — 1 blocker, 5 warnings, 1 info

---

## Summary

Plans form a coherent four-wave chain (foundation → preflight/LD activities → evaluateGate + workflow → start helper + integration). All four roadmap requirements (PIPE-02, PIPE-03, PIPE-04, SAFE-02) appear in plan frontmatter and have covering tasks. Task structure is complete (files, action, verify, done on all 12 tasks). Dependencies are linear and acyclic.

One **locked decision (D-17)** is only partially planned: abort tests are scheduled, but the workflow extension task does not require `hasAborted()` guards before side-effect activities, so LD writes can still run after an abort signal is observed within the same loop iteration.

---

## Requirement Coverage

| Requirement | Plans | Covering Tasks | Status |
|-------------|-------|----------------|--------|
| PIPE-02 | 04 | 04 Task 1, 04 Task 2 | Covered |
| PIPE-03 | 02, 03, 04 | 02 Task 3, 03 Task 2, 04 Task 2 | Covered |
| PIPE-04 | 03, 04 | 03 Task 1–3, 04 Task 2 | Covered |
| SAFE-02 | 04 | 04 Task 3 | Covered (signal path; API deferred per D-16) |

Phase goal from ROADMAP.md (“flags advance only when gates pass; failed gates hold progression”) is addressed by 03-02/03-03 and validated in 04-02.

---

## Decision Coverage (D-01 – D-21)

| Decision | Planned? | Location |
|----------|----------|----------|
| D-01 | Yes | 03 Task 2 — applyStageTargeting → evaluateGate → advance on pass |
| D-02 | Implicit | 02 Task 3 scopes LD write to current stage environment |
| D-03 | Implicit | Single evaluateGate per loop iteration; not explicitly forbidden polling |
| D-04 | Yes | 03 Task 1–2 — pauseReason on fail; continue re-enters same stage |
| D-05 | Yes | 03 Task 2 — runPreflight before stage loop |
| D-06 | Yes | 03 Task 2 — preflight fail → aborted + return |
| D-07 | Yes | 02 Task 2 — no GateResult rows on preflight |
| D-08 | Yes | 02 Task 3 |
| D-09 | Yes | 01 Task 3, 02 Task 3 |
| D-10 | Yes | 02 Task 3 — applyTargeting via ld-adapter |
| D-11 | Yes | 03 Task 1 |
| D-12 | Yes | 03 Task 1, 04 Task 2 |
| D-13 | Yes | 03 Task 1 |
| D-14 | Yes | 03 Task 1 — fail-closed test path |
| D-15 | Yes | 04 Task 1 |
| D-16 | Yes | No REST/CLI tasks; README notes Phase 5 deferral |
| D-17 | **Partial** | 04 Task 3 tests abort; **workflow guard before LD write missing** |
| D-18 | Yes | 04 Task 3 — abortSignal in signals test |
| D-19 | Yes | 02 Tasks 2–3, 03 Task 1 |
| D-20 | Yes | 01 Task 2 |
| D-21 | Yes | 03 Task 2 — no adapter imports in workflow |

Deferred ideas (REST/CLI, sub-stage rollouts, auto-polling, auto-rollback) are not present in plans.

---

## Plan Summary

| Plan | Wave | Tasks | Files | Depends On | Structure |
|------|------|-------|-------|------------|-----------|
| 04-01 | 0 | 3 | 9 | — | Valid |
| 04-02 | 1 | 3 | 9 | 04-01 | Valid |
| 04-03 | 2 | 3 | 6 | 04-02 | Valid |
| 04-04 | 3 | 3 | 6 | 04-03 | Valid |

---

## Dimension Results

| Dimension | Result | Notes |
|-----------|--------|-------|
| 1. Requirement coverage | PASS | All PIPE-02/03/04 + SAFE-02 in frontmatter with tasks |
| 2. Task completeness | PASS | All 12 auto tasks have files, action, verify, done |
| 3. Dependency correctness | PASS | Linear 01→02→03→04; waves consistent |
| 4. Key links planned | PASS | Activity→adapter, workflow→activities, start→workflow wired |
| 5. Scope sanity | PASS | 3 tasks/plan; file counts within budget |
| 6. Verification derivation | PASS | must_haves truths are user-observable |
| 7. Context compliance | **FAIL** | D-17 workflow guard missing |
| 7b. Scope reduction | PASS | No locked-decision reductions detected |
| 7c. Architectural tier | PASS | Activities own I/O; workflow orchestration-only |
| 8. Nyquist compliance | PASS | VALIDATION.md present; all tasks have `<automated>`; 3/3 per wave |
| 9. Cross-plan data contracts | PASS | applyStageTargeting variation IDs → evaluateGate input |
| 10. CLAUDE.md compliance | PASS | LD REST adapter, Vitest, Temporal, no auto-rollback |
| 11. Research resolution | PASS | Open questions resolved in RESEARCH.md |
| 12. Pattern compliance | WARN | File naming differs from PATTERNS.md (load-run-context vs run-loader) |

---

## Dimension 8: Nyquist Compliance

| Task | Plan | Wave | Automated Command | Status |
|------|------|------|-------------------|--------|
| 1 | 04-01 | 0 | `pnpm install && pnpm --filter @ff-promo/contracts exec tsc --noEmit` | ✅ |
| 2 | 04-01 | 0 | `pnpm exec vitest run --project worker load-run-context` | ✅ |
| 3 | 04-01 | 0 | `pnpm exec vitest run --project worker stage-targeting` | ✅ |
| 1 | 04-02 | 1 | `test -f ... nock helpers` | ✅ (weak) |
| 2 | 04-02 | 1 | `pnpm exec vitest run --project worker run-preflight.activity` | ✅ |
| 3 | 04-02 | 1 | `pnpm exec vitest run --project worker apply-stage-targeting.activity` | ✅ |
| 1 | 04-03 | 2 | `pnpm exec vitest run --project worker evaluate-gate.activity` | ✅ |
| 2 | 04-03 | 2 | `pnpm --filter @ff-promo/worker run build` | ✅ |
| 3 | 04-03 | 2 | `pnpm exec vitest run --project worker promotion.workflow` | ✅ |
| 1 | 04-04 | 3 | `pnpm exec vitest run --project worker start-promotion-run` | ✅ |
| 2 | 04-04 | 3 | `pnpm exec vitest run --project worker promotion-engine.integration` | ✅ |
| 3 | 04-04 | 3 | `pnpm exec vitest run --project worker promotion.signals && ...` | ✅ |

Sampling: Wave 0–3 each 3/3 verified → ✅  
Wave 0 (VALIDATION.md): present → ✅  
Overall: ✅ PASS

---

## Blockers (must fix)

### 1. [context_compliance] D-17 — no `hasAborted()` guard before LD side effects

- **Plan:** 04-03  
- **Task:** 2  
- **Description:** Locked decision D-17 requires “no further LD writes after abort observed.” Plan 04-03 Task 2 adds `applyStageTargeting` after `stage_entered` but does not require an abort check between `stage_entered` and `applyStageTargeting` (or before `evaluateGate`). Temporal signal handlers run between activity awaits; without an explicit guard, an abort received after `stage_entered` can still trigger an LD semantic patch in the same iteration.  
- **Fix:** Extend 04-03 Task 2 action and acceptance criteria: after `stage_entered`, call `if (hasAborted()) break;` before `applyStageTargeting` and before `evaluateGate`. Add a workflow test (03 Task 3 or 04 Task 3) asserting no LD PATCH nock intercept fires after abort signal between stage_entered and targeting.

---

## Warnings (should fix)

### 1. [context_compliance] D-03 — single evaluation not explicit in workflow task

- **Plan:** 04-03  
- **Task:** 2  
- **Fix:** Add acceptance criterion: “No polling loop or timer around evaluateGate; exactly one evaluation per loop iteration.”

### 2. [key_links_planned / claude_md_compliance] Tiered activity timeouts not planned

- **Plan:** 04-03  
- **Task:** 2  
- **Description:** RESEARCH Pattern 2 recommends separate `proxyActivities` groups (30s for persist/audit, 2m for runPreflight/applyStageTargeting/evaluateGate). Task 2 says register with “same timeout/retry as existing” (30s), risking timeouts on LD/Prometheus I/O.  
- **Fix:** Split `proxyActivities` in workflow and mirror longer `startToCloseTimeout` in worker.ts for external I/O activities.

### 3. [task_completeness] start-run CLI script omitted from files list

- **Plan:** 04-04  
- **Task:** 1  
- **Description:** Action references `src/scripts/start-run.ts` but `files_modified` omits it.  
- **Fix:** Add `apps/worker/src/scripts/start-run.ts` to frontmatter `files_modified`.

### 4. [pattern_compliance] PATTERNS.md naming drift

- **Plans:** 04-01, 04-02  
- **Description:** PATTERNS maps `run-loader.ts` / `mappers.ts`; plans use `load-run-context.ts` / `stage-targeting.ts`. Functionally equivalent but executor may miss pattern excerpts.  
- **Fix:** Add explicit analog references in Task 2 read_first blocks (`evaluate-gate.ts` include pattern, PATTERNS § run-loader → load-run-context).

### 5. [verification_derivation] Weak verify on nock helper scaffolding

- **Plan:** 04-02  
- **Task:** 1  
- **Description:** Verify is `test -f` only; does not exercise helpers.  
- **Fix:** Optional smoke import test or defer verify to Task 2/3 (document dependency).

---

## Info

### 1. [scope_sanity] Plan 04-03 Task 3 allows mocked workflow activities

- RESEARCH resolved “real activities + nock” for integration; Plan 04-04 Task 2 provides E2E coverage. Acceptable split; no change required unless planner wants workflow tests fully nock-backed.

---

## Structured Issues

```yaml
issues:
  - plan: "04-03"
    dimension: context_compliance
    severity: blocker
    description: "D-17 requires no LD writes after abort observed; workflow task adds applyStageTargeting without hasAborted() guard between stage_entered and side-effect activities"
    task: 2
    user_decision: "D-17: Immediate abort via abortSignal; no further LD writes after abort observed"
    fix_hint: "Add hasAborted() checks before applyStageTargeting and evaluateGate in 04-03 Task 2; add abort-between-stage_entered-and-targeting test"

  - plan: "04-03"
    dimension: context_compliance
    severity: warning
    description: "D-03 single gate evaluation per attempt not stated in workflow task action"
    task: 2
    fix_hint: "Add explicit no-polling acceptance criterion to Task 2"

  - plan: "04-03"
    dimension: key_links_planned
    severity: warning
    description: "External I/O activities planned with 30s timeout instead of RESEARCH Pattern 2 tiered 2m timeout"
    task: 2
    fix_hint: "Split proxyActivities and worker registration timeouts for runPreflight, applyStageTargeting, evaluateGate"

  - plan: "04-04"
    dimension: task_completeness
    severity: warning
    description: "start-run.ts script referenced in action but missing from files_modified"
    task: 1
    fix_hint: "Add apps/worker/src/scripts/start-run.ts to plan frontmatter files_modified"

  - plan: "04-02"
    dimension: pattern_compliance
    severity: warning
    description: "Plan file names differ from PATTERNS.md (load-run-context vs run-loader); analog references thin in some tasks"
    task: 1
    fix_hint: "Cross-reference PATTERNS.md analog paths in read_first blocks"

  - plan: "04-02"
    dimension: verification_derivation
    severity: warning
    description: "Task 1 verify is file-existence only (test -f)"
    task: 1
    fix_hint: "Add minimal vitest smoke or note helpers verified by downstream activity tests"
```

---

## Recommendation

**1 blocker** requires planner revision before `/gsd-execute-phase 4`.

Revise **04-03 Task 2** to include abort guards before side-effect activities and add matching test coverage. Address warnings in the same revision pass (timeouts, script file list, D-03 explicitness) to reduce execution risk.

After revision, re-run plan-check (revision gate iteration 2/3).

---

*Plan checker: gsd-plan-checker | Gate: Revision*
