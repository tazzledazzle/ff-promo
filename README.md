# Feature Flag Promotion System (ff-promo)

Production-grade orchestration for feature flag promotion across environments (dev → staging → prod) with telemetry-gated progression. Phase 1 establishes persistence, audit infrastructure, and a Temporal workflow skeleton. Phase 2 adds the LaunchDarkly REST adapter. Phase 3 adds the Prometheus telemetry adapter.

## Prerequisites

- **Node.js** 24+ (Active LTS)
- **pnpm** 10+
- **Docker** — for PostgreSQL, Temporal dev server, and integration tests (testcontainers)

## Quick Start

1. **Copy environment variables**

   ```bash
   cp .env.example .env
   ```

2. **Start local infrastructure**

   ```bash
   docker compose up -d
   ```

   Starts PostgreSQL (`localhost:5432`) and Temporal dev server (`localhost:7233`, UI at `localhost:8233`).

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Run database migrations**

   ```bash
   cd packages/db
   pnpm exec prisma migrate deploy
   ```

   For a fresh database during development, use `pnpm exec prisma migrate dev` instead. **Note:** Prisma 7 does not auto-seed on `migrate reset` — run the seed step explicitly after migrations.

5. **Seed demo data**

   ```bash
   pnpm exec prisma db seed
   # or: pnpm db:seed
   ```

   Creates the `default-promotion` pipeline (dev → staging → prod) with gate policies and one pending promotion run for local demo.

6. **Run tests**

   ```bash
   cd ../..
   pnpm turbo run test
   ```

## Worker (Temporal)

Start the promotion workflow worker (requires Temporal from docker compose):

```bash
cd apps/worker
pnpm dev
```

The worker connects to Temporal at `TEMPORAL_ADDRESS` (default `localhost:7233`) and uses Postgres via `DATABASE_URL`.

## v2 Kotlin Backend (Phase 8+)

The repo is a **hybrid monorepo**: TypeScript v1 lives in `apps/*` and `packages/*`; Kotlin v2 lives in [`kotlin/`](kotlin/README.md) (`contracts`, `db`, `worker`, **`ld-adapter`**). TypeScript remains the reference implementation until Phase 14 cutover.

**Quick start (Kotlin stack):**

```bash
pnpm run build:kotlin
docker compose --profile kotlin up -d   # postgres + temporal + kotlin-worker
```

Use database `ffpromo_kotlin` for Flyway-only Kotlin dev (see [`kotlin/README.md`](kotlin/README.md)). The default `ffpromo` database stays on Prisma for TypeScript v1.

```bash
pnpm run test:kotlin   # Gradle tests (db tests need Docker)
```

## Test Shortcuts

Run only database integration tests (requires Docker for testcontainers):

```bash
pnpm exec vitest run --project db
```

Skip testcontainers and use an existing Postgres instance:

```bash
SKIP_TESTCONTAINERS=1 DATABASE_URL=postgresql://ffpromo:ffpromo@localhost:5432/ffpromo pnpm exec vitest run --project db
```

Run worker workflow tests:

```bash
pnpm exec vitest run --project worker
```

Run LaunchDarkly adapter tests (uses nock — no live LD account required):

```bash
pnpm exec vitest run --project ld-adapter
```

Run telemetry adapter tests (uses nock — no live Prometheus required):

```bash
pnpm exec vitest run --project telemetry
```

## LaunchDarkly Adapter (`@ff-promo/ld-adapter`)

Phase 2 package for reading flag state and applying semantic-patch targeting writes.

| Variable | Purpose |
|----------|---------|
| `LD_ACCESS_TOKEN` | LaunchDarkly personal or service access token |
| `LD_BASE_URL` | API base URL (`https://app.launchdarkly.com`; use `https://app.eu.launchdarkly.com` for EU) |
| `LD_API_VERSION` | REST API version header (default `20240415`) |
| `LD_PROJECT_KEY` | Default project key for local scripts |

CI tests mock HTTP with **nock** — no live LaunchDarkly credentials required.

## Telemetry Adapter (`@ff-promo/telemetry`)

Phase 3 package for SLO gate evaluation and pre-flight health checks against Prometheus.

| Variable | Purpose |
|----------|---------|
| `PROMETHEUS_BASE_URL` | Prometheus server base URL (default `http://localhost:9090`) |
| `PROMETHEUS_BEARER_TOKEN` | Optional bearer token for authenticated Prometheus |

CI tests mock HTTP with **nock** — no live Prometheus required.

**Metric label contract** (instrumented apps must expose):

- `service`, `ld_flag_key`, `ld_variation_id`, `ld_context_kind=user`
- `http_requests_total` with `status` label for error-rate gates
- `http_request_duration_seconds_bucket` for latency p95 gates

Optional manual validation with a local Prometheus:

```bash
docker compose --profile prometheus up -d
```

## Promotion Engine (Phase 4)

The Temporal worker orchestrates promotion runs: pre-flight checks, LaunchDarkly targeting per stage, and telemetry gate evaluation.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL for run state, gate results, audit trail |
| `TEMPORAL_ADDRESS` | Temporal server gRPC address |
| `TEMPORAL_TASK_QUEUE` | Worker task queue (default `promotion`) |
| `LD_ACCESS_TOKEN` | LaunchDarkly token for stage targeting activities |
| `LD_BASE_URL` | LaunchDarkly API base URL |
| `PROMETHEUS_BASE_URL` | Prometheus URL for gate evaluation |

**Start a pending promotion run** (CLI or REST API):

```bash
# REST API (Phase 5)
pnpm --filter @ff-promo/api dev
curl -X POST http://localhost:3000/v1/promotion-runs/:id/start \
  -H 'Content-Type: application/json' \
  -d '{"actor":{"actorType":"user","actorId":"you"}}'

# Worker helper (same promotion-control package)
pnpm --filter @ff-promo/worker start-run <promotionRunId>
```

**Worker tests** (CI uses nock — no live LD or Prometheus required):

```bash
pnpm exec vitest run --project worker
```

Per-stage flow: `runPreflight` (once) → `applyStageTargeting` → `evaluateGate` → advance index on pass; gate fail pauses with `pauseReason`; `abortSignal` stops immediately.

## REST API (Phase 5)

Fastify REST API for promotion run control and read endpoints under `/v1/promotion-runs`.

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP listen port (default `3000`) |
| `DATABASE_URL` | PostgreSQL for run state, gate results, audit trail |
| `TEMPORAL_ADDRESS` | Temporal server gRPC address |
| `TEMPORAL_TASK_QUEUE` | Worker task queue (default `promotion`) |
| `API_KEY` | Optional `X-API-Key` for authenticated requests |

**Run the API:**

```bash
pnpm --filter @ff-promo/api dev
```

**OpenAPI docs:** `http://localhost:3000/documentation`

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/promotion-runs` | Create pending run (API-01) |
| `POST /v1/promotion-runs/:id/start` | Start workflow |
| `POST /v1/promotion-runs/:id/pause` | Pause active run |
| `POST /v1/promotion-runs/:id/resume` | Resume paused run |
| `POST /v1/promotion-runs/:id/abort` | Abort in-flight run (SAFE-02) |
| `GET /v1/promotion-runs/:id` | Status + gate forensics when paused (API-02, SC-3) |
| `GET /v1/promotion-runs/:id/gate-results` | Gate evaluation history |
| `GET /v1/promotion-runs/:id/audit-events` | Audit trail |
| `GET /v1/pipelines/:id` | Pipeline definition read |

**API tests** (integration tests use testcontainers PostgreSQL; Temporal client mocked):

```bash
pnpm exec vitest run --project api
```

## Operator Dashboard (Phase 6)

Next.js dashboard for operators to list promotion runs, inspect gate forensics, and control promotions (start, pause, resume, abort with confirmation).

**Run the dashboard** (requires API on port 3000):

```bash
pnpm --filter @ff-promo/api dev
pnpm --filter @ff-promo/web dev
```

Open `http://localhost:3001`. Root `/` redirects to `/runs`.

| Page | Purpose |
|------|---------|
| `/runs` | Active and historical promotion runs (UI-01) |
| `/runs/new` | Create a pending run with pipeline picker (D-12) |
| `/runs/[id]` | Run detail, gate forensics, audit trail, controls (UI-02, UI-03) |

**BFF proxy:** Browser requests go to `/api/ff-promo/*` (Next.js Route Handler), which forwards to the Fastify API using server-side `API_URL` and `API_KEY`. The API key never ships to the client bundle.

| Variable | Purpose |
|----------|---------|
| `API_URL` | Server-side upstream API base URL (default `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | Browser API base path (default `/api/ff-promo`) |
| `NEXT_PUBLIC_DASHBOARD_ACTOR_ID` | Actor ID sent on control mutations (default `dashboard`) |
| `API_KEY` | Optional key injected by BFF as `X-API-Key` |

**Optional Docker profile** (API must be running on the host):

```bash
docker compose --profile dev up web
```

**Dashboard tests** (MSW mocks — no live API required):

```bash
pnpm exec vitest run --project web
```

## Guardrails & Self-Service (Phase 7)

Platform engineers configure multi-environment pipelines with per-stage SLO thresholds; developers self-serve promotions within guardrails enforced server-side.

**Requirements satisfied:** PIPE-01, TELE-01, TELE-02, GRD-01–03, API-03, UI-04

| API | Purpose |
|-----|---------|
| `POST /v1/pipelines` | Create pipeline with dev/staging/prod stages and gate policies |
| `PATCH /v1/pipelines/:id` | Deactivate pipeline or update description |
| `GET /v1/pipelines` | List all pipelines (active and inactive) |
| `GET /v1/pipelines/:id` | Pipeline detail with gate policy thresholds |

**Guardrail enforcement:** `GuardrailService.validatePromotionRequest` runs on `POST /v1/promotion-runs` and `POST /v1/promotion-runs/:id/start`. Wrong flag key or inactive pipeline returns **403**; structural violations return **422**.

**Dashboard routes:**

| Page | Purpose |
|------|---------|
| `/pipelines` | List pipelines with active/inactive badge (UI-04) |
| `/pipelines/new` | Create pipeline with gate policy editors |
| `/pipelines/[id]` | Read-only detail and deactivate |

**Example — create pipeline via curl:**

```bash
curl -X POST http://localhost:3000/v1/pipelines \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: dev-key' \
  -d '{
    "name": "checkout-rollout",
    "flagKey": "checkout-v2",
    "projectKey": "default",
    "actor": { "actorType": "user", "actorId": "platform" },
    "stages": [
      {
        "orderIndex": 0,
        "environment": "dev",
        "displayName": "Development",
        "gatePolicies": [
          { "metricType": "error_rate", "threshold": 0.01, "serviceName": "demo-service" },
          { "metricType": "latency_p95", "threshold": 500, "serviceName": "demo-service" }
        ]
      },
      {
        "orderIndex": 1,
        "environment": "staging",
        "displayName": "Staging",
        "gatePolicies": [
          { "metricType": "error_rate", "threshold": 0.01, "serviceName": "demo-service" },
          { "metricType": "latency_p95", "threshold": 500, "serviceName": "demo-service" }
        ]
      },
      {
        "orderIndex": 2,
        "environment": "prod",
        "displayName": "Production",
        "gatePolicies": [
          { "metricType": "error_rate", "threshold": 0.01, "serviceName": "demo-service" },
          { "metricType": "latency_p95", "threshold": 500, "serviceName": "demo-service" }
        ]
      }
    ]
  }'
```

**Deferred to v2:** GRD-04 RBAC/Better Auth, API-04 CLI, GRD-05/06 approval gates and templates.

**Phase 7 tests:**

```bash
pnpm exec vitest run --project api guardrail pipelines guardrails
pnpm exec vitest run --project web pipeline
pnpm exec vitest run --project db pipeline.integration
```

## Phase 1 Scope

Phase 1 delivers the foundation only:

- PostgreSQL schema for pipelines, promotion runs, gate results, and audit events
- Repository layer and append-only audit trail
- Temporal workflow skeleton with stub activities
- Docker Compose stack for local development

**Not included yet:** CLI commands. CLI ships alongside dashboard in Phase 6.

## Project Layout

```
apps/
  api/      # Fastify REST API (Phase 5)
  worker/   # Temporal worker + promotion workflow
  web/      # Dashboard shell (Phase 6)
  cli/      # CLI shell (Phase 6)
packages/
  contracts/          # Shared Zod schemas
  db/                 # Prisma schema, repositories, seed
  ld-adapter/         # LaunchDarkly REST adapter (Phase 2)
  telemetry/          # Prometheus telemetry adapter (Phase 3)
  promotion-control/  # Shared Temporal start/signal helpers (Phase 5)
```

## Environment Variables

See `.env.example` for local defaults. Never commit secrets or real API keys.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection for app data |
| `TEMPORAL_ADDRESS` | Temporal server gRPC address |
| `TEMPORAL_TASK_QUEUE` | Worker task queue name |
| `LD_ACCESS_TOKEN` | LaunchDarkly API token (adapter writes) |
| `LD_BASE_URL` | LaunchDarkly API base URL |
| `LD_API_VERSION` | LaunchDarkly API version header |
| `PROMETHEUS_BASE_URL` | Prometheus server URL for telemetry gates |
| `PROMETHEUS_BEARER_TOKEN` | Optional Prometheus auth token |
| `PORT` | API HTTP port (default `3000`) |
| `API_KEY` | Optional API key for `X-API-Key` header |
| `API_URL` | Web BFF upstream API URL (server-only) |
| `NEXT_PUBLIC_API_URL` | Dashboard client API base path |
| `NEXT_PUBLIC_DASHBOARD_ACTOR_ID` | Dashboard actor ID for control actions |