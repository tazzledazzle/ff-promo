---
phase: 1
slug: foundation-data-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (root) — plan 06 creates |
| **Quick run command** | `pnpm exec vitest run --project db` |
| **Full suite command** | `pnpm turbo run test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run --project db`
- **After every plan wave:** Run `pnpm turbo run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | — | — | N/A | config | `test -f turbo.json && node -e "JSON.parse(require('fs').readFileSync('turbo.json','utf8')).tasks"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | — | — | N/A | build | `pnpm turbo run build` | ❌ W0 | ⬜ pending |
| 01-06-01 | 06 | 0 | D-15 | — | Vitest deps installed | unit | `node -e "const p=require('./package.json'); if(!p.devDependencies?.vitest) process.exit(1)"` | ❌ W0 | ⬜ pending |
| 01-06-02 | 06 | 0 | D-12 | — | Compose validates | config | `docker compose config --quiet` | ❌ W0 | ⬜ pending |
| 01-06-03 | 06 | 0 | D-15 | — | testcontainers harness | unit | `pnpm exec vitest run --project db packages/db/src/__tests__/smoke.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | D-05 | — | Schema validates | unit | `cd packages/db && pnpm exec prisma validate` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | D-05 | — | Contracts compile | build | `pnpm turbo run build --filter=@ff-promo/contracts` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | D-05 | T-01-04 | Migration deploys | integration | `cd packages/db && pnpm exec prisma migrate deploy && pnpm exec prisma generate && pnpm run build` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | SAFE-01 | T-01-07 | Pipeline/run persistence | integration | `pnpm exec vitest run packages/db/src/__tests__/pipeline.integration.test.ts packages/db/src/__tests__/promotion-run.integration.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | SAFE-01 | T-01-07 | Append-only audit repository | integration | `pnpm exec vitest run packages/db/src/__tests__/audit.integration.test.ts packages/db/src/__tests__/gate-result.integration.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 3 | D-11 | T-01-10 | Stub activities compile | build | `pnpm turbo run build --filter=@ff-promo/worker` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 3 | D-09 | T-01-10 | Workflow E2E with real activities | integration | `pnpm exec vitest run apps/worker/src/__tests__/promotion.workflow.test.ts apps/worker/src/__tests__/promotion.signals.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-03 | 04 | 3 | D-09 | — | Worker bootstrap | build+test | `pnpm turbo run build --filter=@ff-promo/worker && pnpm exec vitest run apps/worker/src/__tests__/promotion.workflow.test.ts` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 4 | D-16 | — | Seed via testcontainers | integration | `pnpm exec vitest run packages/db/src/__tests__/seed.integration.test.ts` | ❌ W0 | ⬜ pending |
| 01-05-02 | 05 | 4 | D-16 | — | Seed smoke invariants | smoke | `pnpm exec vitest run packages/db/src/__tests__/seed.smoke.test.ts` | ❌ W0 | ⬜ pending |
| 01-05-03 | 05 | 4 | — | — | README documents compose | grep | `grep -v '^#' README.md \| grep -c 'docker compose'` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Root `vitest.config.ts` with `projects: ['packages/db', 'apps/worker']` — plan 06
- [ ] `packages/db/src/__tests__/setup.ts` — testcontainers lifecycle helper — plan 06
- [ ] `packages/db/src/__tests__/smoke.test.ts` — vitest wiring smoke — plan 06
- [ ] `packages/db/src/__tests__/audit.integration.test.ts` — SAFE-01 core — plan 03
- [ ] `packages/db/src/__tests__/pipeline.integration.test.ts` — D-05/D-06 — plan 03
- [ ] `apps/worker/src/__tests__/promotion.workflow.test.ts` — D-09 — plan 04
- [ ] `apps/worker/src/__tests__/promotion.signals.test.ts` — D-10 — plan 04
- [ ] Framework install: `pnpm add -D vitest@4.1.9 @testcontainers/postgresql@12.0.3` at root — plan 06
- [ ] `turbo.json` test task wired in all packages — plan 01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docker Compose stack starts | D-12 | Requires Docker daemon | `docker compose up -d` then verify Postgres and Temporal health |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
