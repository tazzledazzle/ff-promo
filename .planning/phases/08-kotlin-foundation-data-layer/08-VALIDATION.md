---
phase: 8
slug: kotlin-foundation-data-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during Kotlin foundation execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Kotest or JUnit 5 + Gradle |
| **Config file** | `kotlin/modules/db/build.gradle.kts`, `kotlin/modules/worker/build.gradle.kts` |
| **Quick run command** | `cd kotlin && ./gradlew :db:test` |
| **Full suite command** | `cd kotlin && ./gradlew test` |
| **Estimated runtime** | ~60 seconds (with Testcontainers) |

---

## Sampling Rate

- **After every task commit:** Run module-scoped `./gradlew :db:test` or `:worker:test`
- **After every plan wave:** Run `cd kotlin && ./gradlew build test`
- **Before `/gsd-verify-work`:** Full kotlin build + pnpm build green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 08-01-01 | 01 | 0 | KOT-01 | config | `cd kotlin && ./gradlew projects --quiet` | ⬜ pending |
| 08-01-02 | 01 | 0 | KOT-01 | unit | `cd kotlin && ./gradlew :contracts:test` | ⬜ pending |
| 08-02-01 | 02 | 1 | KOT-03 | build | `cd kotlin && ./gradlew :db:compileKotlin` | ⬜ pending |
| 08-02-02 | 02 | 1 | KOT-03 | build | `cd kotlin && ./gradlew :db:compileKotlin` | ⬜ pending |
| 08-02-03 | 02 | 1 | KOT-03 | integration | `cd kotlin && ./gradlew :db:test --tests MigrationSmokeTest` | ⬜ pending |
| 08-03-01 | 03 | 2 | KOT-03 | integration | `cd kotlin && ./gradlew :db:test --tests "*Pipeline*" --tests "*PromotionRun*"` | ⬜ pending |
| 08-03-02 | 03 | 2 | SAFE-01 | integration | `cd kotlin && ./gradlew :db:test --tests "*Audit*" --tests "*GateResult*"` | ⬜ pending |
| 08-04-01 | 04 | 3 | KOT-04 | build | `cd kotlin && ./gradlew :worker:compileKotlin` | ⬜ pending |
| 08-04-02 | 04 | 3 | SAFE-01 | unit | `cd kotlin && ./gradlew :worker:test --tests PromotionWorkflowTest` | ⬜ pending |
| 08-04-03 | 04 | 3 | KOT-04 | build | `cd kotlin && ./gradlew :worker:build` | ⬜ pending |
| 08-05-01 | 05 | 4 | KOT-04 | config | `docker compose --profile kotlin config --quiet` | ⬜ pending |
| 08-05-02 | 05 | 4 | KOT-01 | build | `pnpm run build && pnpm run build:kotlin` | ⬜ pending |
| 08-05-03 | 05 | 4 | KOT-01 | integration | `cd kotlin && ./gradlew build test` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `kotlin/settings.gradle.kts` includes contracts, db, worker — plan 01
- [ ] `kotlin/modules/contracts` kotlinx-serialization DTOs — plan 01
- [ ] `package.json` build:kotlin script — plan 01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kotlin worker connects to Temporal | KOT-04 | Requires running compose stack | `docker compose up -d postgres temporal` then `./gradlew :worker:run` |
| ffpromo_kotlin DB created | KOT-03 | Postgres init script | `\l` in psql shows ffpromo_kotlin |
| pnpm CI unaffected | KOT-01 | Full monorepo | `pnpm run build` at root without kotlin in turbo |

---

## Parity Checklist (vs v1 TypeScript)

| v1 test file | Kotlin target | Plan |
|--------------|---------------|------|
| pipeline.integration.test.ts | PipelineRepositoryIntegrationTest.kt | 08-03 |
| promotion-run.integration.test.ts | PromotionRunRepositoryIntegrationTest.kt | 08-03 |
| audit.integration.test.ts | AuditRepositoryIntegrationTest.kt | 08-03 |
| gate-result.integration.test.ts | GateResultRepositoryIntegrationTest.kt | 08-03 |
| promotion.workflow.test.ts | PromotionWorkflowTest.kt | 08-04 |
