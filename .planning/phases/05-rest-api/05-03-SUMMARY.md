---
phase: 05-rest-api
plan: 03
subsystem: api
tags: [rest, temporal, api-01, safe-02]
requires:
  - phase: 05-01
    provides: Fastify scaffold, contracts
  - phase: 05-02
    provides: promotion-control start/signal
provides:
  - Promotion run control routes (create/start/pause/resume/abort)
  - PromotionRunService with D-15 audit-before-start
affects: [05-04]
tech-stack:
  patterns: [per-request DB, mock Temporal in tests]
key-files:
  created:
    - apps/api/src/services/promotion-run.service.ts
    - apps/api/src/routes/promotion-runs.ts
    - apps/api/src/lib/db.ts
    - apps/api/src/lib/temporal-client.ts
    - apps/api/src/plugins/auth.ts
    - apps/api/src/__tests__/promotion-runs.control.test.ts
    - apps/api/src/__tests__/helpers/mock-temporal.ts
requirements-completed: [API-01, SAFE-02]
duration: 45min
completed: 2026-06-22
---

# Phase 5 Plan 03 Summary

**API-01 control endpoints wired to promotion-control with state guards and audit on start.**

## Accomplishments

- `POST /v1/promotion-runs` creates pending runs
- `POST .../start|pause|resume|abort` delegates to Temporal via promotion-control
- Optional `X-API-Key` auth; actor from body or request decoration
- Control integration tests with mock Temporal client (testcontainers DB)

## Verification

- `pnpm --filter @ff-promo/api run build` — pass
- `vitest run --project api promotion-runs.control` — requires Docker testcontainers
