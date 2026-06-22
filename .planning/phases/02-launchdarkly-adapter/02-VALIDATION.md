---
phase: 2
slug: launchdarkly-adapter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (add `ld-adapter` project) |
| **Quick run command** | `pnpm exec vitest run --project ld-adapter` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run --project ld-adapter`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 0 | — | unit | `pnpm turbo run build --filter=@ff-promo/ld-adapter` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02-02 | 1 | PROV-01 | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/get-flag-state.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02-02 | 1 | PROV-03 | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/variation-resolver.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 02-03 | 2 | PROV-02 | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/semantic-patch-builder.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 02-03 | 2 | PROV-02 | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/rate-limited-client.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 02-04 | 3 | PROV-01–03 | integration | `pnpm exec vitest run --project ld-adapter src/__tests__/launch-darkly-provider.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add `ld-adapter` project to root `vitest.config.ts`
- [ ] `packages/ld-adapter/package.json` with vitest test script
- [ ] `nock` devDependency for HTTP mocking
- [ ] LD API fixture JSON files under `src/__tests__/fixtures/`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live LD account smoke test | PROV-01–03 | No LD token in CI | Set `LD_API_TOKEN`, run against sandbox project |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
