---
phase: 3
slug: telemetry-adapter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (add `telemetry` project) |
| **Quick run command** | `pnpm exec vitest run --project telemetry` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run --project telemetry`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 03-01 | 0 | — | unit | `pnpm --filter @ff-promo/contracts exec tsc --noEmit` | ❌ W0 | ⬜ pending |
| 03-01-02 | 03-01 | 0 | — | unit | `pnpm install && grep telemetry vitest.config.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 03-02 | 1 | TELE-03 | unit | `pnpm exec vitest run --project telemetry promql-builder` | ❌ W0 | ⬜ pending |
| 03-02-02 | 03-02 | 1 | TELE-03 | unit | `pnpm exec vitest run --project telemetry parse-response` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03-03 | 2 | TELE-03 | unit | `pnpm exec vitest run --project telemetry evaluate-gate-policy` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03-03 | 2 | TELE-04 | unit | `pnpm exec vitest run --project telemetry run-preflight` | ❌ W0 | ⬜ pending |
| 03-04-01 | 03-04 | 3 | TELE-03/04 | integration | `pnpm exec vitest run --project telemetry` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add `telemetry` project to root `vitest.config.ts`
- [ ] `packages/telemetry/package.json` with vitest test script
- [ ] `nock` devDependency (reuse from ld-adapter pattern)
- [ ] Prometheus API fixture JSON files under `src/__tests__/fixtures/`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Prometheus smoke test | TELE-03/04 | No Prometheus in CI | `docker compose --profile prometheus up`, set `PROMETHEUS_BASE_URL` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
