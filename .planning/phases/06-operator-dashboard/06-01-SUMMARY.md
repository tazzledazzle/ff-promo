---
phase: 06-operator-dashboard
plan: 01
subsystem: web
tags: [nextjs, api, contracts, vitest]
requires:
  - phase: 05-rest-api
    provides: REST control/read endpoints
provides:
  - Next.js 16 dashboard shell
  - GET /v1/promotion-runs and GET /v1/pipelines list APIs
  - Typed api-client + BFF proxy
  - vitest web project
affects: [06-02, 06-03, 06-04]
key-files:
  created:
    - apps/web/next.config.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/app/api/ff-promo/[[...path]]/route.ts
    - apps/api/src/__tests__/promotion-runs.list.test.ts
requirements-completed: [UI-01]
completed: 2026-06-22
---

# Phase 6 Plan 01 Summary

**Next.js scaffold, list API endpoints, typed client, and BFF proxy for the operator dashboard.**

## Accomplishments

- Replaced tsx web shell with Next.js 16 App Router on port 3001
- Added list contracts, repository methods, and `GET /v1/promotion-runs` + `GET /v1/pipelines`
- Implemented `createApiClient` and server-side BFF proxy for `X-API-Key`
- Added vitest `web` project with api-client smoke test

## Verification

- `pnpm --filter @ff-promo/web run build` — pass
- `pnpm exec vitest run --project web api-client` — pass
