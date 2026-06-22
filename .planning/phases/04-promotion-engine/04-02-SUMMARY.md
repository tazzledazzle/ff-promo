---
phase: 04-promotion-engine
plan: 02
subsystem: worker
tags: [temporal-activities, nock, preflight, launchdarkly]
requires:
  - phase: 04-01
    provides: lib clients, loaders, stage-targeting mappers
provides:
  - runPreflight activity (TELE-04)
  - applyStageTargeting activity (PROV-02)
  - nock test helpers for LD + Prometheus
affects: [04-03, 04-04]
tech-stack:
  added: []
  patterns: [nock HTTP boundary tests, audit on preflight fail]
key-files:
  created:
    - apps/worker/src/activities/run-preflight.ts
    - apps/worker/src/activities/apply-stage-targeting.ts
    - apps/worker/src/__tests__/helpers/nock-launchdarkly.ts
    - apps/worker/src/__tests__/helpers/nock-prometheus.ts
requirements-completed: [PIPE-03]
duration: 30min
completed: 2026-06-22
---

# Phase 4 Plan 02 Summary

**Preflight and stage targeting activities connect telemetry and LD adapters to the worker tier with nock tests.**

## Accomplishments

- `runPreflight`: loads policies, resolves variations, calls `runPreflightChecks`, audits on fail (no GateResult rows)
- `applyStageTargeting`: applies LD semantic patch per stage environment, returns variation IDs
- nock helpers + JSON fixtures for worker integration tests
- Activity tests for pass/fail preflight and targeting happy path

## Verification

- `pnpm --filter @ff-promo/worker run build` — pass
- Activity tests require Docker testcontainers (CI)
