# Phase 6: Operator Dashboard - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 32 new/modified files (Phase 6 scope)
**Analogs found:** 18 / 32
**Upstream context:** `06-CONTEXT.md` (D-01–D-19); no `06-RESEARCH.md` yet — API surface from Phase 5 deliverables.

## Recommended `apps/web` Layout

Phase 6 replaces the tsx shell with a Next.js 16 App Router dashboard that **calls the Phase 5 REST API only** — no Temporal, LaunchDarkly, Prometheus, or Prisma in the web app. Shared types come from `@ff-promo/contracts`; the API may gain `GET /v1/promotion-runs` (D-07) in a mini-plan or first web wave.

```
apps/web/
  package.json                          # MODIFY: next, react, tanstack-query, contracts, tailwind, shadcn
  next.config.ts                        # NEW: transpile workspace packages if needed
  tsconfig.json                         # MODIFY: Next.js plugin, jsx, paths
  postcss.config.mjs                    # NEW: Tailwind v4
  components.json                       # NEW: shadcn/ui init
  src/
    app/
      layout.tsx                        # NEW: root layout, fonts, QueryProvider, globals
      page.tsx                          # NEW: redirect → /runs
      globals.css                       # NEW: Tailwind v4 + shadcn CSS vars
      runs/
        page.tsx                        # NEW: runs list (UI-01)
        new/page.tsx                    # NEW: create pending run (UI-03)
        [id]/page.tsx                   # NEW: run detail + controls (UI-01/02/03, SAFE-02)
    components/
      providers/
        query-provider.tsx              # NEW: TanStack QueryClientProvider ('use client')
      ui/                               # NEW: shadcn primitives (button, badge, table, dialog, …)
      runs/
        run-status-badge.tsx            # NEW: status → color/badge mapping
        run-list-table.tsx              # NEW: list page table
        gate-forensics-panel.tsx        # NEW: paused-run forensics (UI-02)
        gate-results-table.tsx          # NEW: gate history table
        audit-events-list.tsx           # NEW: audit trail
        control-actions.tsx             # NEW: start/pause/resume/abort bar
        confirm-abort-dialog.tsx        # NEW: SAFE-02 confirmation
    lib/
      env.ts                            # NEW: NEXT_PUBLIC_API_URL, server API_KEY (Zod)
      api-client.ts                     # NEW: typed fetch wrapper → REST API
      api-errors.ts                     # NEW: parse API error JSON → typed errors
      actor.ts                          # NEW: dashboard actor constant for mutations
      query-keys.ts                     # NEW: TanStack Query key factory
    hooks/
      use-promotion-runs.ts             # NEW: list query + polling
      use-promotion-run.ts              # NEW: detail + gate/audit queries
      use-run-mutations.ts              # NEW: start/pause/resume/abort/create
    __tests__/
      helpers/
        mock-api.ts                     # NEW: MSW handlers or fetch mock fixtures
        render.tsx                      # NEW: wrap with QueryClientProvider
      run-status-badge.test.tsx         # NEW: component test
      gate-forensics-panel.test.tsx     # NEW: component test
      control-actions.test.tsx          # NEW: component test + 409 handling
vitest.config.ts                        # MODIFY: add `web` vitest project (jsdom)
apps/api/src/routes/promotion-runs.ts   # MODIFY (optional wave): GET /v1/promotion-runs
apps/api/src/services/promotion-run.service.ts  # MODIFY: listRuns()
packages/contracts/src/api.ts           # MODIFY: PromotionRunListResponseSchema
```

**REST surface the dashboard consumes:**

| Method | Path | Dashboard use | Contracts type |
|--------|------|---------------|----------------|
| `GET` | `/v1/promotion-runs` | Runs list (D-07 — add in API) | `PromotionRunResponse[]` (new list schema) |
| `GET` | `/v1/promotion-runs/:id` | Detail + forensics when paused | `PromotionRunStatusResponse` |
| `GET` | `/v1/promotion-runs/:id/gate-results` | Gate history table | `GateResultResponse[]` |
| `GET` | `/v1/promotion-runs/:id/audit-events` | Audit panel | `AuditEventResponse[]` |
| `GET` | `/v1/pipelines/:id` | Pipeline/stage labels on detail + new-run picker | inline route schema (extend contracts later) |
| `POST` | `/v1/promotion-runs` | Create pending run | `CreatePromotionRunRequest` → `PromotionRunResponse` |
| `POST` | `/v1/promotion-runs/:id/start` | Start control | `PromotionRunResponse` |
| `POST` | `/v1/promotion-runs/:id/pause` | Pause control | `{ promotionRunId, action }` |
| `POST` | `/v1/promotion-runs/:id/resume` | Resume control | same |
| `POST` | `/v1/promotion-runs/:id/abort` | Abort (SAFE-02) | same |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/package.json` | config | — | `apps/api/package.json` | partial |
| `apps/web/next.config.ts` | config | — | — | no analog |
| `apps/web/tsconfig.json` | config | — | `apps/api` + `tsconfig.base.json` | partial |
| `apps/web/src/app/layout.tsx` | component | request-response | — (greenfield Next.js) | no analog |
| `apps/web/src/app/runs/page.tsx` | component | request-response | `apps/api/src/routes/promotion-runs.ts` (inverse) | partial |
| `apps/web/src/app/runs/[id]/page.tsx` | component | request-response | `apps/api/src/__tests__/promotion-runs.read.test.ts` (assertions) | partial |
| `apps/web/src/app/runs/new/page.tsx` | component | CRUD | `apps/api/src/__tests__/promotion-runs.control.test.ts` (create) | partial |
| `apps/web/src/lib/api-client.ts` | service | request-response | `apps/api/src/routes/promotion-runs.ts` + telemetry mock client | role-match |
| `apps/web/src/lib/env.ts` | utility | transform | `apps/api/src/lib/env.ts` | exact |
| `apps/web/src/lib/api-errors.ts` | utility | transform | `apps/api/src/errors/api-error.ts` + `app.ts` error handler | exact |
| `apps/web/src/lib/actor.ts` | utility | transform | `packages/contracts/src/promotion-run.ts` | exact |
| `apps/web/src/components/providers/query-provider.tsx` | provider | pub-sub | — (greenfield TanStack Query) | no analog |
| `apps/web/src/components/runs/run-status-badge.tsx` | component | transform | `packages/contracts/src/promotion-run.ts` (`PromotionStatusSchema`) | partial |
| `apps/web/src/components/runs/gate-forensics-panel.tsx` | component | transform | `apps/api/src/lib/forensics.ts` + read test assertions | exact |
| `apps/web/src/components/runs/control-actions.tsx` | component | request-response | `apps/api/src/__tests__/promotion-runs.control.test.ts` | role-match |
| `apps/web/src/hooks/use-promotion-runs.ts` | hook | pub-sub | — (greenfield; mirror API read test polling intent) | no analog |
| `apps/web/src/hooks/use-run-mutations.ts` | hook | request-response | control route tests | role-match |
| `apps/api/src/routes/promotion-runs.ts` | route | CRUD | existing file + `packages/db` `findByStatus` | exact (extend) |
| `packages/contracts/src/api.ts` | model | transform | self | exact (extend) |
| `vitest.config.ts` | config | batch | self (`api` project) | exact (extend) |
| `apps/web/src/__tests__/helpers/render.tsx` | test | — | `apps/api/src/__tests__/helpers/mock-temporal.ts` (inject deps) | partial |
| `apps/web/src/__tests__/run-status-badge.test.tsx` | test | transform | `packages/telemetry/src/__tests__/evaluate-gate-policy.test.ts` | role-match |
| `apps/web/src/__tests__/control-actions.test.tsx` | test | request-response | `apps/api/src/__tests__/promotion-runs.control.test.ts` | role-match |

---

## Pattern Assignments

### `apps/web/src/lib/api-client.ts` (service, request-response)

**Analog:** `apps/api/src/routes/promotion-runs.ts` (endpoint map) + `packages/telemetry/src/__tests__/evaluate-gate-policy.test.ts` (injectable client mock)

**Contracts imports** — mirror API route imports (`promotion-runs.ts` lines 1-9):

```typescript
import type {
  AuditEventResponse,
  CreatePromotionRunRequest,
  ControlActionRequest,
  GateResultResponse,
  PromotionRunResponse,
  PromotionRunStatusResponse,
} from '@ff-promo/contracts';
```

**Typed fetch wrapper** — inverse of `app.inject()` tests; use `fetch` + Zod safeParse on success bodies:

```typescript
type ApiClientOptions = {
  baseUrl: string;
  apiKey?: string;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(
  options: ApiClientOptions,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (options.apiKey) {
    headers.set('X-API-Key', options.apiKey);
  }

  const response = await fetch(`${options.baseUrl}${path}`, {
    ...init,
    headers,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiClientError(
      body.message ?? `Request failed: ${response.status}`,
      response.status,
      body.error,
    );
  }

  return body as T;
}

export function createApiClient(options: ApiClientOptions) {
  return {
    listPromotionRuns: (status?: string) =>
      request<PromotionRunResponse[]>(
        options,
        status ? `/v1/promotion-runs?status=${status}` : '/v1/promotion-runs',
      ),
    getPromotionRun: (id: string) =>
      request<PromotionRunStatusResponse>(options, `/v1/promotion-runs/${id}`),
    listGateResults: (id: string) =>
      request<GateResultResponse[]>(options, `/v1/promotion-runs/${id}/gate-results`),
    listAuditEvents: (id: string) =>
      request<AuditEventResponse[]>(options, `/v1/promotion-runs/${id}/audit-events`),
    createPromotionRun: (body: CreatePromotionRunRequest) =>
      request<PromotionRunResponse>(options, '/v1/promotion-runs', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    startRun: (id: string, actor: CreatePromotionRunRequest['actor']) =>
      request<PromotionRunResponse>(options, `/v1/promotion-runs/${id}/start`, {
        method: 'POST',
        body: JSON.stringify({ actor }),
      }),
    pauseRun: (id: string, body: ControlActionRequest = {}) =>
      request(options, `/v1/promotion-runs/${id}/pause`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    resumeRun: (id: string, body: ControlActionRequest = {}) =>
      request(options, `/v1/promotion-runs/${id}/resume`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    abortRun: (id: string, body: ControlActionRequest = {}) =>
      request(options, `/v1/promotion-runs/${id}/abort`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  };
}
```

**Auth header** — copy API server expectation (`plugins/auth.ts` lines 6-17):

```typescript
const apiKey = request.headers['x-api-key'];
if (apiKey !== env.API_KEY) {
  throw unauthorized();
}
```

Dashboard sends the same `X-API-Key` header. Prefer **server-side** client factory reading `API_KEY` from env (not `NEXT_PUBLIC_*`) when key is required; expose only `NEXT_PUBLIC_API_URL` to the browser if calling API directly (D-15).

**Optional:** `openapi-fetch` once OpenAPI spec is exported from `@fastify/swagger` — v1 typed wrapper above is sufficient and matches monorepo style (no openapi-fetch in repo yet).

---

### `apps/web/src/lib/env.ts` (utility, transform)

**Analog:** `apps/api/src/lib/env.ts`

**Zod env parse at module boundary** (api env.ts lines 1-15):

```typescript
import { z } from 'zod';

const WebEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  API_KEY: z.string().optional(), // server-only; never NEXT_PUBLIC_
  DASHBOARD_ACTOR_ID: z.string().default('dashboard'),
});

export type WebEnv = z.infer<typeof WebEnvSchema>;

export function loadWebEnv(env: NodeJS.ProcessEnv = process.env): WebEnv {
  return WebEnvSchema.parse(env);
}
```

Fail fast in server components / route handlers; client components receive only `baseUrl` via props or public env.

---

### `apps/web/src/lib/api-errors.ts` (utility, transform)

**Analog:** `apps/api/src/app.ts` error handler (lines 49-65) + `errors/api-error.ts`

**API error JSON shape** (app.ts lines 50-54):

```typescript
if (error instanceof ApiError) {
  return reply.status(error.statusCode).send({
    error: error.code ?? 'api_error',
    message: error.message,
  });
}
```

**Dashboard parsing** — map 409 conflicts for control buttons (control test lines 191-204):

```typescript
export function isConflictError(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError && err.status === 409;
}

// In mutations: onError → toast with err.message; disable button if status makes action invalid
```

---

### `apps/web/src/lib/actor.ts` (utility, transform)

**Analog:** `packages/contracts/src/promotion-run.ts` + control test payloads

```typescript
import type { Actor } from '@ff-promo/contracts';

export const dashboardActor = (actorId = 'dashboard'): Actor => ({
  actorType: 'user',
  actorId,
});
```

Use on all `POST` mutations (D-16). Matches control test actor shape (`promotion-runs.control.test.ts` lines 93-97).

---

### `apps/web/src/components/providers/query-provider.tsx` (provider, pub-sub)

**Analog:** — (greenfield; STACK.md TanStack Query v5)

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5_000, retry: 1 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

Wrap in `layout.tsx` inside `<body>`. Poll active/paused runs per D-13:

```typescript
refetchInterval: (query) => {
  const status = query.state.data?.run.status;
  return status === 'active' || status === 'paused' ? 8_000 : false;
},
```

---

### `apps/web/src/app/layout.tsx` + page organization (component, request-response)

**Analog:** — (greenfield Next.js 16 App Router per CONTEXT D-01, D-10–D-12)

**App Router conventions for this phase:**

| Route | File | Pattern |
|-------|------|---------|
| `/` | `app/page.tsx` | `redirect('/runs')` — server component |
| `/runs` | `app/runs/page.tsx` | Client list or RSC shell + client table; TanStack Query |
| `/runs/new` | `app/runs/new/page.tsx` | Form → `createPromotionRun` → `router.push(/runs/${id})` |
| `/runs/[id]` | `app/runs/[id]/page.tsx` | Detail: status, forensics, gates, audit, `ControlActions` |

**Layout skeleton:**

```typescript
// app/layout.tsx — Server Component
import { QueryProvider } from '@/components/providers/query-provider';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

**Component boundaries (D-04, D-13):**

- `'use client'` on: tables with polling, control buttons, dialogs, anything using `useQuery` / `useMutation`
- Server Components: static chrome, optional initial redirect, server-side API client for secrets (if proxy pattern chosen)
- Colocate run UI under `components/runs/`; shadcn primitives under `components/ui/`
- Use `@/` path alias in `tsconfig.json` (`"@/*": ["./src/*"]`)

**Detail page data loading** — mirror read test expectations (`promotion-runs.read.test.ts` lines 103-117):

```typescript
// usePromotionRun(id) fetches GET /v1/promotion-runs/:id
// When body.run.status === 'paused', render GateForensicsPanel with body.gateForensics
// Parallel queries for gate-results + audit-events endpoints
```

---

### `apps/web/src/components/runs/run-status-badge.tsx` (component, transform)

**Analog:** `packages/contracts/src/promotion-run.ts` (`PromotionStatusSchema`)

```typescript
import type { PromotionStatus } from '@ff-promo/contracts';
import { Badge } from '@/components/ui/badge';

const STATUS_VARIANT: Record<PromotionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  active: 'default',
  paused: 'secondary',
  completed: 'default',
  aborted: 'destructive',
};

export function RunStatusBadge({ status }: { status: PromotionStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}
```

Import `PromotionStatus` from contracts — do not redefine status strings.

---

### `apps/web/src/components/runs/gate-forensics-panel.tsx` (component, transform)

**Analog:** `apps/api/src/lib/forensics.ts` + read test assertions

**Render contract** — consume `GateForensics` from `PromotionRunStatusResponse` (`api.ts` lines 45-51):

```typescript
import type { GateForensics } from '@ff-promo/contracts';

export function GateForensicsPanel({ forensics }: { forensics: GateForensics }) {
  if (!forensics.results.length) return null;
  return (
    <section>
      <h2>Gate forensics — {forensics.pauseReason}</h2>
      <p>
        Stage {forensics.stageIndex}: {forensics.displayName} ({forensics.environment})
      </p>
      {/* Table: metricType, verdict, threshold, treatmentValue, controlValue, observedDelta, reason */}
    </section>
  );
}
```

**Test fixtures** — copy shape from read test (`promotion-runs.read.test.ts` lines 111-116):

```typescript
expect(body.gateForensics?.pauseReason).toBe('threshold_exceeded');
expect(body.gateForensics?.results[0]?.reason).toBe('threshold_exceeded');
```

---

### `apps/web/src/components/runs/control-actions.tsx` (component, request-response)

**Analog:** `apps/api/src/__tests__/promotion-runs.control.test.ts`

**Action matrix from run.status:**

| Status | Actions |
|--------|---------|
| `pending` | Start |
| `active` | Pause, Abort (confirm) |
| `paused` | Resume, Abort (confirm) |
| `completed` / `aborted` | None (read-only) |

**Mutation pattern:**

```typescript
const pause = useMutation({
  mutationFn: () => api.pauseRun(runId, { actor: dashboardActor() }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.run(runId) }),
  onError: (err) => {
    if (isConflictError(err)) toast.error(err.message);
  },
});
```

Abort uses `ConfirmAbortDialog` (D-14, SAFE-02). Expect `409` on invalid transitions (control test lines 191-204) — show API message, do not optimistic-update status.

---

### `apps/api` list endpoint extension (route + service, CRUD)

**Analog:** `packages/db/src/repositories/promotion-run.repository.ts` `findByStatus` + existing GET routes

**Repository** (promotion-run.repository.ts lines 76-80):

```typescript
async findByStatus(status: PromotionStatus) {
  return this.db.promotionRun.findMany({
    where: { status },
  });
}
```

**Add** `listRecent(limit?: number)` with `orderBy: { updatedAt: 'desc' }` for dashboard list. Route follows existing GET pattern (`promotion-runs.ts` lines 107-116):

```typescript
app.get('/v1/promotion-runs', {
  schema: {
    querystring: z.object({ status: PromotionStatusSchema.optional() }),
    response: { 200: z.array(PromotionRunResponseSchema) },
  },
}, async (request) => service.listRuns(request.query));
```

Map rows with existing `mapPromotionRun` from `forensics.ts` (lines 103-115).

---

### `packages/contracts/src/api.ts` (model, transform)

**Analog:** self (exact — extend, do not duplicate)

**Reuse existing exports** (api.ts lines 16-100):

- `PromotionRunResponse`, `PromotionRunStatusResponse`, `GateForensics`, `GateForensicsResult`
- `GateResultResponse`, `AuditEventResponse`
- `CreatePromotionRunRequest`, `ControlActionRequest`
- `PromotionStatusSchema`, `ActorSchema` from `promotion-run.ts`

**Add for list endpoint:**

```typescript
export const PromotionRunListQuerySchema = z.object({
  status: PromotionStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
```

Export inferred types alongside schemas; barrel via `packages/contracts/src/index.ts`.

---

### `apps/web/package.json` (config)

**Analog:** `apps/api/package.json`

**Scripts pattern** (api package.json lines 6-10):

```json
{
  "scripts": {
    "build": "next build",
    "dev": "next dev --port 3001",
    "test": "pnpm -w exec vitest run --project web",
    "lint": "biome check src"
  },
  "dependencies": {
    "@ff-promo/contracts": "workspace:*",
    "@tanstack/react-query": "5.101.0",
    "next": "16.2.9",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@testing-library/react": "latest",
    "@testing-library/jest-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "jsdom": "latest",
    "typescript": "~5.8.3",
    "vitest": "4.1.9"
  }
}
```

Use Biome for lint (root `biome.json`: single quotes, 2-space indent, semicolons).

---

### `vitest.config.ts` (config, batch)

**Analog:** self — `api` project (lines 14-21)

**Add `web` project** — mirror api root/include; add jsdom + React plugin:

```typescript
{
  extends: true,
  test: {
    name: 'web',
    root: './apps/web',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
},
```

**Package test script:** `"test": "pnpm -w exec vitest run --project web"` (same as api).

**No testcontainers** in web (D-18) — mock API with MSW or `vi.stubGlobal('fetch', ...)`.

---

### `apps/web/src/__tests__/helpers/render.tsx` (test)

**Analog:** `apps/api/src/__tests__/helpers/mock-temporal.ts` (injectable deps) + `apps/api/src/__tests__/promotion-runs.read.test.ts` (harness lifecycle)

**Render helper:**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

export function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}
```

**Mock API client** — follow telemetry mock pattern (`evaluate-gate-policy.test.ts` lines 15-24):

```typescript
export function createMockApiClient(overrides: Partial<ReturnType<typeof createApiClient>> = {}) {
  return {
    getPromotionRun: vi.fn(),
    listPromotionRuns: vi.fn(),
    pauseRun: vi.fn(),
    ...overrides,
  };
}
```

**Component test structure** (telemetry test lines 1-3, 26-27):

```typescript
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './helpers/render';

describe('RunStatusBadge', () => {
  it('renders paused status', () => {
    renderWithProviders(<RunStatusBadge status="paused" />);
    expect(screen.getByText('paused')).toBeInTheDocument();
  });
});
```

**Control-actions test** — assert 409 surfaced to user (mirror `promotion-runs.control.test.ts` lines 191-204):

```typescript
pauseRun.mockRejectedValue(new ApiClientError('must be active', 409, 'conflict'));
// expect toast / error text visible; button remains enabled for retry
```

---

## Shared Patterns

### Contracts as single source of truth

**Source:** `packages/contracts/src/api.ts`, `promotion-run.ts`, `gate-result.ts`
**Apply to:** API client return types, component props, test fixtures

```typescript
import type { PromotionRunStatusResponse, PromotionStatus } from '@ff-promo/contracts';
import { PromotionStatusSchema } from '@ff-promo/contracts';
```

Never duplicate status enums or gate verdict strings in the web app.

### API error response handling

**Source:** `apps/api/src/app.ts` (lines 49-65)
**Apply to:** All `api-client` methods and mutation `onError`

```typescript
// Success: typed body
// 4xx/5xx: { error: string, message: string }
```

### Actor on mutations

**Source:** `packages/contracts/src/promotion-run.ts` + API control routes
**Apply to:** create, start, pause, resume, abort

```typescript
actor: { actorType: 'user', actorId: 'dashboard' }
```

### Polling vs static fetch

**Source:** CONTEXT D-13
**Apply to:** `usePromotionRuns`, `usePromotionRun`

- `active` | `paused` → `refetchInterval: 8000` (5–10s range)
- `completed` | `aborted` | `pending` (on detail after idle) → no interval

### Biome / TypeScript monorepo conventions

**Source:** `biome.json`, `tsconfig.base.json`, `apps/api`
**Apply to:** All web source files

- Single quotes, semicolons, 2-space indent
- `strict: true`, `noUncheckedIndexedAccess`
- Workspace dep: `"@ff-promo/contracts": "workspace:*"`
- Lint: `biome check src`

### Forensics display = API shape, not DB shape

**Source:** `apps/api/src/lib/forensics.ts`
**Apply to:** `GateForensicsPanel`, gate tables

Dashboard renders `GateForensics` from status response — do not parse raw `metadata` JSON like the API mapper does.

---

## Anti-Patterns to Avoid

| Anti-pattern | Why | Do instead |
|--------------|-----|------------|
| Import `@temporalio/client` or call Temporal from `apps/web` | Dashboard is presentation-only; orchestration lives in API/worker | `POST /v1/promotion-runs/:id/{pause,resume,abort}` |
| Import `launchdarkly-api` or `@ff-promo/ld-adapter` in web | Flag mutations go through promotion workflow, not UI | Show `flagKey` from API response only |
| Import `@ff-promo/telemetry` or query Prometheus from browser | Telemetry gates are evaluated in worker; forensics come from API | `GET /v1/promotion-runs/:id` → `gateForensics` |
| Import `@ff-promo/db` / Prisma in web | No direct DB access from dashboard | REST API only |
| `NEXT_PUBLIC_API_KEY` for secrets | Exposes key to browser bundle (D-15) | Server Component fetch, Route Handler proxy, or VPN-only dev without key |
| Next.js Route Handler BFF duplicating API logic (v1 default) | CONTEXT D-06: call API directly unless CORS blocks | `fetch(NEXT_PUBLIC_API_URL + '/v1/...')` with CORS on API if needed |
| Optimistic status updates on control actions without rollback | 409 conflicts on invalid transitions (Phase 5 tests) | Invalidate queries on success; show API error on failure |
| Redefining `PromotionStatus` or gate verdict enums locally | Drift from contracts | Import from `@ff-promo/contracts` |
| WebSocket / SSE for v1 | CONTEXT defers real-time | TanStack Query polling |
| testcontainers in `apps/web` | D-18 explicitly excludes | MSW or mocked `fetch` |

---

## No Analog Found

Files with no close match in the codebase (planner should use CONTEXT D-01–D-05 and STACK.md):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/next.config.ts` | config | — | No Next.js app in repo yet |
| `apps/web/src/app/**` | component | request-response | Greenfield App Router |
| `apps/web/src/components/ui/**` | component | — | shadcn/ui generated — follow shadcn init |
| `apps/web/src/components/providers/query-provider.tsx` | provider | pub-sub | No React Query usage in repo |
| `apps/web/src/hooks/*.ts` | hook | pub-sub | No custom hooks in repo |

**STACK.md reference for dashboard:**

- Next.js 16 App Router, React 19, TanStack Query 5.101.0
- shadcn/ui + Tailwind v4 for ops UI
- Recharts optional for sparklines (D-13 discretion); table forensics is minimum

---

## Phase 5 API Patterns to Reuse (Consumer Side)

| Phase 5 artifact | Phase 6 usage |
|------------------|---------------|
| `apps/api/src/routes/promotion-runs.ts` | Endpoint map for `api-client.ts` |
| `packages/contracts/src/api.ts` | All response/request types |
| `apps/api/src/lib/forensics.ts` | Shape of `gateForensics` UI |
| `apps/api/src/plugins/auth.ts` | `X-API-Key` header contract |
| `apps/api/src/__tests__/promotion-runs.read.test.ts` | Fixture data for forensics component tests |
| `apps/api/src/__tests__/promotion-runs.control.test.ts` | Control flow + 409 expectations for action tests |
| `apps/api/src/app.ts` error JSON | Client error parsing |

---

## Metadata

**Analog search scope:** `apps/web/`, `apps/api/src/`, `packages/contracts/src/`, `packages/db/src/repositories/`, `packages/telemetry/src/__tests__/`, `vitest.config.ts`, `biome.json`
**Files scanned:** ~35 source files
**Pattern extraction date:** 2026-06-22
