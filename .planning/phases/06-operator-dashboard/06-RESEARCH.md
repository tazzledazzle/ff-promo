# Phase 6: Operator Dashboard - Research

**Researched:** 2026-06-22
**Domain:** Next.js 16 App Router ops dashboard over Phase 5 Fastify REST API
**Confidence:** HIGH

## Summary

Phase 6 replaces the `apps/web` tsx placeholder with a full Next.js 16 operator dashboard that consumes the Phase 5 REST API. The API already exposes create/start/pause/resume/abort, single-run status with `gateForensics` when paused, gate history, audit events, and pipeline read-by-id — but **no list endpoints** for promotion runs (deferred in Phase 5) or pipelines (needed for `/runs/new` picker). The dashboard is a thin presentation layer: no direct LaunchDarkly/Prometheus calls, no Temporal client in the browser.

The primary work splits into three tracks: (1) **API gap closure** — add `GET /v1/promotion-runs` (and minimally `GET /v1/pipelines`) with Zod contracts and repository methods; (2) **Next.js scaffold** — App Router, Tailwind v4, shadcn/ui, TanStack Query v5 with status-aware polling; (3) **pages and controls** — `/runs` list, `/runs/[id]` detail with forensics/audit/control bar, `/runs/new` create flow, abort confirmation dialog (SAFE-02).

Auth in v1 is optional `API_KEY` on the API (`X-API-Key` header when `API_KEY` env is set) [VERIFIED: `apps/api/src/plugins/auth.ts`]. The dashboard must **never** put secrets in `NEXT_PUBLIC_*`. Recommended pattern: thin Next.js Route Handlers that proxy to the API and inject the server-side `API_KEY`, avoiding CORS complexity and secret exposure. Alternative (dev-only): register `@fastify/cors` on the API with `allowedHeaders` including `X-API-Key` when operators accept client-side key forwarding behind VPN.

**Primary recommendation:** Wave 0 scaffolds Next.js + vitest `web` project and adds list API endpoints; Wave 1 delivers API client + `/runs` list; Wave 2 delivers `/runs/[id]` with forensics and polling; Wave 3 delivers control actions + `/runs/new` + abort dialog; Wave 4 adds RTL/MSW tests and docker-compose web service.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Stack & App Shell
- **D-01:** Next.js 16 App Router in `apps/web` — replace current tsx shell with full Next.js app
- **D-02:** React 19 + TypeScript; match monorepo conventions (Biome, vitest where applicable)
- **D-03:** Tailwind CSS v4 + shadcn/ui for ops UI components (tables, badges, dialogs, buttons)
- **D-04:** TanStack Query v5 for client-side data fetching, cache, and polling on active runs
- **D-05:** Typed API client using `openapi-fetch` or fetch wrapper against `@ff-promo/contracts` response types

#### API Integration
- **D-06:** Dashboard calls Phase 5 REST API (`/v1/promotion-runs/*`, `/v1/pipelines/:id`) — no Next.js Route Handler BFF in v1 unless needed for CORS
- **D-07:** Add `GET /v1/promotion-runs` list endpoint in API (deferred from Phase 5) — pagination optional; v1 can return recent runs with status filter
- **D-08:** Run detail page uses `GET /v1/promotion-runs/:id` including `gateForensics` when paused (SC-3 already in API)
- **D-09:** Control actions POST to existing API routes; optimistic UI optional, must reflect API errors (409 state conflicts)

#### Pages & UX
- **D-10:** `/` or `/runs` — promotion runs list (active + historical) with status badge, flag key, pipeline, current stage/environment
- **D-11:** `/runs/[id]` — run detail: timeline/status, gate results table, forensics panel when paused, audit events, control action bar
- **D-12:** `/runs/new` — create pending run (pipeline picker + flag key) then navigate to detail to start
- **D-13:** Poll active/paused runs every 5–10s; static completed/aborted runs on mount only
- **D-14:** Destructive actions (abort) require confirmation dialog; pause/resume are reversible

#### Auth (deferred enforcement)
- **D-15:** v1 auth = optional `API_KEY` forwarded as `X-API-Key` header from env (`NEXT_PUBLIC_*` not for secrets — use server components or route handler proxy if key must stay server-side)
- **D-16:** Actor metadata on control requests: `{ actorType: 'user', actorId: 'dashboard' }` or from env until Phase 7 RBAC

#### Testing
- **D-17:** Component tests with Vitest + React Testing Library for key widgets (status badge, forensics panel, action buttons)
- **D-18:** Playwright or MSW-based integration tests for list/detail/control flows against mocked API (no testcontainers in web app)
- **D-19:** Add `web` vitest project in root vitest.config.ts

### Claude's Discretion
- Exact shadcn init command and component set
- Whether API list endpoint lives in 06-01 (web scaffold wave) or dedicated API mini-plan
- Recharts for metric sparklines vs table-only gate display in v1
- Server Actions vs client fetch for mutations
- Docker compose profile for web dev port

### Deferred Ideas (OUT OF SCOPE)
- UI-04 pipeline/guardrail configuration UI — Phase 7
- GRD-04 RBAC / Better Auth — Phase 7
- Real-time WebSocket updates — polling sufficient for v1
- CLI parity — separate app
- TELE-05 alerting integrations — future
- Embedded Prometheus charts — optional Recharts; table forensics is minimum for UI-02
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Operator can view active and historical promotion runs with current environment stage | `GET /v1/promotion-runs` list endpoint (D-07); list item joins pipeline stage for `currentStageIndex` → environment/displayName; `/runs` page with status badges and TanStack Query |
| UI-02 | Operator can view telemetry gate status (pass/fail, metric values) per promotion run | `GET /v1/promotion-runs/:id` `gateForensics` when paused + `GET .../gate-results` history table; forensics panel component on `/runs/[id]` |
| UI-03 | Operator can trigger promotion actions (start, pause, resume, abort) from dashboard | Existing POST control routes; `useMutation` + invalidate/refetch; action bar with state-gated buttons; `/runs/new` create + start flow |
| SAFE-02 | Operator can emergency-stop an in-flight promotion immediately via dashboard | `POST /v1/promotion-runs/:id/abort` with confirmation dialog (D-14); visible destructive styling; handle 409 for invalid state |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 16.2.9 App Router, React 19.2.7, TanStack Query 5.101.0, shadcn/ui + Tailwind CSS v4, Recharts 3.8.1 (optional), Vitest 4.1.9, pnpm monorepo [CITED: CLAUDE.md stack table]
- **Integration model:** Dashboard is a consumer of `apps/api` REST — must not call LaunchDarkly or Prometheus directly [CITED: CLAUDE.md]
- **Failure mode:** Pause-and-alert on gate breach; no auto-rollback in v1 [CITED: CLAUDE.md]
- **Auth note:** Better Auth deferred; API-key-only acceptable behind VPN until Phase 7 SSO [CITED: CLAUDE.md stack patterns]
- **Do not use:** Next.js API routes as **primary backend** (orchestration stays in Fastify); middleware-only auth for security-sensitive routes — verify auth in Route Handlers [CITED: CLAUDE.md What NOT to Use]
- **GSD workflow:** Plans execute via `/gsd-execute-phase`; research informs planner only

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Runs list & detail rendering | Browser / Client | Frontend Server (SSR prefetch optional) | Ops UI is interactive; polling lives in client components |
| API key injection | Frontend Server (Route Handlers) | — | Secrets stay server-side per D-15; proxy adds `X-API-Key` |
| Polling & cache | Browser / Client | — | TanStack Query `refetchInterval` on active/paused runs (D-13) |
| Control mutations (start/pause/resume/abort) | Browser / Client → API | Frontend Server proxy | POST to existing Fastify routes; invalidate queries on success |
| List runs / pipelines | API / Backend | Database | New `GET` endpoints query Postgres via repositories |
| Gate forensics display | Browser / Client | — | API already assembles forensics; UI maps `GateForensicsSchema` to table |
| Status badge / stage labels | Browser / Client | — | Pure presentation from `PromotionRunResponse` + pipeline stage metadata |
| RBAC / Better Auth | — (Phase 7) | Frontend Server | Out of scope; static actor metadata only (D-16) |
| CORS (if no proxy) | API / Backend | — | `@fastify/cors` with `allowedHeaders: ['Content-Type', 'X-API-Key']` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.9 | App Router, layouts, Route Handlers | Project stack; SSR for shell, client islands for polling [VERIFIED: npm registry] [CITED: CLAUDE.md] |
| `react` / `react-dom` | 19.2.7 | UI runtime | Pairs with Next.js 16 [VERIFIED: npm registry] |
| `@tanstack/react-query` | 5.101.0 | Fetch, cache, polling, mutations | Project stack; `refetchInterval` for active runs [VERIFIED: npm registry] [CITED: tanstack.com/query] |
| `tailwindcss` | 4.3.1 | Utility CSS | Project stack v4; CSS `@theme` config [VERIFIED: npm registry] |
| `@tailwindcss/postcss` | 4.3.1 | PostCSS integration | Required Tailwind v4 PostCSS plugin [VERIFIED: npm registry] [CITED: ui.shadcn.com/docs/tailwind-v4] |
| `shadcn` CLI | 4.11.0 | Component scaffolding | Official shadcn/ui init for Next.js + Tailwind v4 [CITED: ui.shadcn.com/docs/installation/next] |
| `@ff-promo/contracts` | workspace | Response/request Zod types | Shared with API; typed client without duplicate schemas |
| `openapi-fetch` | 0.17.0 | Optional typed HTTP client | Lightweight; pairs with generated OpenAPI types later [VERIFIED: npm registry] [CITED: openapi-ts.dev] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority`, `clsx`, `tailwind-merge` | latest | shadcn component utilities | shadcn init adds these |
| `lucide-react` | latest | Icons for action bar, status | shadcn default icon set |
| `@radix-ui/react-*` | via shadcn | Accessible primitives | Dialog (abort confirm), Table, Badge, Button |
| `recharts` | 3.8.1 | Metric sparklines | Optional discretion — table forensics is UI-02 minimum |
| `vitest` | 4.1.9 | Test runner | Add `web` project [VERIFIED: root package.json] |
| `@testing-library/react` | 16.3.2 | Component tests | D-17 widget tests |
| `@testing-library/jest-dom` | 6.9.1 | DOM matchers | RTL setup |
| `jsdom` | 29.1.1 | DOM environment | vitest web project |
| `msw` | 2.14.6 | API mocking | D-18 integration tests without live API |
| `@vitejs/plugin-react` | 6.0.2 | Vitest React transform | vitest config for `apps/web` |
| `@fastify/cors` | 11.2.0 | Browser CORS | Only if dashboard calls API directly without Route Handler proxy [VERIFIED: npm registry] [CITED: github.com/fastify/fastify-cors] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Typed fetch wrapper + `@ff-promo/contracts` | Full `openapi-typescript` codegen from `/documentation/json` | Codegen adds CI step; contracts already match API responses — wrapper is faster for v1 |
| Route Handler proxy | Direct browser → API + CORS | Proxy keeps `API_KEY` off client; CORS simpler for local dev without proxy |
| Recharts sparklines | Table-only gate display | Table satisfies UI-02; charts are discretion |
| Playwright E2E | MSW integration tests | MSW faster in CI; Playwright optional stretch |
| Server Actions for mutations | `useMutation` + fetch | Either works; mutations need error surfacing for 409 — client mutation + toast is standard for ops dashboards |

**Installation (apps/web — illustrative; exact versions pinned at init):**

```bash
pnpm --filter @ff-promo/web add next@16.2.9 react@19.2.7 react-dom@19.2.7 @tanstack/react-query@5.101.0 tailwindcss@4.3.1 @tailwindcss/postcss@4.3.1
pnpm --filter @ff-promo/web add -D vitest@4.1.9 @vitejs/plugin-react@6.0.2 @testing-library/react@16.3.2 @testing-library/jest-dom@6.9.1 jsdom@29.1.1 msw@2.14.6 typescript@~5.8.3
# shadcn components (after init):
pnpm dlx shadcn@latest init -t next
pnpm dlx shadcn@latest add table badge button dialog alert alert-dialog card skeleton tabs
```

## Package Legitimacy Audit

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `next` | npm | OK | Approved |
| `@tanstack/react-query` | npm | OK | Approved |
| `tailwindcss` | npm | OK | Approved |
| `openapi-fetch` | npm | OK | Approved |
| `recharts` | npm | OK | Approved |
| `@testing-library/react` | npm | OK | Approved |
| `msw` | npm | OK | Approved |
| `lucide-react` | npm | OK | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**Postinstall scripts:** `msw` has optional postinstall (network-free fallback) [VERIFIED: npm view]; no high-risk scripts on core packages.

## API Gaps (Phase 5 → Phase 6)

### Confirmed missing endpoints [VERIFIED: `apps/api/src/routes/promotion-runs.ts`, `pipelines.ts`]

| Endpoint | Required by | Current state | Recommendation |
|----------|-------------|---------------|----------------|
| `GET /v1/promotion-runs` | UI-01, D-07 | **Not implemented** | Add list route + `PromotionRunListItemSchema` in contracts; repo method `findRecent({ status?, limit? })` ordered by `updatedAt desc` |
| `GET /v1/pipelines` | D-12 pipeline picker | **Not implemented** (only `GET /v1/pipelines/:id`) | Add minimal list: `{ id, name, flagKey, stageCount }[]` from `PipelineRepository` new `findActive()` |
| `GET /v1/promotion-runs/:id` | UI-02, D-08 | ✅ Implemented | Returns `{ run, gateForensics?, liveWorkflowStatus? }` |
| Control POST routes | UI-03, SAFE-02 | ✅ Implemented | start/pause/resume/abort with 409 on invalid state |
| `GET .../gate-results`, `GET .../audit-events` | D-11 detail page | ✅ Implemented | Use on detail tabs/sections |

### List response shape (recommended)

Join pipeline stages server-side so the list page does not N+1 fetch pipelines:

```typescript
// packages/contracts/src/api.ts (add)
export const PromotionRunListItemSchema = z.object({
  id: z.string(),
  status: PromotionStatusSchema,
  flagKey: z.string(),
  pipelineId: z.string(),
  pipelineName: z.string().optional(),
  currentStageIndex: z.number().int(),
  currentEnvironment: z.string().optional(),
  currentStageDisplayName: z.string().optional(),
  pauseReason: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PromotionRunListResponseSchema = z.object({
  runs: z.array(PromotionRunListItemSchema),
});
```

Repository note: `PromotionRunRepository` has `findByStatus` only [VERIFIED: `packages/db/src/repositories/promotion-run.repository.ts`] — extend with `findRecent` including optional `where: { status: { in: [...] } }` and `take: 50` default.

### Existing API surface reference

| Method | Path | Dashboard use |
|--------|------|---------------|
| `POST` | `/v1/promotion-runs` | `/runs/new` create |
| `POST` | `/v1/promotion-runs/:id/start` | Detail "Start" button |
| `POST` | `/v1/promotion-runs/:id/pause` | Detail "Pause" |
| `POST` | `/v1/promotion-runs/:id/resume` | Detail "Resume" |
| `POST` | `/v1/promotion-runs/:id/abort` | Detail "Abort" (SAFE-02) |
| `GET` | `/v1/promotion-runs/:id` | Detail header + forensics |
| `GET` | `/v1/promotion-runs/:id/gate-results` | Gate history table |
| `GET` | `/v1/promotion-runs/:id/audit-events` | Audit timeline |
| `GET` | `/v1/pipelines/:id` | Stage timeline labels |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Operator Browser                                 │
│  /runs (list)   /runs/[id] (detail+controls)   /runs/new (create)   │
│       │                 │                              │             │
│       └──────── TanStack Query (poll 5–10s if active/paused) ───────┘
└───────────────────────────────┬─────────────────────────────────────┘
                                │ fetch (same-origin)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              apps/web — Next.js 16 Route Handlers (optional)         │
│         /api/ff-promo/*  proxy → inject X-API-Key from server env     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP (server-side or CORS)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    apps/api (Fastify 5) — Phase 5                     │
│   GET /v1/promotion-runs (NEW)   GET /v1/pipelines (NEW)            │
│   GET/POST /v1/promotion-runs/:id/*   GET /v1/pipelines/:id         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
     ┌────────────────┐                 ┌─────────────────┐
     │  PostgreSQL 16 │                 │ Temporal Server │
     └────────────────┘                 └─────────────────┘
```

### Recommended Project Structure

```
apps/web/
  next.config.ts
  postcss.config.mjs
  src/
    app/
      layout.tsx              # Root layout + Providers
      page.tsx                # redirect → /runs
      globals.css             # @import "tailwindcss" + @theme
      runs/
        page.tsx              # UI-01 list (client or RSC shell + client table)
        new/
          page.tsx            # D-12 create form
        [id]/
          page.tsx            # D-11 detail shell
          run-detail.tsx      # client: polling, actions, forensics
      api/
        ff-promo/
          [[...path]]/route.ts  # optional BFF proxy (recommended when API_KEY set)
    components/
      providers.tsx           # QueryClientProvider
      runs/
        run-status-badge.tsx
        runs-table.tsx
        gate-forensics-panel.tsx
        gate-results-table.tsx
        audit-events-list.tsx
        run-control-bar.tsx
        abort-confirm-dialog.tsx
    lib/
      query-client.ts         # getQueryClient singleton pattern
      api-client.ts           # typed fetch against contracts
      actors.ts               # dashboard actor constant
      polling.ts              # refetchInterval helper by status
    hooks/
      use-promotion-runs.ts
      use-promotion-run.ts
      use-run-mutations.ts
  src/__tests__/
    components/
      run-status-badge.test.tsx
      gate-forensics-panel.test.tsx
      run-control-bar.test.tsx
    mocks/
      handlers.ts             # MSW handlers mirroring API routes
    setup.ts
```

### Pattern 1: Next.js App Router + QueryClientProvider

**What:** Client-only `providers.tsx` wraps app in `QueryClientProvider`; use per-request client on server only if prefetching.
**When to use:** All pages with `useQuery` / `useMutation`.
**Example:**

```tsx
// Source: https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
```

[CITED: tanstack.com/query — Advanced SSR guide]

### Pattern 2: Status-Aware Polling (D-13)

**What:** `refetchInterval` as function of run status — poll active/paused every 5–10s; disable for terminal states.
**Example:**

```tsx
// apps/web/src/lib/polling.ts
import type { PromotionStatus } from '@ff-promo/contracts';

const TERMINAL: PromotionStatus[] = ['completed', 'aborted'];

export function runPollIntervalMs(status: PromotionStatus | undefined): number | false {
  if (!status || TERMINAL.includes(status)) return false;
  return 8_000; // 8s within D-13 5–10s range
}

// In usePromotionRun(runId):
useQuery({
  queryKey: ['promotion-run', runId],
  queryFn: () => api.getRunStatus(runId),
  refetchInterval: (query) => runPollIntervalMs(query.state.data?.run.status),
});
```

[CITED: tanstack.com/query — refetchInterval option]

### Pattern 3: Typed API Client (D-05)

**What:** Thin wrapper using `@ff-promo/contracts` types; centralize base URL and headers.
**When to use:** All data fetching; single place for error mapping.

```typescript
// apps/web/src/lib/api-client.ts
import type {
  PromotionRunStatusResponse,
  PromotionRunResponse,
  CreatePromotionRunRequest,
} from '@ff-promo/contracts';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiClientError(res.status, body.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listRuns: (status?: string) =>
    apiFetch<{ runs: PromotionRunListItem[] }>(
      status ? `/v1/promotion-runs?status=${status}` : '/v1/promotion-runs',
    ),
  getRunStatus: (id: string) =>
    apiFetch<PromotionRunStatusResponse>(`/v1/promotion-runs/${id}`),
  createRun: (body: CreatePromotionRunRequest) =>
    apiFetch<PromotionRunResponse>('/v1/promotion-runs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  // start, pause, resume, abort — POST with actor body
};
```

OpenAPI codegen (`openapi-fetch` + `openapi-typescript`) can replace hand wrapper when `/documentation/json` artifact is checked in — not blocking for v1.

### Pattern 4: Route Handler BFF Proxy (Auth D-15)

**What:** Catch-all Route Handler forwards to `API_URL`, injects `X-API-Key` from server `API_KEY` env.
**When to use:** Whenever `API_KEY` is set in production; satisfies D-15 without `NEXT_PUBLIC` secrets.

```typescript
// apps/web/src/app/api/ff-promo/[[...path]]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

async function proxy(request: NextRequest, path: string[]) {
  const url = `${API_URL}/${path.join('/')}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete('host');
  if (process.env.API_KEY) headers.set('X-API-Key', process.env.API_KEY);

  const res = await fetch(url, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : undefined,
  });
  return new NextResponse(res.body, { status: res.status, headers: res.headers });
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) =>
  ctx.params.then(({ path = [] }) => proxy(req, path));
// POST, etc. similarly
```

Set `NEXT_PUBLIC_API_URL=/api/ff-promo` so browser always hits same-origin proxy.

**Alternative (direct API):** Register on Fastify:

```typescript
// apps/api — only if not using BFF
import cors from '@fastify/cors';
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
  allowedHeaders: ['Content-Type', 'X-API-Key'],
  methods: ['GET', 'POST', 'OPTIONS'],
});
```

[CITED: github.com/fastify/fastify-cors — allowedHeaders]

### Pattern 5: Control Mutations with 409 Handling (D-09)

```tsx
const startMutation = useMutation({
  mutationFn: () => api.startRun(runId, dashboardActor),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotion-run', runId] }),
  onError: (err: ApiClientError) => {
    if (err.status === 409) toast.error(err.message); // state conflict — no optimistic override
  },
});
```

Actor constant per D-16:

```typescript
export const dashboardActor = {
  actorType: 'user' as const,
  actorId: process.env.NEXT_PUBLIC_DASHBOARD_ACTOR_ID ?? 'dashboard',
};
```

### Page Architecture

| Route | Requirement | Data sources | Key components |
|-------|-------------|--------------|----------------|
| `/` → `/runs` | UI-01 | `GET /v1/promotion-runs` | `RunsTable`, `RunStatusBadge`, link to detail |
| `/runs/[id]` | UI-01, UI-02, UI-03, SAFE-02 | `GET .../:id`, `.../gate-results`, `.../audit-events`, `GET /v1/pipelines/:id` | `RunControlBar`, `GateForensicsPanel`, `GateResultsTable`, `AuditEventsList`, `AbortConfirmDialog` |
| `/runs/new` | UI-03 (create) | `GET /v1/pipelines`, `POST /v1/promotion-runs` | Pipeline select, flag key input → redirect to `/runs/[id]` |

**Run detail layout (D-11):**
1. Header: flag key, status badge, pipeline name, current stage/environment (from `run.currentStageIndex` + pipeline stages).
2. Control bar: Start (pending), Pause/Resume (active/paused), Abort (active/paused) — disabled with tooltip when invalid.
3. Forensics panel: visible when `gateForensics` present (paused + gate fail); table of `results[]` with metricType, verdict, threshold, observedValue, treatment/control/delta.
4. Gate results tab: full history from `/gate-results`.
5. Audit tab: chronological events from `/audit-events`.

**Status badge colors (shadcn Badge variants):**
- `pending` → secondary
- `active` → default/green
- `paused` → destructive or amber (gate hold)
- `completed` → outline
- `aborted` → destructive

### Anti-Patterns to Avoid

- **`NEXT_PUBLIC_API_KEY`:** Exposes secret to every browser user — use Route Handler proxy [D-15].
- **Polling terminal runs:** Wastes API calls; use `refetchInterval: false` for completed/aborted.
- **Optimistic status on 409:** API is source of truth for workflow state — show error, refetch.
- **Client-side Temporal:** Never import `@temporalio/client` in web app.
- **N+1 pipeline fetches on list:** Join stage metadata in list endpoint response.
- **Middleware-only auth for control routes:** Verify in Route Handler if adding dashboard auth later [CITED: CLAUDE.md].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible dialog/table/button | Custom modal markup | shadcn/ui (Radix primitives) | Focus trap, ARIA, keyboard nav |
| Polling timers | `setInterval` + manual fetch | TanStack Query `refetchInterval` | Cache dedup, background refetch, cancellation |
| CSS design tokens | Ad-hoc hex colors | Tailwind v4 `@theme` + shadcn CSS variables | Consistent ops UI; dark mode ready |
| API response typing | Duplicate interfaces | `@ff-promo/contracts` types | Single source of truth with API |
| HTTP mock server | Custom fetch stubs | MSW 2.x | Realistic request matching for flows |
| Gate forensics assembly | Re-query Prometheus | Use API `gateForensics` blob | Telemetry stays in worker |

## Common Pitfalls

### Pitfall 1: CORS Preflight Blocks `X-API-Key`

**What goes wrong:** Browser OPTIONS fails; dashboard shows network errors on all requests.
**Why it happens:** API has no `@fastify/cors`; custom header triggers preflight.
**How to avoid:** Use same-origin Route Handler proxy, or register CORS with `allowedHeaders: ['Content-Type', 'X-API-Key']`.
**Warning signs:** Console "Request header field X-API-Key is not allowed".

### Pitfall 2: Replacing tsx Shell Without Monorepo Wiring

**What goes wrong:** `pnpm dev` still runs old `tsx watch src/index.ts`; turbo doesn't start Next.
**Why it happens:** `apps/web/package.json` scripts still point to placeholder.
**How to avoid:** Update scripts to `next dev -p 3001`, add `web` to turbo; document in README.
**Warning signs:** Console logs "Phase 6 shell" instead of Next.js.

### Pitfall 3: Query Key Collisions / Stale Detail After Mutation

**What goes wrong:** List shows old status after abort on detail page.
**Why it happens:** Mutations invalidate only detail query, not list.
**How to avoid:** `onSuccess` invalidate both `['promotion-runs']` and `['promotion-run', id]`.
**Warning signs:** UI-03 manual test — abort succeeds but list still shows "active" until hard refresh.

### Pitfall 4: Forensics Panel on Manual Pause

**What goes wrong:** Empty forensics panel confuses operators.
**Why it happens:** `gateForensics` only populated for gate-fail pauses; manual pause may have empty `results[]`.
**How to avoid:** Show `pauseReason` + message "No gate failures" when `results` empty; distinguish via audit `run_paused` actor.
**Warning signs:** UI-02 false negative — panel renders but looks broken.

### Pitfall 5: Abort on Pending Run

**What goes wrong:** 409 from API — "must be started before abort".
**Why it happens:** API rejects abort on `pending` [VERIFIED: `promotion-run.service.ts`].
**How to avoid:** Hide/disable Abort when `status === 'pending'`; only show Start.
**Warning signs:** SAFE-02 dashboard test fails on freshly created run.

### Pitfall 6: shadcn + Tailwind v4 Config Drift

**What goes wrong:** Components unstyled; purge removes classes.
**Why it happens:** Leftover `tailwind.config.ts` or wrong `components.json` `"config": ""`.
**How to avoid:** Follow shadcn Tailwind v4 guide — empty config string, `@import "tailwindcss"` in `globals.css`.
**Warning signs:** Raw HTML buttons with no spacing.

## Code Examples

### shadcn Init (Next.js monorepo)

```bash
# Source: https://ui.shadcn.com/docs/installation/next
cd apps/web
pnpm dlx shadcn@latest init -t next
# components.json: "tailwind": { "config": "", "css": "src/app/globals.css" }
pnpm dlx shadcn@latest add table badge button dialog card alert-dialog skeleton
```

[CITED: ui.shadcn.com/docs/installation/next, ui.shadcn.com/docs/tailwind-v4]

### MSW Handler for Run Detail

```typescript
// apps/web/src/__tests__/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/ff-promo/v1/promotion-runs/:id', ({ params }) =>
    HttpResponse.json({
      run: {
        id: params.id,
        status: 'paused',
        flagKey: 'demo-feature-flag',
        pipelineId: 'pipe-1',
        currentStageIndex: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      gateForensics: {
        pauseReason: 'Gate error_rate failed',
        stageIndex: 1,
        environment: 'staging',
        displayName: 'Staging',
        results: [{
          gateResultId: 'gr-1',
          metricType: 'error_rate',
          verdict: 'fail',
          threshold: 0.01,
          observedValue: 0.05,
          evaluatedAt: new Date().toISOString(),
          stageId: 's-1',
          stageIndex: 1,
          environment: 'staging',
          displayName: 'Staging',
        }],
      },
    }),
  ),
];
```

### RTL Test — Abort Button Opens Dialog

```tsx
// apps/web/src/__tests__/components/abort-confirm-dialog.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbortConfirmDialog } from '@/components/runs/abort-confirm-dialog';

it('requires confirmation before calling onConfirm', async () => {
  const onConfirm = vi.fn();
  render(<AbortConfirmDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);
  await userEvent.click(screen.getByRole('button', { name: /abort promotion/i }));
  expect(onConfirm).toHaveBeenCalledOnce();
});
```

## Recommended Plan Wave Breakdown

Four plans in four waves — API list endpoint in Wave 0 alongside scaffold (planner discretion per D-07 note).

### Wave 0 — Scaffold + API Lists

**06-01-PLAN.md — Next.js app shell + vitest `web` project + list endpoints**
- Replace `apps/web` tsx placeholder with Next.js 16 App Router (`next dev -p 3001`)
- Tailwind v4 + shadcn init; root layout + `Providers`
- Add `web` vitest project to `vitest.config.ts` (D-19)
- **API (same plan or 06-01b):** `GET /v1/promotion-runs`, `GET /v1/pipelines` + contracts + repo methods + API tests
- Env: `API_URL`, `NEXT_PUBLIC_API_URL=/api/ff-promo`, optional Route Handler proxy stub
- Smoke: `next build` + `vitest run --project web` (empty pass) + `vitest run --project api -t list`

### Wave 1 — Runs List (UI-01)

**06-02-PLAN.md — API client + `/runs` page**
- `lib/api-client.ts`, query hooks `usePromotionRuns`
- `RunsTable` with status badge, flag key, pipeline, environment column
- Redirect `/` → `/runs`
- List poll: optional 30s refresh or manual refresh button (terminal runs static)
- Maps to **UI-01**

### Wave 2 — Run Detail + Forensics (UI-02)

**06-03-PLAN.md — `/runs/[id]` detail view**
- `usePromotionRun` with status-aware polling (D-13)
- `GateForensicsPanel`, `GateResultsTable`, `AuditEventsList`
- Fetch pipeline for stage timeline labels
- Maps to **UI-02**

### Wave 3 — Controls + Create + Abort (UI-03, SAFE-02)

**06-04-PLAN.md — Control bar, create flow, tests**
- `RunControlBar` with state-gated actions; `useRunMutations`
- `AbortConfirmDialog` destructive confirm (D-14)
- `/runs/new` pipeline picker + create → navigate → start
- MSW integration test: list → detail → pause; RTL widget tests (D-17, D-18)
- Docker compose optional `web` service on 3001
- Maps to **UI-03**, **SAFE-02**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tsx console shell in `apps/web` | Next.js 16 App Router | Phase 6 | Full dashboard surface |
| Phase 5 single-run GET only | List endpoints in Phase 6 | Deferred per 05-RESEARCH | UI-01 unblocked |
| Manual refresh for ops tables | TanStack Query polling | 2025–2026 standard | Active run monitoring |
| Tailwind v3 `tailwind.config.ts` | Tailwind v4 CSS `@theme` | shadcn v4 (2025) | Simpler token setup |

**Deprecated/outdated:**
- `apps/web/src/index.ts` console placeholder — delete after Next init
- shadcn `default` style — new projects use `new-york` per shadcn docs

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Route Handler BFF proxy is default auth path when `API_KEY` set | Auth patterns | Low — D-06 allows BFF when needed; direct+CORS remains valid for dev |
| A2 | `GET /v1/pipelines` list needed for pipeline picker | API Gaps | Medium — could hardcode seed pipeline ID via env for v1-only demo |
| A3 | Web dev port `3001`, API stays `3000` | Environment | Low — configurable via env |
| A4 | Table-only gate display satisfies UI-02 without Recharts | Standard Stack | Low — Recharts remains discretion stretch |
| A5 | Hand-rolled typed fetch wrapper acceptable vs openapi-typescript in v1 | Pattern 3 | Low — can migrate when OpenAPI artifact exported |

## Open Questions

1. **List endpoint in 06-01 vs separate API mini-plan?**
   - What we know: D-07 locked; planner discretion on packaging.
   - Recommendation: Same Wave 0 plan as scaffold — list endpoint is small and blocks UI-01.

2. **Recharts in v1?**
   - What we know: UI-02 minimum is table forensics; deferred ideas say optional.
   - Recommendation: Skip Recharts in initial plans; add stretch task if time permits.

3. **Pipeline list vs single seed pipeline for `/runs/new`?**
   - What we know: Seed creates one `default-promotion` pipeline [VERIFIED: `packages/db/src/seed.ts`].
   - Recommendation: Implement `GET /v1/pipelines` — low cost, future-proofs Phase 7 config UI.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | ✓ | v25.9.0 (≥24) | — |
| pnpm | Monorepo | ✓ | 10.33.0 | — |
| Phase 5 API | All dashboard data | ✓ (code exists) | Fastify 5.8.5 | — |
| PostgreSQL | API list/detail | ✓ (docker compose) | 16-alpine | — |
| ctx7 CLI | Doc lookup | ✗ | — | WebFetch + official docs used |
| slopcheck | Package audit | ✓ | 0.6.1 | Manual npm view |

**Missing dependencies with no fallback:**
- None for local dev if API + Postgres running.

**Missing dependencies with fallback:**
- Live Temporal — dashboard only needs API; worker can be down for read-only list/detail of historical runs.

**New env vars for web (add to `.env.example`):**

| Variable | Purpose |
|----------|---------|
| `API_URL` | Server-side proxy target (default `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | Browser fetch base (default `/api/ff-promo`) |
| `API_KEY` | Shared with API; injected by Route Handler only |
| `NEXT_PUBLIC_DASHBOARD_ACTOR_ID` | Optional actor id override (D-16) |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` (add `web` project — Wave 0 gap) |
| Quick run command | `pnpm exec vitest run --project web` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Runs list renders rows | integration (MSW) | `vitest run --project web -t "runs list"` | ❌ Wave 1 |
| UI-01 | Status badge shows environment | unit (RTL) | `vitest run --project web -t "RunStatusBadge"` | ❌ Wave 1 |
| UI-02 | Forensics panel shows fail metrics | unit (RTL) | `vitest run --project web -t "GateForensicsPanel"` | ❌ Wave 2 |
| UI-02 | Gate results table renders | unit (RTL) | `vitest run --project web -t "GateResultsTable"` | ❌ Wave 2 |
| UI-03 | Start button calls API | integration (MSW) | `vitest run --project web -t "start run"` | ❌ Wave 3 |
| UI-03 | Pause/resume mutations | integration (MSW) | `vitest run --project web -t "pause resume"` | ❌ Wave 3 |
| SAFE-02 | Abort requires confirmation | unit (RTL) | `vitest run --project web -t "AbortConfirm"` | ❌ Wave 3 |
| SAFE-02 | Abort POST on confirm | integration (MSW) | `vitest run --project web -t "abort run"` | ❌ Wave 3 |
| D-07 | List API returns runs | integration | `vitest run --project api -t "lists promotion runs"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm exec vitest run --project web`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — add `web` project with `environment: 'jsdom'`, `@vitejs/plugin-react`
- [ ] `apps/web/` — Next.js scaffold (currently tsx placeholder only)
- [ ] `apps/web/src/__tests__/setup.ts` — RTL + jest-dom + MSW server
- [ ] `GET /v1/promotion-runs` + `GET /v1/pipelines` — API routes + contracts
- [ ] `packages/db` — `PromotionRunRepository.findRecent`, `PipelineRepository.findActive`
- [ ] Route Handler proxy or `@fastify/cors` decision implemented

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial (optional API key) | Server-side `API_KEY` via Route Handler; no client exposure |
| V3 Session Management | No | N/A until Phase 7 Better Auth |
| V4 Access Control | Deferred (Phase 7) | Static dashboard actor metadata only |
| V5 Input Validation | Yes | API validates via Zod; form validation on create (required fields) |
| V6 Cryptography | No | No crypto in dashboard v1 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key in browser bundle | Info Disclosure | Route Handler proxy; never `NEXT_PUBLIC_API_KEY` |
| CSRF on mutations | Tampering | Same-origin proxy; Phase 7 can add CSRF tokens with sessions |
| XSS in forensics `reason` text | Tampering | React escapes by default; avoid `dangerouslySetInnerHTML` |
| Unauthorized abort | Elevation | API `API_KEY` gate when configured; Phase 7 RBAC |
| CORS misconfiguration | Info Disclosure | Restrict `origin` to dashboard URL; avoid `origin: true` in prod |

## Sources

### Primary (HIGH confidence)

- Codebase: `apps/api/src/routes/promotion-runs.ts`, `apps/api/src/plugins/auth.ts`, `packages/contracts/src/api.ts`, `packages/db/src/repositories/promotion-run.repository.ts`, `apps/web/package.json`
- [tanstack.com/query — Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) — QueryClientProvider, getQueryClient pattern
- [ui.shadcn.com/docs/installation/next](https://ui.shadcn.com/docs/installation/next) — Next.js + shadcn init
- [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — Tailwind v4 + empty config
- [openapi-ts.dev/openapi-fetch](https://openapi-ts.dev/openapi-fetch/) — typed client pattern
- [github.com/fastify/fastify-cors](https://github.com/fastify/fastify-cors/) — allowedHeaders for X-API-Key

### Secondary (MEDIUM confidence)

- npm registry version verification (2026-06-22): next 16.2.9, @tanstack/react-query 5.101.0, tailwindcss 4.3.1, etc.
- slopcheck OK for all recommended packages

### Tertiary (LOW confidence)

- Exact Next.js 16 + monorepo `transpilePackages` for `@ff-promo/contracts` — verify during scaffold spike

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pinned in CLAUDE.md, npm verified, official shadcn/TanStack docs
- Architecture: HIGH — maps directly to existing API contracts and routes; clear API gaps identified
- Pitfalls: HIGH-MEDIUM — CORS/auth pattern well-documented; monorepo Next wiring needs spike validation

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (30 days — stable stack)
