# Phase 6: Operator Dashboard — Validation Map

**Phase:** 06-operator-dashboard  
**Requirements:** UI-01, UI-02, UI-03, SAFE-02  
**Framework:** Vitest 4.1.9 (`web` + `api` projects)  
**Last updated:** 2026-06-22

## Requirement → Test Coverage

| Req ID | Behavior | Test Type | Plan | Automated Command | File (created in plan) | Status |
|--------|----------|-----------|------|-------------------|------------------------|--------|
| UI-01 | `GET /v1/promotion-runs` returns recent runs with stage metadata | API integration | 06-01 | `pnpm exec vitest run --project api promotion-runs.list` | `apps/api/src/__tests__/promotion-runs.list.test.ts` | Planned |
| UI-01 | Runs list page renders rows with flag key, pipeline, environment | MSW integration | 06-02 | `pnpm exec vitest run --project web -t "runs list"` | `apps/web/src/__tests__/integration/runs-list.test.tsx` | Planned |
| UI-01 | Status badge maps all promotion statuses | RTL unit | 06-02 | `pnpm exec vitest run --project web -t "RunStatusBadge"` | `apps/web/src/__tests__/components/run-status-badge.test.tsx` | Planned |
| UI-01 | Detail header shows current stage/environment | MSW integration | 06-03 | `pnpm exec vitest run --project web -t "run detail"` | `apps/web/src/__tests__/integration/run-detail.test.tsx` | Planned |
| UI-02 | Forensics panel shows fail metrics (metricType, verdict, threshold, observed) | RTL unit | 06-03 | `pnpm exec vitest run --project web -t "GateForensicsPanel"` | `apps/web/src/__tests__/components/gate-forensics-panel.test.tsx` | Planned |
| UI-02 | Gate results history table renders evaluations | RTL unit | 06-03 | `pnpm exec vitest run --project web -t "GateResultsTable"` | `apps/web/src/__tests__/components/gate-results-table.test.tsx` | Planned |
| UI-02 | Empty forensics shows pause reason without broken UI | RTL unit | 06-03 | `pnpm exec vitest run --project web -t "GateForensicsPanel"` | `apps/web/src/__tests__/components/gate-forensics-panel.test.tsx` | Planned |
| UI-03 | Start button visible for pending runs only | RTL unit | 06-04 | `pnpm exec vitest run --project web -t "RunControlBar"` | `apps/web/src/__tests__/components/run-control-bar.test.tsx` | Planned |
| UI-03 | Pause mutation calls API on active run | MSW integration | 06-04 | `pnpm exec vitest run --project web -t "control-actions"` | `apps/web/src/__tests__/integration/control-actions.test.tsx` | Planned |
| UI-03 | Create run form posts and navigates to detail | MSW integration | 06-04 | `pnpm exec vitest run --project web -t "create run"` | `apps/web/src/__tests__/integration/create-run.test.tsx` | Planned |
| SAFE-02 | Abort requires confirmation before mutation | RTL unit | 06-04 | `pnpm exec vitest run --project web -t "AbortConfirm\|confirm-abort"` | `apps/web/src/__tests__/components/confirm-abort-dialog.test.tsx` | Planned |
| SAFE-02 | Abort POST fires only after confirm on active/paused | MSW integration | 06-04 | `pnpm exec vitest run --project web -t "control-actions"` | `apps/web/src/__tests__/integration/control-actions.test.tsx` | Planned |
| SAFE-02 | Abort hidden for pending runs (API 409 avoidance) | RTL unit | 06-04 | `pnpm exec vitest run --project web -t "RunControlBar"` | `apps/web/src/__tests__/components/run-control-bar.test.tsx` | Planned |
| D-07 | List pipelines for create picker | API integration | 06-01 | `pnpm exec vitest run --project api pipelines.list` | `apps/api/src/__tests__/pipelines.list.test.ts` | Planned |
| D-13 | Active/paused runs poll; terminal runs static | Manual + code review | 06-03 | `grep -q runPollIntervalMs apps/web/src/lib/polling.ts` | `apps/web/src/lib/polling.ts` | Planned |
| D-15 | API_KEY not in client bundle | Manual + code review | 06-01 | `grep -r NEXT_PUBLIC_API_KEY apps/web/src && exit 1 || exit 0` | `apps/web/src/app/api/ff-promo/[[...path]]/route.ts` | Planned |

## Decision Coverage (CONTEXT.md)

| Decision | Plan | Verification |
|----------|------|----------------|
| D-01 Next.js 16 App Router | 06-01 | `pnpm --filter @ff-promo/web run build` |
| D-02 React 19 + TS + Biome | 06-01 | biome check + build |
| D-03 Tailwind v4 + shadcn | 06-01, 06-02 | shadcn ui/ components exist |
| D-04 TanStack Query v5 | 06-01, 06-02 | QueryProvider + hooks |
| D-05 Typed api-client | 06-01 | api-client.test.ts |
| D-06 REST via BFF when needed | 06-01 | Route Handler proxy |
| D-07 List promotion runs | 06-01 | promotion-runs.list test |
| D-08 Detail gateForensics | 06-03 | run-detail integration test |
| D-09 Control errors (409) | 06-04 | RunControlBar test |
| D-10 /runs list | 06-02 | runs-list test |
| D-11 /runs/[id] detail | 06-03 | run-detail test |
| D-12 /runs/new create | 06-04 | create-run test |
| D-13 Polling 5–10s | 06-03 | polling.ts + usePromotionRun |
| D-14 Abort confirmation | 06-04 | confirm-abort-dialog test |
| D-15 API_KEY server-side | 06-01 | proxy route, no NEXT_PUBLIC_API_KEY |
| D-16 dashboard actor | 06-02, 06-04 | actor.ts used in mutations |
| D-17 RTL widget tests | 06-02, 06-03, 06-04 | vitest web component tests |
| D-18 MSW integration tests | 06-02, 06-03, 06-04 | integration/*.test.tsx |
| D-19 vitest web project | 06-01 | `vitest run --project web` |

## Sampling Rate

| Gate | Command |
|------|---------|
| Per task (web) | `pnpm exec vitest run --project web` |
| Per task (API list) | `pnpm exec vitest run --project api promotion-runs.list pipelines.list` |
| Per wave merge | `pnpm test` |
| Phase verification | `/gsd-verify-work 06` — full suite green |

## Manual Verification Checklist (end of phase)

1. Start stack: API on :3000, web on :3001 with `API_KEY` set server-side only.
2. Open `/runs` — seeded runs appear with status and environment columns.
3. Open paused run — forensics panel shows gate metrics.
4. Create run at `/runs/new` — lands on detail; Start transitions to active.
5. Pause → Resume → Abort with confirmation — list reflects terminal state after abort.
6. Confirm browser devtools Network tab shows `/api/ff-promo/...` not raw API_KEY header from client bundle.

## Out of Scope (deferred per CONTEXT)

- UI-04 pipeline/guardrail config UI → Phase 7
- GRD-04 RBAC / Better Auth → Phase 7
- WebSocket real-time updates
- Playwright E2E (MSW sufficient per D-18)
- Recharts sparklines (table forensics is UI-02 minimum)
