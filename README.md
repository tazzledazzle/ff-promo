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

## Phase 1 Scope

Phase 1 delivers the foundation only:

- PostgreSQL schema for pipelines, promotion runs, gate results, and audit events
- Repository layer and append-only audit trail
- Temporal workflow skeleton with stub activities
- Docker Compose stack for local development

**Not included yet:** REST API endpoints, CLI commands, or dashboard UI. Temporal worker LD/telemetry activities ship in Phase 4.

## Project Layout

```
apps/
  api/      # REST API shell (Phase 5)
  worker/   # Temporal worker + promotion workflow
  web/      # Dashboard shell (Phase 6)
  cli/      # CLI shell (Phase 5)
packages/
  contracts/   # Shared Zod schemas
  db/          # Prisma schema, repositories, seed
  ld-adapter/  # LaunchDarkly REST adapter (Phase 2)
  telemetry/   # Prometheus telemetry adapter (Phase 3)
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