# Phase 8: Kotlin Foundation & Data Layer - Research

**Researched:** 2026-06-20
**Domain:** Gradle Kotlin multi-module bootstrap, Flyway + Exposed PostgreSQL persistence, kotlinx-serialization contracts, Temporal Java SDK worker shell
**Confidence:** HIGH (stack patterns); MEDIUM (hybrid monorepo layout with existing pnpm tree)

## Summary

Phase 8 bootstraps the **v2 Kotlin backend** while the shipped TypeScript v1 remains the behavioral reference (`apps/api`, `apps/worker`, `packages/*`) [VERIFIED: `.planning/ROADMAP.md`, `.planning/intel/stack.json`]. The Prisma schema in `packages/db/prisma/schema.prisma` defines 7 models, 5 enums, and nested pipeline/stage/gatePolicy relations that must be reproduced byte-for-byte in PostgreSQL via Flyway [VERIFIED: schema + `migrations/20260622052811_init/migration.sql`, `20260622222931_add_pipeline_config_audit/migration.sql`].

**Primary recommendation:** Add a **`kotlin/` Gradle root** (Kotlin DSL) with modules `contracts`, `db`, `worker` — do not replace the pnpm workspace in Phase 8. Port Prisma SQL migrations to `kotlin/modules/db/src/main/resources/db/migration/` as Flyway `V1__init.sql` + `V2__pipeline_config_audit.sql`. Use **Exposed DSL** for repositories mirroring `PipelineRepository`, `PromotionRunRepository`, `AuditRepository`, `GateResultRepository`, `PipelineAuditRepository` [VERIFIED: `packages/db/src/repositories/`]. Run **Flyway migrate** before Exposed `Database.connect` on startup [CITED: https://www.jetbrains.com/help/exposed/migrations.html]. Temporal worker shell registers stub workflow + activities on task queue `promotion` matching v1 env defaults [VERIFIED: `apps/worker/src/worker.ts`].

Phase 8 does **not** implement Ktor API, LaunchDarkly, telemetry, or guardrails — only foundation + SAFE-01 audit persistence parity at repository level.

<user_constraints>
## User Constraints (from ROADMAP / PROJECT — no CONTEXT.md yet)

### Locked Decisions (v2 milestone)

- **KOT-01:** Gradle Kotlin DSL multi-module monorepo for backend services
- **KOT-03:** PostgreSQL schema preserved; domain matches v1 Prisma
- **KOT-04:** Docker Compose runs Kotlin worker + postgres + temporal (no TS worker required for Phase 8 dev)
- **Stack:** Ktor (Phase 12), Exposed + Flyway, Temporal **Java SDK** + `temporal-kotlin`, kotlinx-serialization contracts [CITED: `.planning/ROADMAP.md` Overview]
- **Dashboard:** Next.js retained; no Kotlin frontend in v2.0 [CITED: `.planning/PROJECT.md` Active]
- **Parity baseline:** TypeScript code stays until Phase 14 cutover [CITED: `.planning/STATE.md`]

### Claude's Discretion

- `kotlin/` subdirectory vs root Gradle (recommend `kotlin/` subroot)
- Exposed DAO vs DSL-only (recommend DSL + explicit repository classes like v1)
- CUID library for primary keys (`cuid` crate vs application-generated strings)
- DI framework (Koin vs manual constructor injection for Phase 8)
- Test framework: Kotest vs JUnit 5 (both work with Testcontainers)

### Deferred Ideas (OUT OF SCOPE for Phase 8)

- Ktor REST routes (Phase 12)
- LaunchDarkly / Prometheus adapters (Phases 9–10)
- Guardrail validation logic (Phase 14)
- Next.js changes (Phase 13)
- Removing TypeScript packages (Phase 14 / KOT-05)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KOT-01 | Gradle multi-module builds all backend services | `kotlin/settings.gradle.kts` includes `contracts`, `db`, `worker`; root `./gradlew build` |
| KOT-03 | Flyway schema matches v1 Prisma | Copy/adapt existing Prisma migration SQL; Exposed `Table` objects align column names (quoted camelCase → PostgreSQL `"flagKey"`) |
| KOT-04 | Docker Compose Kotlin worker stack | New compose service or profile `kotlin` running `./gradlew :worker:run` with `DATABASE_URL`, `TEMPORAL_ADDRESS` |
| SAFE-01 | Audit trail for promotion events | `AuditRepository.append` + query by `promotionRunId`; milestone actions enum matching `AuditAction` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Core value unchanged:** Telemetry-gated promotion; pause-and-alert [CITED: CLAUDE.md]
- **v1 stack docs still describe TypeScript** — Phase 8 adds parallel Kotlin tree; update README in Phase 8 plan, not full CLAUDE.md rewrite
- **Do not use:** Hand-rolled SQL without migration tool; workflow code importing DB drivers directly (Temporal sandbox rule carries to Java/Kotlin SDK) [CITED: Phase 1 D-07 pattern]
- **GSD workflow:** Plans execute via `/gsd-execute-phase`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Domain DTOs / API shapes (future) | `kotlin/modules/contracts` | Ktor routes (Phase 12) | Replaces `@ff-promo/contracts` Zod for Kotlin side |
| Schema migrations | `kotlin/modules/db` Flyway | — | Single source for Kotlin; v1 Prisma migrations are **reference input**, not runtime |
| Table definitions | Exposed `Table` objects in `db` | Flyway SQL | Flyway owns DDL; Exposed maps existing tables (don't use `SchemaUtils.create` in prod) |
| Repositories | `kotlin/modules/db` | Worker/API later | Mirror v1 repository methods and include shapes |
| Audit append-only | `AuditRepository` | Worker activities (Phase 11) | SAFE-01 at persistence layer first |
| Workflow execution shell | `kotlin/modules/worker` | Temporal service | Register `PromotionWorkflow` stub + no-op activities |
| Integration tests | `db` test source set | Testcontainers Postgres | Port scenarios from `packages/db/src/__tests__/*.integration.test.ts` |
| Next.js / pnpm | Unchanged at repo root | — | Phase 8 must not break `pnpm run build` |

## Standard Stack

### Core (Phase 8 scope)

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| **Kotlin** | 2.1.x | Language | HIGH [CITED: JetBrains release train] |
| **Gradle** | 8.12+ (Kotlin DSL) | Build | HIGH |
| **Exposed** | 0.56.x (core + jdbc) | SQL DSL + transactions | HIGH [CITED: https://www.jetbrains.com/help/exposed/migrations.html] |
| **Flyway** | 11.x + `flyway-database-postgresql` | Migrations | HIGH [CITED: Flyway docs / DEV multi-module pattern] |
| **PostgreSQL JDBC** | 42.7.x | Driver | HIGH |
| **HikariCP** | 6.x | Connection pool | HIGH |
| **kotlinx-serialization-json** | 1.8.x | Contract DTOs | HIGH |
| **Temporal Java SDK** | 1.27+ (align with compose `temporalio/admin-tools:1.27.2`) | Worker | HIGH [CITED: https://docs.temporal.io/develop/java/workers/run-worker-process] |
| **temporal-kotlin** | Same SDK version | Kotlin Async/stub support | HIGH [CITED: Maven Central `io.temporal:temporal-kotlin`] |
| **Kotest** or **JUnit 5** | latest | Tests | HIGH |
| **Testcontainers PostgreSQL** | 1.20.x | DB integration tests | HIGH |

### Explicitly NOT in Phase 8

| Library | Phase |
|---------|-------|
| Ktor | 12 |
| LaunchDarkly Java SDK | 9 |
| Koin / Hoplite | Optional Phase 8; required before Phase 12 |

## Architecture Patterns

### Pattern 1: Hybrid repo layout (`kotlin/` Gradle + root pnpm)

**What:** Keep existing `apps/web`, `apps/api`, `packages/*` intact; add sibling `kotlin/` with its own Gradle wrapper.
**When:** Any incremental language migration.
**Example structure:**

```
ff-promo/
  pnpm-workspace.yaml          # unchanged
  apps/web/                    # unchanged
  packages/                    # v1 reference
  kotlin/
    settings.gradle.kts
    build.gradle.kts
    gradlew
    modules/
      contracts/
      db/
      worker/
```

**Pitfall:** Dual migration sources (Prisma + Flyway) drift — **Phase 8 rule:** after Flyway port, treat Prisma migrations as read-only reference; schema changes for v2 go only through Flyway.

### Pattern 2: Flyway-first, Exposed-second

**What:** On application/worker startup (and test `@BeforeAll`):

```kotlin
Flyway.configure()
    .dataSource(jdbcUrl, user, pass)
    .locations("classpath:db/migration")
    .load()
    .migrate()

Database.connect(hikariDataSource)
transaction { /* repository work */ }
```

[CITED: Stack Overflow Ktor+Flyway pattern; Exposed docs — Exposed does not auto-apply migrations]

**When:** All Kotlin services touching Postgres.

### Pattern 3: Repository port from v1

**What:** One Kotlin class per v1 repository with same public operations:

| v1 (TypeScript) | v1 key methods | Phase 8 Kotlin target |
|-----------------|----------------|---------------------|
| `PipelineRepository` | `create`, `findById`, `listAll`, `deactivate`, `resolveNextVersion` | Same signatures |
| `PromotionRunRepository` | `create`, `findById`, `updateStatus`, … | Port from TS file |
| `AuditRepository` | `append`, `listByRunId` | Append-only |
| `GateResultRepository` | `create`, `listByRunId` | Gate history |
| `PipelineAuditRepository` | `append` | Config audit |

Validate inputs at repository boundary with kotlinx-serialization decode + konform (optional Phase 8) — mirrors `PipelineCreateInputSchema.parse`.

### Pattern 4: Temporal worker shell (Java SDK, Kotlin workflow class)

**What:** Kotlin `@WorkflowInterface` / `@ActivityInterface` or Java interfaces with Kotlin impls; register on queue `promotion`.

```kotlin
val factory = WorkerFactory.newInstance(client)
val worker = factory.newWorker("promotion")
worker.registerWorkflowImplementationTypes(PromotionWorkflowImpl::class.java)
worker.registerActivitiesImplementations(StubActivities())
factory.start()
```

[CITED: https://docs.temporal.io/develop/java/workers/run-worker-process]

**Pitfall:** Workflow code must not call Exposed/JDBC — only activities (same as v1 `@temporalio/workflow` proxy pattern) [VERIFIED: `apps/worker/src/workflows/promotion.workflow.ts`].

**Pitfall:** Add `io.temporal:temporal-kotlin` if using Kotlin `Async` patterns [CITED: temporalio/sdk-java PR #319].

### Pattern 5: ID generation (CUID parity)

**What:** v1 uses Prisma `@default(cuid())` — Kotlin inserts must generate compatible string IDs.

**Options:**
1. `com.github.thake.cuid2` or port cuid spec [ASSUMED — verify artifact coordinates in plan phase]
2. Application-layer `CuidGenerator.newId()` in repositories before insert

**Recommendation:** Central `IdGenerator` object in `db` module; use in all `INSERT`s.

## Schema Port Checklist (KOT-03)

Source files [VERIFIED]:
- `packages/db/prisma/migrations/20260622052811_init/migration.sql`
- `packages/db/prisma/migrations/20260622222931_add_pipeline_config_audit/migration.sql`

| Entity | Notes for Exposed |
|--------|-------------------|
| Enums | Map to Kotlin `enum class` or inline varchar check; Postgres native enums exist in SQL |
| `"Pipeline"` | Quoted identifiers — Exposed `varchar("flagKey", 255)` etc. |
| `"Stage"` | Unique `(pipelineId, orderIndex)` and `(pipelineId, environment)` |
| `"GatePolicy"` | Unique `(stageId, metricType)` |
| `"PromotionRun"` | `temporalWorkflowId` unique nullable |
| `"AuditEvent"` | JSONB `metadata` → Exposed `jsonb` |
| `"PipelineConfigAudit"` | Enum `PipelineConfigAction` |

**Seed data:** Port `packages/db/src/seed.ts` logic to Kotlin `db` test fixture or `db/src/main/kotlin/.../Seed.kt` invoked from integration tests only (not auto on migrate).

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| DDL versioning | Flyway | Exposed `SchemaUtils.create` not for prod [CITED: Exposed migrations doc] |
| Connection pooling | HikariCP | Standard JVM |
| Postgres enum arrays in workflow | Temporal signals | Durable execution |
| Custom migration runner | Flyway API | Battle-tested |
| JSON column typing | kotlinx-serialization `JsonObject` / `Map` serializer | Matches v1 `Json` metadata |

## Common Pitfalls

### Pitfall 1: Prisma `@updatedAt` vs Exposed

**What goes wrong:** Forgetting to set `updatedAt` on UPDATE.
**How to avoid:** Repository update methods set `updatedAt = Instant.now()` explicitly (Exposed has no Prisma middleware).

### Pitfall 2: camelCase column names

**What goes wrong:** Exposed default snake_case doesn't match `"flagKey"` quoted columns.
**How to avoid:** Explicit column names in every `Table` definition matching Prisma migration SQL.

### Pitfall 3: Nested create transaction boundaries

**What goes wrong:** Pipeline + stages + gate policies partial insert on failure.
**How to avoid:** Single Exposed `transaction {}` block for nested create (mirror Prisma nested create).

### Pitfall 4: Dual Flyway + Prisma migrate against same DB

**What goes wrong:** Developers run `prisma migrate dev` and Flyway on same database — history table conflicts.
**How to avoid:** Document: Kotlin dev uses Flyway only; use separate DB name `ffpromo_kotlin` OR same schema with Flyway baseline from existing v1 DB (`baselineOnMigrate = true`) [CITED: Flyway baseline docs].

### Pitfall 5: Temporal workflow classpath pollution

**What goes wrong:** Accidentally putting Exposed on worker workflow classpath.
**How to avoid:** Gradle module separation — `worker` depends on `db` for activities only; workflow interface module must not depend on `db`.

### Pitfall 6: Breaking root `pnpm run build`

**What goes wrong:** CI only runs pnpm; Kotlin never builds.
**How to avoid:** Optional root `package.json` script `"build:kotlin": "cd kotlin && ./gradlew build"`; document in README; full CI wiring in Phase 14.

## Code Examples

### Exposed table sketch (Pipeline)

```kotlin
object Pipelines : Table("Pipeline") {
    val id = varchar("id", 32)
    val name = varchar("name", 255)
    val flagKey = varchar("flagKey", 255)
    val projectKey = varchar("projectKey", 255)
    val version = integer("version").default(1)
    val isActive = bool("isActive").default(true)
    val description = varchar("description", 255).nullable()
    val createdAt = timestamp("createdAt")
    val updatedAt = timestamp("updatedAt")
    override val primaryKey = PrimaryKey(id)
}
```

Pattern reference — adjust types to match migration SQL [VERIFIED: init migration].

### Gradle module includes

```kotlin
// kotlin/settings.gradle.kts
rootProject.name = "ff-promo-kotlin"
include("modules:contracts", "modules:db", "modules:worker")
```

### Testcontainers harness (mirror v1)

Port `packages/db/src/__tests__/setup.ts` pattern:
- `PostgreSQLContainer` start in `@BeforeAll`
- Flyway migrate against container JDBC URL
- Run repository integration tests
- `@AfterAll` stop container

[VERIFIED: v1 uses `@testcontainers/postgresql` in root `package.json`; Kotlin uses org.testcontainers PostgreSQL module]

## v1 → Kotlin Module Mapping

| v1 path | Kotlin module (Phase 8) |
|---------|-------------------------|
| `packages/contracts` | `kotlin/modules/contracts` (DTOs only; validation rules partial) |
| `packages/db` | `kotlin/modules/db` |
| `apps/worker` (shell only) | `kotlin/modules/worker` |
| `apps/api` | **Phase 12** |
| `packages/ld-adapter` | **Phase 9** |
| `packages/telemetry` | **Phase 10** |
| `packages/promotion-control` | **Phase 11** (signals/start helpers) |

## Implications for Roadmap / Planner

Suggested plan waves:

**Wave 0:** Gradle wrapper, `contracts` module (core enums + pipeline/run DTOs), CI-local `./gradlew build`

**Wave 1:** Flyway SQL port + Exposed tables + Hikari `DatabaseFactory`

**Wave 2:** Repositories + integration tests ported from `pipeline.integration.test.ts`, `audit.integration.test.ts`, `promotion-run.integration.test.ts`

**Wave 3:** Temporal worker shell (stub workflow loop + stub activities calling `persistRunState` mock)

**Wave 4:** Docker Compose `kotlin-worker` profile + README Phase 8 section + seed fixture for tests

## Research Flags for Plan Checker

- Confirm **Kotlin 2.1** and **Exposed 0.56** on Maven Central at plan time (versions move)
- Verify **cuid** library choice with slopcheck before locking
- Decide **shared DB vs ffpromo_kotlin** for local dev (document in 08-CONTEXT if discuss-phase runs)

---
*Research completed for `/gsd-plan-phase --research-phase 8`*
