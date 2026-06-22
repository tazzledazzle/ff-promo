# Feature Flag Promotion System (ff-promo)

Production-grade orchestration for feature flag promotion across environments (dev → staging → prod) with telemetry-gated progression. Phase 1 establishes persistence, audit infrastructure, and a Temporal workflow skeleton.

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

## Phase 1 Scope

Phase 1 delivers the foundation only:

- PostgreSQL schema for pipelines, promotion runs, gate results, and audit events
- Repository layer and append-only audit trail
- Temporal workflow skeleton with stub activities
- Docker Compose stack for local development

**Not included yet:** LaunchDarkly API integration, Prometheus/PromQL telemetry gates, REST API endpoints, CLI commands, or dashboard UI. Those ship in later phases.

## Project Layout

```
apps/
  api/      # REST API shell (Phase 5)
  worker/   # Temporal worker + promotion workflow
  web/      # Dashboard shell (Phase 6)
  cli/      # CLI shell (Phase 5)
packages/
  contracts/  # Shared Zod schemas
  db/         # Prisma schema, repositories, seed
```

## Environment Variables

See `.env.example` for local defaults. Never commit secrets or real API keys.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection for app data |
| `TEMPORAL_ADDRESS` | Temporal server gRPC address |
| `TEMPORAL_TASK_QUEUE` | Worker task queue name |