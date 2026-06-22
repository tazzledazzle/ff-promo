# Phase 6: Operator Dashboard - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Mode:** Yolo (recommended defaults auto-selected)

<domain>
## Phase Boundary

Deliver the operator web dashboard (UI-01, UI-02, UI-03) for monitoring promotion runs and triggering control actions. Operators view active/historical runs with current stage, inspect telemetry gate pass/fail and metric values, and start/pause/resume/abort runs from the UI.

Phase 6 is the **operator-facing presentation layer** over the Phase 5 REST API and existing Postgres/Temporal backend. It does NOT implement pipeline/guardrail configuration (UI-04 → Phase 7), RBAC/Better Auth enforcement (GRD-04 → Phase 7), CLI (API-04 → v2), or direct LD/Prometheus calls.

SAFE-02 extends to dashboard: emergency abort must be reachable from the UI with clear confirmation.

</domain>

<decisions>
## Implementation Decisions

### Stack & App Shell
- **D-01:** Next.js 16 App Router in `apps/web` — replace current tsx shell with full Next.js app
- **D-02:** React 19 + TypeScript; match monorepo conventions (Biome, vitest where applicable)
- **D-03:** Tailwind CSS v4 + shadcn/ui for ops UI components (tables, badges, dialogs, buttons)
- **D-04:** TanStack Query v5 for client-side data fetching, cache, and polling on active runs
- **D-05:** Typed API client using `openapi-fetch` or fetch wrapper against `@ff-promo/contracts` response types

### API Integration
- **D-06:** Dashboard calls Phase 5 REST API (`/v1/promotion-runs/*`, `/v1/pipelines/:id`) — no Next.js Route Handler BFF in v1 unless needed for CORS
- **D-07:** Add `GET /v1/promotion-runs` list endpoint in API (deferred from Phase 5) — pagination optional; v1 can return recent runs with status filter
- **D-08:** Run detail page uses `GET /v1/promotion-runs/:id` including `gateForensics` when paused (SC-3 already in API)
- **D-09:** Control actions POST to existing API routes; optimistic UI optional, must reflect API errors (409 state conflicts)

### Pages & UX
- **D-10:** `/` or `/runs` — promotion runs list (active + historical) with status badge, flag key, pipeline, current stage/environment
- **D-11:** `/runs/[id]` — run detail: timeline/status, gate results table, forensics panel when paused, audit events, control action bar
- **D-12:** `/runs/new` — create pending run (pipeline picker + flag key) then navigate to detail to start
- **D-13:** Poll active/paused runs every 5–10s; static completed/aborted runs on mount only
- **D-14:** Destructive actions (abort) require confirmation dialog; pause/resume are reversible

### Auth (deferred enforcement)
- **D-15:** v1 auth = optional `API_KEY` forwarded as `X-API-Key` header from env (`NEXT_PUBLIC_*` not for secrets — use server components or route handler proxy if key must stay server-side)
- **D-16:** Actor metadata on control requests: `{ actorType: 'user', actorId: 'dashboard' }` or from env until Phase 7 RBAC

### Testing
- **D-17:** Component tests with Vitest + React Testing Library for key widgets (status badge, forensics panel, action buttons)
- **D-18:** Playwright or MSW-based integration tests for list/detail/control flows against mocked API (no testcontainers in web app)
- **D-19:** Add `web` vitest project in root vitest.config.ts

### Claude's Discretion
- Exact shadcn init command and component set
- Whether API list endpoint lives in 06-01 (web scaffold wave) or dedicated API mini-plan
- Recharts for metric sparklines vs table-only gate display in v1
- Server Actions vs client fetch for mutations
- Docker compose profile for web dev port

</decisions>

<canonical_refs>
## Canonical References

### Project & Requirements
- `.planning/PROJECT.md` — dual user model, pause-and-alert
- `.planning/REQUIREMENTS.md` — UI-01, UI-02, UI-03, SAFE-02
- `.planning/ROADMAP.md` — Phase 6 goal and success criteria

### Prior Phase Context
- `.planning/phases/05-rest-api/05-CONTEXT.md` — API routes, forensics, deferred list endpoint
- `.planning/phases/05-rest-api/05-04-SUMMARY.md` — delivered read/control routes
- `apps/api/src/routes/promotion-runs.ts` — REST surface
- `packages/contracts/src/api.ts` — response schemas

### Stack
- `CLAUDE.md` — Next.js 16, TanStack Query, shadcn/ui, Recharts

### Integration Points
- `apps/api/` — REST backend (may need list endpoint)
- `packages/contracts/` — shared Zod types for API client
- `apps/web/` — current shell to replace

</canonical_refs>

<deferred>
## Deferred Ideas

- UI-04 pipeline/guardrail configuration UI — Phase 7
- GRD-04 RBAC / Better Auth — Phase 7
- Real-time WebSocket updates — polling sufficient for v1
- CLI parity — separate app
- TELE-05 alerting integrations — future
- Embedded Prometheus charts — optional Recharts; table forensics is minimum for UI-02

</deferred>

---

*Phase: 06-operator-dashboard*
*Context gathered: 2026-06-22 via yolo defaults*
