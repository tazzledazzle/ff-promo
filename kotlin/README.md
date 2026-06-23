# ff-promo Kotlin Backend (v2)

Kotlin modules under `kotlin/` implement the Phase 8+ backend: shared contracts, Flyway/Exposed data layer, and Temporal worker. TypeScript apps in `apps/*` remain the v1 reference until Phase 14 cutover.

## Layout

| Module | Purpose |
|--------|---------|
| `modules/contracts` | kotlinx-serialization DTOs mirroring `packages/contracts` |
| `modules/db` | Flyway migrations, Exposed tables, repositories |
| `modules/worker` | Temporal promotion workflow + activities |
| `modules/ld-adapter` | LaunchDarkly REST adapter (read, semantic patch write, rate limiting) |

## Prerequisites

- **JDK 21**
- **Docker** — Testcontainers for `:db:test`, or local Postgres via compose
- **Gradle wrapper** — `./gradlew` (no global Gradle install required)

## Commands

```bash
cd kotlin

# Full build (all modules)
./gradlew build

# Repository integration tests (requires Docker for Testcontainers)
./gradlew :db:test

# Worker unit/workflow tests (in-memory Temporal)
./gradlew :worker:test

# LaunchDarkly adapter tests (MockWebServer; no live LD token)
./gradlew :ld-adapter:test

# Run worker against local stack
DATABASE_URL=postgresql://ffpromo:ffpromo@localhost:5432/ffpromo_kotlin \
TEMPORAL_ADDRESS=localhost:7233 \
./gradlew :worker:run
```

From repo root:

```bash
pnpm run build:kotlin
pnpm run test:kotlin
```

## Database: Flyway vs Prisma

- **TypeScript v1** uses Prisma on database `ffpromo` (default compose `POSTGRES_DB`).
- **Kotlin v2** uses Flyway on startup via `DatabaseFactory.connectFromDatabaseUrl`.
- For Kotlin-only dev, use **`ffpromo_kotlin`** so Flyway and Prisma migration histories do not conflict.

```bash
# Compose creates ffpromo_kotlin via docker/postgres/init-kotlin-db.sql
docker compose up -d postgres temporal

# Or point tests at local Postgres without Testcontainers:
SKIP_TESTCONTAINERS=1 \
DATABASE_URL=postgresql://ffpromo:ffpromo@localhost:5432/ffpromo_kotlin \
./gradlew :db:test
```

## Docker Compose (kotlin profile)

Starts Postgres, Temporal, and the Kotlin worker (no TypeScript worker):

```bash
docker compose --profile kotlin up -d
docker compose logs -f kotlin-worker
```

Environment (set in compose):

- `DATABASE_URL=postgresql://ffpromo:ffpromo@postgres:5432/ffpromo_kotlin`
- `TEMPORAL_ADDRESS=temporal:7233`
- `TEMPORAL_TASK_QUEUE=promotion`

The worker runs Flyway migrations on first activity DB connection.

## Temporal

- Task queue: **`promotion`** (matches v1 `apps/worker`)
- Workflow: `PromotionWorkflow` with signals `pause`, `resume`, `abort`
- Phase 8 activities are stubs; real LaunchDarkly/Prometheus wiring lands in Phases 9–11

## LaunchDarkly adapter (`:ld-adapter`)

Ports `packages/ld-adapter` with PROV-01/02/03 parity:

- **Read:** `getFlagState` via `com.launchdarkly:api-client` GET + JSON mappers
- **Write:** OkHttp semantic PATCH (`application/json; domain-model=launchdarkly.semanticpatch`)
- **Resolve:** `resolveVariationId` / `resolveRuleId` before promotion writes
- **Rate limit:** coroutine semaphore + Retry-After backoff (429/5xx)

Environment variables (Phase 11+ worker/API runtime):

- `LD_ACCESS_TOKEN` — LaunchDarkly API token
- `LD_BASE_URL` — optional override (default `https://app.launchdarkly.com`)

Factory entry point: `createLaunchDarklyProvider(LaunchDarklyClientConfig(...))`.

## Phase 8 smoke check

1. `./gradlew build` — all Kotlin modules compile and unit/workflow tests pass
2. `./gradlew :ld-adapter:test` — LaunchDarkly adapter MockWebServer suite
3. `./gradlew :db:test` — with Docker running (Testcontainers)
4. `docker compose up -d postgres temporal` then `:worker:run` connects
5. Verify Flyway schema in `ffpromo_kotlin`: `\dt` shows `"Pipeline"`, `"AuditEvent"`, etc.
6. `pnpm run build` at repo root still passes (TypeScript v1 unchanged)

Optional script:

```bash
./scripts/smoke.sh   # gradle build + test; skips gracefully if Docker absent for db tests
```
