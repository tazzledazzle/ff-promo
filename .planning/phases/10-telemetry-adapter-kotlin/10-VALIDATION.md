---
phase: 10
slug: telemetry-adapter-kotlin
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 10 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | JUnit 5 + kotlin.test |
| **HTTP mocking** | OkHttp MockWebServer |
| **Quick run** | `cd kotlin && ./gradlew :telemetry:test` |

## Per-Task Verification Map

| Task ID | Plan | Requirement | Automated Command | Status |
|---------|------|-------------|-------------------|--------|
| 10-01-01 | 01 | TELE-03 | `./gradlew :telemetry:compileKotlin` | ⬜ |
| 10-01-02 | 01 | TELE-03 | `./gradlew :telemetry:test --tests "*PrometheusClient*"` | ⬜ |
| 10-02-01 | 02 | TELE-03 | `./gradlew :telemetry:test --tests "*PromqlBuilder*"` | ⬜ |
| 10-02-02 | 02 | TELE-03 | `./gradlew :telemetry:test --tests "*ParseResponse*"` | ⬜ |
| 10-03-01 | 03 | TELE-03 | `./gradlew :telemetry:test --tests "*Evaluate*"` | ⬜ |
| 10-03-02 | 03 | TELE-04 | `./gradlew :telemetry:test --tests "*RunPreflight*"` | ⬜ |
| 10-04-01 | 04 | TELE-03/04 | `./gradlew :telemetry:test` | ⬜ |

## Parity Checklist (vs v1)

| v1 test | Kotlin target | Plan |
|---------|---------------|------|
| prometheus-client.test.ts | PrometheusClientTest.kt | 10-01 |
| promql-builder.test.ts | PromqlBuilderTest.kt | 10-02 |
| parse-response.test.ts | ParseResponseTest.kt | 10-02 |
| evaluate-gate-policy.test.ts | EvaluateGatePolicyTest.kt | 10-03 |
| evaluate-stage-gates.test.ts | EvaluateStageGatesTest.kt | 10-03 |
| run-preflight.test.ts | RunPreflightTest.kt | 10-03 |
| telemetry-integration.test.ts | TelemetryIntegrationTest.kt | 10-04 |
