---
phase: 06-operator-dashboard
plan: 02
subsystem: web
tags: [react-query, ui-01]
requires:
  - phase: 06-01
provides:
  - /runs list page
  - RunStatusBadge, RunsTable components
requirements-completed: [UI-01]
completed: 2026-06-22
---

# Phase 6 Plan 02 Summary

**Promotion runs list page with TanStack Query and shadcn table UI.**

## Accomplishments

- `usePromotionRuns` hook with 30s list refresh
- `/runs` page with status badges, pipeline/stage columns, detail links
- MSW integration test for runs list

## Verification

- `pnpm exec vitest run --project web -t "runs list"` — pass
