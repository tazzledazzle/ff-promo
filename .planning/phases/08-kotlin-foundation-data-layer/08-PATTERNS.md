# Phase 8: Kotlin Foundation & Data Layer - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 42 new files (Phase 8 scope)
**Analogs found:** 38 / 42
**Upstream context:** `08-RESEARCH.md` (KOT-01, KOT-03, KOT-04, SAFE-01); no `08-CONTEXT.md` yet — patterns from v1 TypeScript (`packages/db`, `packages/contracts`, `apps/worker`).

## Recommended Layout

Phase 8 adds a **parallel Kotlin backend** under `kotlin/` while the pnpm monorepo stays intact. Gradle owns build/migrate/test for Kotlin; v1 TypeScript remains the behavioral reference until Phase 14 cutover.

```
kotlin/
  settings.gradle.kts                     # NEW: include contracts, db, worker
  build.gradle.kts                        # NEW: shared Kotlin 2.1, JVM 21, version catalog
  gradle/libs.versions.toml               # NEW: Exposed, Flyway, Temporal, Testcontainers pins
  gradlew / gradlew.bat                   # NEW: Gradle wrapper
  modules/
    contracts/
      build.gradle.kts                    # NEW: kotlinx-serialization only
      src/main/kotlin/com/ffpromo/contracts/
        Pipeline.kt                       # NEW: StageEnvironment, GatePolicyInput, PipelineCreateInput
        PromotionRun.kt                   # NEW: PromotionStatus, Actor, PersistRunStateInput
        Audit.kt                          # NEW: ActorType, AuditAction, AuditEventInput
        GateResult.kt                     # NEW: GateVerdict, GateResultCreateInput
        Enums.kt                          # NEW: shared enum barrel (optional split)
    db/
      build.gradle.kts                    # NEW: depends on contracts; Exposed + Flyway + HikariCP
      src/main/resources/db/migration/
        V1__init.sql                      # NEW: port from Prisma init migration
        V2__pipeline_config_audit.sql     # NEW: port from Prisma pipeline config audit migration
      src/main/kotlin/com/ffpromo/db/
        DatabaseFactory.kt                # NEW: Flyway migrate → HikariCP → Exposed Database.connect
        IdGenerator.kt                    # NEW: CUID-compatible ID generation for inserts
        tables/
          Pipelines.kt                    # NEW: Exposed Table("Pipeline") with quoted camelCase columns
          Stages.kt
          GatePolicies.kt
          PromotionRuns.kt
          GateResults.kt
          AuditEvents.kt
          PipelineConfigAudits.kt
        repositories/
          PipelineRepository.kt           # NEW: port from pipeline.repository.ts
          PromotionRunRepository.kt
          AuditRepository.kt
          GateResultRepository.kt
          PipelineAuditRepository.kt
          RepositoryFactory.kt            # NEW: createRepositories() factory
      src/test/kotlin/com/ffpromo/db/
        TestDatabase.kt                   # NEW: Testcontainers + Flyway harness (mirror setup.ts)
        PipelineFixtures.kt               # NEW: standardStages() from pipeline-fixtures.ts
        PipelineRepositoryIntegrationTest.kt
        PromotionRunRepositoryIntegrationTest.kt
        AuditRepositoryIntegrationTest.kt
        GateResultRepositoryIntegrationTest.kt
    worker/
      build.gradle.kts                    # NEW: depends on db + contracts; Temporal Java SDK + temporal-kotlin
      src/main/kotlin/com/ffpromo/worker/
        WorkerMain.kt                     # NEW: port from apps/worker/src/worker.ts
        workflows/
          PromotionWorkflow.kt            # NEW: @WorkflowInterface stub (shell only Phase 8)
          PromotionWorkflowImpl.kt
        activities/
          PromotionActivities.kt          # NEW: @ActivityInterface
          StubPromotionActivities.kt      # NEW: no-op persistRunState / recordAuditEvent stubs
```

**Unchanged at repo root:** `pnpm-workspace.yaml`, `apps/web`, `apps/api`, `packages/*` — Phase 8 must not break `pnpm run build`.

**Docker Compose (KOT-04):** add `kotlin-worker` service or profile running `./gradlew :modules:worker:run` with `DATABASE_URL`, `TEMPORAL_ADDRESS`, `TEMPORAL_TASK_QUEUE=promotion`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `kotlin/settings.gradle.kts` | config | — | pnpm workspace + Turborepo root | role-match |
| `kotlin/build.gradle.kts` | config | — | root `package.json` scripts | role-match |
| `kotlin/gradle/libs.versions.toml` | config | — | root `package.json` dependency pins | role-match |
| `kotlin/modules/contracts/build.gradle.kts` | config | — | `packages/contracts/package.json` | exact (port) |
| `kotlin/modules/contracts/.../Pipeline.kt` | model | transform | `packages/contracts/src/pipeline.ts` | exact (port) |
| `kotlin/modules/contracts/.../PromotionRun.kt` | model | transform | `packages/contracts/src/promotion-run.ts` | exact (port) |
| `kotlin/modules/contracts/.../Audit.kt` | model | transform | `packages/contracts/src/audit.ts` | exact (port) |
| `kotlin/modules/contracts/.../GateResult.kt` | model | transform | `packages/contracts/src/gate-result.ts` | exact (port) |
| `kotlin/modules/db/build.gradle.kts` | config | — | `packages/db/package.json` | exact (port) |
| `kotlin/modules/db/.../V1__init.sql` | migration | batch | `packages/db/prisma/migrations/20260622052811_init/migration.sql` | exact (port) |
| `kotlin/modules/db/.../V2__pipeline_config_audit.sql` | migration | batch | `packages/db/prisma/migrations/20260622222931_add_pipeline_config_audit/migration.sql` | exact (port) |
| `kotlin/modules/db/.../DatabaseFactory.kt` | utility | request-response | `packages/db/src/client.ts` + `setup.ts` migrate step | role-match |
| `kotlin/modules/db/.../IdGenerator.kt` | utility | transform | Prisma `@default(cuid())` in `schema.prisma` | partial |
| `kotlin/modules/db/.../tables/*.kt` | model | CRUD | `packages/db/prisma/schema.prisma` | exact (port) |
| `kotlin/modules/db/.../PipelineRepository.kt` | service | CRUD | `packages/db/src/repositories/pipeline.repository.ts` | exact (port) |
| `kotlin/modules/db/.../PromotionRunRepository.kt` | service | CRUD | `packages/db/src/repositories/promotion-run.repository.ts` | exact (port) |
| `kotlin/modules/db/.../AuditRepository.kt` | service | CRUD | `packages/db/src/repositories/audit.repository.ts` | exact (port) |
| `kotlin/modules/db/.../GateResultRepository.kt` | service | CRUD | `packages/db/src/repositories/gate-result.repository.ts` | exact (port) |
| `kotlin/modules/db/.../PipelineAuditRepository.kt` | service | CRUD | `packages/db/src/repositories/pipeline-audit.repository.ts` | exact (port) |
| `kotlin/modules/db/.../RepositoryFactory.kt` | utility | transform | `packages/db/src/repositories/index.ts` | exact (port) |
| `kotlin/modules/db/.../TestDatabase.kt` | test | batch | `packages/db/src/__tests__/setup.ts` | exact (port) |
| `kotlin/modules/db/.../PipelineFixtures.kt` | test | transform | `packages/db/src/__tests__/pipeline-fixtures.ts` | exact (port) |
| `kotlin/modules/db/.../*IntegrationTest.kt` | test | batch | `packages/db/src/__tests__/*.integration.test.ts` | exact (port) |
| `kotlin/modules/worker/build.gradle.kts` | config | — | `apps/worker/package.json` | exact (port) |
| `kotlin/modules/worker/.../WorkerMain.kt` | config | event-driven | `apps/worker/src/worker.ts` | exact (port) |
| `kotlin/modules/worker/.../PromotionWorkflow.kt` | service | event-driven | `apps/worker/src/workflows/promotion.workflow.ts` | partial (stub shell) |
| `kotlin/modules/worker/.../StubPromotionActivities.kt` | service | request-response | `apps/worker/src/activities/persist-run-state.ts` | partial (stub) |
| `docker-compose.yml` (kotlin profile) | config | — | existing compose Temporal + postgres services | role-match |
| root `package.json` `"build:kotlin"` script | config | — | Turborepo task pattern | role-match |

---

## Pattern Assignments

### Gradle multi-module root (`kotlin/settings.gradle.kts`, `build.gradle.kts`)

**Analog:** pnpm workspace boundary — `packages/db/package.json` + `apps/worker/package.json` dependency graph

**Module includes** — mirror `@ff-promo/db` → `@ff-promo/worker` dependency chain:

```kotlin
// kotlin/settings.gradle.kts
rootProject.name = "ff-promo-kotlin"
include("modules:contracts", "modules:db", "modules:worker")

// kotlin/modules/db/build.gradle.kts — depends on contracts only
dependencies {
    implementation(project(":modules:contracts"))
    implementation(libs.exposed.core)
    implementation(libs.exposed.jdbc)
    implementation(libs.flyway.core)
    implementation(libs.flyway.postgresql)
    implementation(libs.hikaricp)
    implementation(libs.postgresql)
}

// kotlin/modules/worker/build.gradle.kts — depends on db + contracts
dependencies {
    implementation(project(":modules:contracts"))
    implementation(project(":modules:db"))
    implementation(libs.temporal.sdk)
    implementation(libs.temporal.kotlin)
}
```

**Root build** — equivalent to `pnpm run build` scoped to Kotlin:

```kotlin
// kotlin/build.gradle.kts
plugins {
    kotlin("jvm") version "2.1.0" apply false
    kotlin("plugin.serialization") version "2.1.0" apply false
}

subprojects {
    apply(plugin = "org.jetbrains.kotlin.jvm")
    java.toolchain.languageVersion.set(JavaLanguageVersion.of(21))
    tasks.withType<Test> { useJUnitPlatform() }
}
```

**Version catalog** — pin versions like root `package.json` (Exposed 0.56.x, Flyway 11.x, Temporal 1.27+, Testcontainers 1.20.x per `08-RESEARCH.md`).

---

### Flyway + Exposed bootstrap (`DatabaseFactory.kt`, migration SQL)

**Analog:** `packages/db/src/__tests__/setup.ts` (lines 21-42) — Testcontainers start + `prisma migrate deploy`; `packages/db/src/client.ts` — connection factory

**Flyway-first startup** — replace `execSync("pnpm exec prisma migrate deploy")`:

```typescript
// packages/db/src/__tests__/setup.ts lines 32-40
container = await new PostgreSqlContainer("postgres:16-alpine").start();
connectionString = container.getConnectionUri();
process.env.DATABASE_URL = connectionString;

execSync("pnpm exec prisma migrate deploy", {
  cwd: packageRoot,
  env: process.env,
  stdio: "inherit",
});
```

**Kotlin target:**

```kotlin
// kotlin/modules/db/.../DatabaseFactory.kt
object DatabaseFactory {
    fun connect(jdbcUrl: String, user: String, password: String): Database {
        Flyway.configure()
            .dataSource(jdbcUrl, user, password)
            .locations("classpath:db/migration")
            .load()
            .migrate()

        val hikari = HikariDataSource(HikariConfig().apply {
            this.jdbcUrl = jdbcUrl
            this.username = user
            this.password = password
        })
        return Database.connect(hikari)
    }
}
```

**Migration SQL** — copy verbatim from Prisma migrations; rename only:

| Flyway file | Prisma source |
|-------------|---------------|
| `V1__init.sql` | `packages/db/prisma/migrations/20260622052811_init/migration.sql` |
| `V2__pipeline_config_audit.sql` | `packages/db/prisma/migrations/20260622222931_add_pipeline_config_audit/migration.sql` |

**Quoted camelCase columns** — init migration (lines 14-26):

```sql
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "flagKey" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);
```

**Exposed table pattern** — explicit column names matching SQL (not snake_case defaults):

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

**Schema source of truth for Exposed types** — `packages/db/prisma/schema.prisma` (lines 48-164): 7 models, 5 enums (`ActorType`, `PromotionStatus`, `GateVerdict`, `AuditAction`, `PipelineConfigAction`).

**Do not use** `SchemaUtils.create` in prod — Flyway owns DDL per `08-RESEARCH.md` Pattern 2.

---

### `kotlin/modules/contracts` (model, transform)

**Analog:** `packages/contracts/src/pipeline.ts`, `promotion-run.ts`, `audit.ts`, `gate-result.ts` + barrel `index.ts`

**Enum + DTO pattern** — replace Zod with `@Serializable` data classes:

```typescript
// packages/contracts/src/pipeline.ts lines 4-18
export const StageEnvironmentSchema = z.enum(['dev', 'staging', 'prod']);
export const MetricTypeSchema = z.enum(['error_rate', 'latency_p95']);

export const GatePolicyInputSchema = z.object({
  metricType: MetricTypeSchema,
  threshold: z.number().positive(),
  serviceName: z.string(),
  comparisonMode: z.string().optional(),
  windowSeconds: z.number().int().optional(),
  minSampleSize: z.number().int().optional(),
});
```

**Kotlin target:**

```kotlin
@Serializable
enum class StageEnvironment { dev, staging, prod }

@Serializable
enum class MetricType { error_rate, latency_p95 }

@Serializable
data class GatePolicyInput(
    val metricType: MetricType,
    val threshold: Double,
    val serviceName: String,
    val comparisonMode: String? = null,
    val windowSeconds: Int? = null,
    val minSampleSize: Int? = null,
)
```

**Promotion run + audit enums** — port from:

```typescript
// packages/contracts/src/promotion-run.ts lines 4-10
export const PromotionStatusSchema = z.enum([
  'pending', 'active', 'paused', 'completed', 'aborted',
]);

// packages/contracts/src/audit.ts lines 3-14
export const ActorTypeSchema = z.enum(['user', 'system', 'api_key']);
export const AuditActionSchema = z.enum([
  'run_started', 'run_paused', 'run_resumed', 'run_aborted',
  'run_completed', 'stage_entered', 'stage_advanced', 'gate_evaluated',
]);
```

**Phase 8 scope:** core DTOs + enums only — defer `api.ts`, `telemetry.ts`, `launchdarkly.ts`, `promotion-engine.ts` to Phases 9–12.

**Validation:** optional Konform at repository boundary; v1 uses Zod `.parse()` at repository entry (see Shared Patterns).

---

### `kotlin/modules/db/.../PipelineRepository.kt` (service, CRUD)

**Analog:** `packages/db/src/repositories/pipeline.repository.ts` (lines 7-128)

**Class + constructor injection** — mirror Prisma client param:

```typescript
export class PipelineRepository {
  constructor(private readonly db: PrismaClient) {}
```

**Kotlin:** accept `Database` or use module-level `transaction {}` — no ORM client; Exposed DSL inside `transaction(db)`.

**Create with nested stages + gate policies** (lines 18-54):

```typescript
async create(input: PipelineCreateInput) {
  const data = PipelineCreateInputSchema.parse(input);
  const version =
    data.version ?? (await this.resolveNextVersion(data.name));

  return this.db.pipeline.create({
    data: {
      name: data.name,
      flagKey: data.flagKey,
      projectKey: data.projectKey,
      description: data.description,
      version,
      stages: {
        create: data.stages.map((stage) => ({
          orderIndex: stage.orderIndex,
          environment: stage.environment,
          displayName: stage.displayName,
          gatePolicies: {
            create: stage.gatePolicies.map((policy) => ({
              metricType: policy.metricType,
              threshold: policy.threshold,
              serviceName: policy.serviceName,
              comparisonMode: policy.comparisonMode ?? 'absolute',
              windowSeconds: policy.windowSeconds ?? 300,
              minSampleSize: policy.minSampleSize ?? 0,
            })),
          },
        })),
      },
    },
    include: {
      stages: {
        orderBy: { orderIndex: 'asc' },
        include: { gatePolicies: true },
      },
    },
  });
}
```

**Kotlin port rules:**
- Single `transaction {}` for nested insert (Pitfall 3 in RESEARCH)
- `IdGenerator.newId()` for `Pipeline`, `Stage`, `GatePolicy` rows (replaces `@default(cuid())`)
- Set `createdAt` / `updatedAt` explicitly on insert; set `updatedAt = Instant.now()` on UPDATE (no Prisma middleware)
- Default gate policy fields: `comparisonMode = "absolute"`, `windowSeconds = 300`, `minSampleSize = 0`

**Public methods to port 1:1:**

| Method | v1 lines |
|--------|----------|
| `resolveNextVersion(name)` | 10-16 |
| `create(input)` | 18-55 |
| `findById(id)` | 57-67 |
| `findByFlagKey(flagKey)` | 69-79 |
| `listActive()` | 81-91 |
| `listAll()` | 93-102 |
| `deactivate(id)` | 104-115 |
| `updateDescription(id, description)` | 117-128 |

**Include shape:** return nested stages ordered by `orderIndex ASC` with gate policies — match Prisma `include` for integration test assertions.

---

### `kotlin/modules/db/.../PromotionRunRepository.kt` (service, CRUD)

**Analog:** `packages/db/src/repositories/promotion-run.repository.ts` (lines 10-100)

**Create** — snapshot pipeline version (lines 13-27):

```typescript
async create(input: { pipelineId: string; flagKey: string }) {
  const { pipelineId, flagKey } = PromotionRunCreateSchema.parse(input);

  const pipeline = await this.db.pipeline.findUniqueOrThrow({
    where: { id: pipelineId },
  });

  return this.db.promotionRun.create({
    data: {
      pipelineId,
      flagKey,
      pipelineVersion: pipeline.version,
    },
  });
}
```

**updateState** — temporal workflow ID logic + partial update (lines 29-68):

```typescript
async updateState(input: {
  promotionRunId: string;
  status: PromotionStatus;
  currentStageIndex?: number;
  pauseReason?: string;
  temporalWorkflowId?: string;
}) {
  const parsed = PersistRunStateInputSchema.parse({ ... });

  const existing = await this.db.promotionRun.findUniqueOrThrow({
    where: { id: parsed.promotionRunId },
  });

  const isFirstActiveTransition =
    existing.status !== 'active' && parsed.status === 'active';
  const temporalWorkflowId =
    input.temporalWorkflowId ??
    (isFirstActiveTransition && !existing.temporalWorkflowId
      ? parsed.promotionRunId
      : undefined);

  return this.db.promotionRun.update({
    where: { id: parsed.promotionRunId },
    data: {
      status: parsed.status,
      ...(parsed.currentStageIndex !== undefined && { currentStageIndex: parsed.currentStageIndex }),
      ...(parsed.pauseReason !== undefined && { pauseReason: parsed.pauseReason }),
      ...(temporalWorkflowId !== undefined && { temporalWorkflowId }),
    },
  });
}
```

Port `findById`, `findByStatus`, `findRecent` with same ordering/includes.

---

### `kotlin/modules/db/.../AuditRepository.kt` (service, CRUD — SAFE-01)

**Analog:** `packages/db/src/repositories/audit.repository.ts` (lines 7-41)

**Append-only API** — only `append` + `findByRunId` (verified in `audit.integration.test.ts` lines 165-180):

```typescript
async append(input: AuditEventInput) {
  const data = AuditEventInputSchema.parse(input);

  return this.db.auditEvent.create({
    data: {
      promotionRunId: data.promotionRunId,
      action: data.action,
      actorType: data.actorType,
      actorId: data.actorId,
      displayName: data.displayName,
      gateResultId: data.gateResultId,
      metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

async findByRunId(promotionRunId: string, opts?: { limit?: number; cursor?: string }) {
  return this.db.auditEvent.findMany({
    where: { promotionRunId },
    orderBy: { occurredAt: 'asc' },
    take: opts?.limit ?? 100,
    ...(opts?.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
    include: { gateResult: true },
  });
}
```

**Kotlin:** JSONB `metadata` via kotlinx-serialization `JsonObject` or `Map<String, JsonElement>`; default `{}` when null.

**Integration test parity** — port scenarios from `packages/db/src/__tests__/audit.integration.test.ts`:
- append with actor fields + auto `occurredAt`
- `gate_evaluated` links `gateResultId`
- `findByRunId` ascending by `occurredAt` with gate result join
- no update/delete methods on repository

---

### `kotlin/modules/db/.../GateResultRepository.kt` + `PipelineAuditRepository.kt`

**Analog:** `gate-result.repository.ts` (lines 7-38), `pipeline-audit.repository.ts` (lines 8-36)

**GateResult create** (lines 10-24):

```typescript
async create(input: GateResultCreateInput) {
  const data = GateResultCreateInputSchema.parse(input);
  return this.db.gateResult.create({
    data: {
      promotionRunId: data.promotionRunId,
      stageId: data.stageId,
      verdict: data.verdict,
      metricType: data.metricType,
      observedValue: data.observedValue,
      threshold: data.threshold,
      metadata: data.metadata as Prisma.InputJsonValue,
    },
  });
}
```

**PipelineAudit append** — enum `PipelineConfigAction` inline in v1 (lines 3-6):

```typescript
export type PipelineConfigAction =
  | 'pipeline_created'
  | 'pipeline_deactivated'
  | 'pipeline_updated';
```

Map to Kotlin `@Serializable enum class PipelineConfigAction` matching Postgres enum from V2 migration.

---

### `kotlin/modules/db/.../RepositoryFactory.kt`

**Analog:** `packages/db/src/repositories/index.ts` (lines 14-21)

```typescript
export function createRepositories(db: PrismaClient) {
  return {
    pipeline: new PipelineRepository(db),
    pipelineAudit: new PipelineAuditRepository(db),
    promotionRun: new PromotionRunRepository(db),
    gateResult: new GateResultRepository(db),
    audit: new AuditRepository(db),
  };
}
```

**Kotlin:** same five keys; export from db module public API mirroring `packages/db/src/index.ts` (lines 1-24).

---

### Integration test harness (`TestDatabase.kt`, `*IntegrationTest.kt`)

**Analog:** `packages/db/src/__tests__/setup.ts` + `pipeline.integration.test.ts` + `audit.integration.test.ts`

**Testcontainers lifecycle** (pipeline.integration.test.ts lines 12-21):

```typescript
describe("PipelineRepository integration", () => {
  let dbUrl: string;

  beforeAll(async () => {
    dbUrl = await startTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase();
  });
```

**Kotlin (JUnit 5 + Testcontainers):**

```kotlin
companion object {
    @Container
    @JvmStatic
    val postgres = PostgreSQLContainer("postgres:16-alpine")

    @BeforeAll
    @JvmStatic
    fun migrate() {
        postgres.start()
        DatabaseFactory.connect(postgres.jdbcUrl, postgres.username, postgres.password)
    }
}
```

**Fixtures** — port `standardStages()` from `pipeline-fixtures.ts` (lines 16-47):

```typescript
export function standardStages(serviceName = 'demo-service'): StageInput[] {
  return [
    { orderIndex: 0, environment: 'dev', displayName: 'Development', gatePolicies: [...] },
    { orderIndex: 1, environment: 'staging', displayName: 'Staging', gatePolicies: [...] },
    { orderIndex: 2, environment: 'prod', displayName: 'Production', gatePolicies: [...] },
  ];
}
```

**Test files to port:**

| Kotlin test | v1 analog |
|-------------|-----------|
| `PipelineRepositoryIntegrationTest` | `pipeline.integration.test.ts` |
| `PromotionRunRepositoryIntegrationTest` | `promotion-run.integration.test.ts` |
| `AuditRepositoryIntegrationTest` | `audit.integration.test.ts` (SAFE-01) |
| `GateResultRepositoryIntegrationTest` | `gate-result.integration.test.ts` |

---

### Temporal worker shell (`WorkerMain.kt`, stub workflow + activities)

**Analog:** `apps/worker/src/worker.ts` (lines 8-35), `workflows/promotion.workflow.ts`, `activities/persist-run-state.ts`

**Worker bootstrap** — env defaults match v1:

```typescript
// apps/worker/src/worker.ts lines 8-19
async function run(): Promise<void> {
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'promotion';
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    taskQueue,
    workflowsPath,
    activities,
  });
```

**Kotlin target (Temporal Java SDK):**

```kotlin
fun main() {
    val taskQueue = System.getenv("TEMPORAL_TASK_QUEUE") ?: "promotion"
    val address = System.getenv("TEMPORAL_ADDRESS") ?: "localhost:7233"

    val client = WorkflowClient.newInstance(
        WorkflowServiceStubs.newServiceStubs(
            WorkflowServiceStubsOptions.newBuilder().setTarget(address).build()
        )
    )
    val factory = WorkerFactory.newInstance(client)
    val worker = factory.newWorker(taskQueue)
    worker.registerWorkflowImplementationTypes(PromotionWorkflowImpl::class.java)
    worker.registerActivitiesImplementations(StubPromotionActivities())
    factory.start()
}
```

**Workflow sandbox rule** — workflow code must NOT import Exposed/JDBC (same as v1 `proxyActivities` pattern):

```typescript
// apps/worker/src/workflows/promotion.workflow.ts lines 12-21
const {
  persistRunState,
  recordAuditEvent,
  evaluateGate,
  runPreflight,
  applyStageTargeting,
} = wf.proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});
```

**Phase 8 stub:** register `PromotionWorkflowImpl` with minimal loop (no LD/telemetry); activities are no-ops or log-only. Full workflow port in Phase 11.

**Activity DB access pattern** — when wiring real activities later, copy per-request client lifecycle from `persist-run-state.ts` (lines 15-33):

```typescript
export async function persistRunState(input: ...) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for persistRunState activity');
  }

  PersistRunStateInputSchema.parse({ ... });

  const db = createPrismaClient(databaseUrl);
  try {
    const repo = new PromotionRunRepository(db);
    return await repo.updateState(input);
  } finally {
    await db.$disconnect();
  }
}
```

**Kotlin Phase 8:** `StubPromotionActivities` may call `RepositoryFactory` + `DatabaseFactory.connect` with same env check; full persistence wiring optional until Phase 11.

**Gradle separation:** workflow interfaces/implementations in `worker` must not depend on Exposed tables directly — only activity impls depend on `:modules:db`.

---

## Shared Patterns

### Contracts as single source of truth

**Source:** `packages/contracts/src/*.ts`, barrel `index.ts` (lines 1-8)
**Apply to:** repository inputs, future Ktor routes (Phase 12), worker activity payloads

```typescript
import type { PipelineCreateInput } from '@ff-promo/contracts';
import { PipelineCreateInputSchema } from '@ff-promo/contracts';
```

Kotlin: `import com.ffpromo.contracts.PipelineCreateInput` — never hardcode `'dev' | 'staging' | 'prod'` outside contracts module.

### Validate at repository boundary

**Source:** `pipeline.repository.ts` line 19, `audit.repository.ts` line 11
**Apply to:** all repository write methods

```typescript
const data = PipelineCreateInputSchema.parse(input);
```

Kotlin equivalent: Konform validation or manual checks before insert; Phase 8 minimum — reject null required fields matching v1 Zod behavior.

### Repository factory

**Source:** `packages/db/src/repositories/index.ts` lines 14-21
**Apply to:** worker activities, integration tests, future Ktor services

```typescript
const { repos, dispose } = createRepositories(db);
```

Kotlin: `RepositoryFactory.create(database)` returning data class with five repository instances.

### Append-only audit (SAFE-01)

**Source:** `audit.repository.ts`, `audit.integration.test.ts` lines 165-180
**Apply to:** `AuditRepository`, `PipelineAuditRepository`

No `update` or `delete` methods — append + query only.

### CUID primary keys

**Source:** `schema.prisma` — `@id @default(cuid())` on all models
**Apply to:** all repository `INSERT`s via central `IdGenerator`

### Flyway before Exposed connect

**Source:** `setup.ts` migrate-before-use
**Apply to:** `DatabaseFactory`, `TestDatabase`, worker startup (if activities touch DB)

### Temporal task queue defaults

**Source:** `apps/worker/src/worker.ts` line 9
**Apply to:** `WorkerMain.kt`, Docker Compose env

`TEMPORAL_TASK_QUEUE` default `"promotion"`; `TEMPORAL_ADDRESS` default `"localhost:7233"`.

### Required gate policies per stage

**Source:** `packages/db/src/__tests__/pipeline-fixtures.ts` lines 3-14
**Apply to:** integration test fixtures, future validation

Each stage needs `error_rate` + `latency_p95` with `serviceName` and `threshold`.

---

## Anti-Patterns to Avoid

| Anti-pattern | Why | Do instead |
|--------------|-----|------------|
| `SchemaUtils.create` in prod | Drift from Flyway DDL | Flyway migrations only; Exposed maps existing tables |
| Exposed snake_case column names | Prisma uses quoted `"flagKey"` | Explicit `varchar("flagKey", 255)` on every column |
| JDBC/Exposed in workflow classes | Temporal sandbox isolation | Activities only; proxy from workflow |
| Running Prisma + Flyway on same DB | Migration history conflicts | Document Flyway-only for Kotlin dev; separate DB or baseline |
| Omitting `updatedAt` on UPDATE | No Prisma `@updatedAt` middleware | Set `updatedAt = Instant.now()` in update methods |
| Partial nested create without transaction | Orphan stages/policies | Single Exposed `transaction {}` for pipeline create |
| Replacing pnpm workspace in Phase 8 | Breaks dashboard + v1 API | Hybrid `kotlin/` subroot |
| Porting full promotion workflow in Phase 8 | Out of scope | Stub workflow + no-op activities only |
| Dual source of schema changes | Prisma + Flyway drift | After port, v2 schema changes via Flyway only |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `kotlin/gradle/libs.versions.toml` | config | — | No Gradle in repo yet — use RESEARCH.md version pins |
| `kotlin/modules/db/.../IdGenerator.kt` | utility | transform | v1 uses Prisma `cuid()` — no TS IdGenerator; pick JVM cuid library in plan |
| `kotlin/modules/worker/.../PromotionWorkflowImpl.kt` (full) | service | event-driven | Phase 8 stub only — full analog is 200+ line TS workflow |
| Koin / DI module | config | — | Deferred per RESEARCH Claude's Discretion — manual ctor injection Phase 8 |

**Reference for full workflow port (Phase 11):** `apps/worker/src/workflows/promotion.workflow.ts`, `activities/*.ts`.

---

## v1 Patterns to Reuse

| v1 artifact | Phase 8 Kotlin target |
|-------------|----------------------|
| `packages/db/prisma/schema.prisma` | Exposed `tables/*.kt` + Flyway SQL |
| `packages/db/prisma/migrations/*/migration.sql` | `db/migration/V*.sql` |
| `packages/db/src/repositories/*.ts` | `db/repositories/*.kt` |
| `packages/db/src/repositories/index.ts` | `RepositoryFactory.kt` |
| `packages/db/src/client.ts` | `DatabaseFactory.kt` (Hikari + connect) |
| `packages/db/src/__tests__/setup.ts` | `TestDatabase.kt` |
| `packages/db/src/__tests__/pipeline-fixtures.ts` | `PipelineFixtures.kt` |
| `packages/db/src/__tests__/*.integration.test.ts` | `*IntegrationTest.kt` |
| `packages/contracts/src/pipeline.ts` | `contracts/Pipeline.kt` |
| `packages/contracts/src/promotion-run.ts` | `contracts/PromotionRun.kt` |
| `packages/contracts/src/audit.ts` | `contracts/Audit.kt` |
| `packages/contracts/src/gate-result.ts` | `contracts/GateResult.kt` |
| `apps/worker/src/worker.ts` | `worker/WorkerMain.kt` |
| `apps/worker/src/workflows/promotion.workflow.ts` | stub `PromotionWorkflowImpl.kt` |
| `apps/worker/src/activities/persist-run-state.ts` | activity lifecycle pattern for Phase 11 |

---

## Metadata

**Analog search scope:** `packages/db/src/repositories/`, `packages/db/prisma/`, `packages/contracts/src/`, `apps/worker/src/`, `packages/db/src/__tests__/`
**Files scanned:** ~35 v1 source files
**Kotlin codebase:** none (greenfield bootstrap)
**Pattern extraction date:** 2026-06-22
