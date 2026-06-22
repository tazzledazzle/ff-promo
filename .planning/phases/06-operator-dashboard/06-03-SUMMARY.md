---
phase: 06-operator-dashboard
plan: 03
subsystem: web
tags: [forensics, polling, ui-02]
requires:
  - phase: 06-02
provides:
  - /runs/[id] detail with forensics
  - Status-aware polling (8s active/paused)
requirements-completed: [UI-02]
completed: 2026-06-22
---

# Phase 6 Plan 03 Summary

**Run detail page with gate forensics, history tables, and polling.**

## Accomplishments

- `GateForensicsPanel`, `GateResultsTable`, `AuditEventsList`, `RunStageTimeline`
- `usePromotionRun` with `runPollIntervalMs` (8s for active/paused)
- Integration test for paused run forensics display

## Verification

- `pnpm exec vitest run --project web -t "run detail"` — pass
