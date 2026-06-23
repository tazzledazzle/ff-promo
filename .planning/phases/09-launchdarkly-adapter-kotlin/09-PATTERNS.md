# Phase 9: LaunchDarkly Adapter (Kotlin) - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 34 new/modified files (Phase 9 scope)
**Analogs found:** 28 / 34
**Upstream context:** Phase 8 Kotlin foundation (`08-PATTERNS.md`); v1 behavioral reference `packages/ld-adapter/src/**` + `packages/contracts/src/launchdarkly.ts`.

## Recommended Layout

Phase 9 adds **`kotlin/modules/ld-adapter`** — a Kotlin port of `@ff-promo/ld-adapter` with LaunchDarkly contract DTOs moved into `kotlin/modules/contracts`. Gradle registers the new module; v1 TypeScript packages remain unchanged.

```
kotlin/
  settings.gradle.kts                     # MOD: include ld-adapter module
  modules/
    contracts/
      src/main/kotlin/com/ffpromo/contracts/
        LaunchDarkly.kt                   # NEW: port launchdarkly.ts (deferred Phase 8)
      src/test/kotlin/com/ffpromo/contracts/
        LaunchDarklyJsonTest.kt           # NEW: golden JSON round-trip tests
    ld-adapter/
      build.gradle.kts                    # NEW: depends on contracts; coroutines + HttpClient
      src/main/kotlin/com/ffpromo/ldadapter/
        LdAdapterModule.kt                # NEW: barrel exports (mirror index.ts)
        errors/
          LdAdapterError.kt               # NEW: exception hierarchy
        client/
          LdApiClient.kt                  # NEW: port ld-api-client.ts
          RateLimitedClient.kt            # NEW: port rate-limited-client.ts
        read/
          GetFlagState.kt                 # NEW: port get-flag-state.ts
          Mappers.kt                      # NEW: port mappers.ts
        resolve/
          VariationResolver.kt            # NEW: port variation-resolver.ts
          RuleResolver.kt                 # NEW: port rule-resolver.ts
        write/
          SemanticPatch.kt                # NEW: port semantic-patch.ts
          ApplyTargeting.kt               # NEW: port apply-targeting.ts
        provider/
          FlagProvider.kt                 # NEW: port flag-provider.ts (interface)
          LaunchDarklyProvider.kt         # NEW: port launch-darkly-provider.ts
      src/test/kotlin/com/ffpromo/ldadapter/
        fixtures/
          flag-boolean.json               # COPY: from packages/ld-adapter fixtures
          flag-multivariate.json
          patch-canary-success.json
          patch-422-invalid.json
          patch-429-retry.json
        LdApiClientTest.kt
        RateLimitedClientTest.kt
        MappersTest.kt
        SemanticPatchTest.kt
        VariationResolverTest.kt
        RuleResolverTest.kt
        ApplyTargetingTest.kt
        LaunchDarklyProviderTest.kt       # NEW: MockWebServer HTTP integration (mirror nock)
```

**Unchanged:** `apps/api`, `packages/ld-adapter` (v1 reference), `pnpm run build` at repo root.

**Worker dependency (Phase 11):** `kotlin/modules/worker` will depend on `:ld-adapter` for `applyStageTargeting` activity — do not wire in Phase 9 unless plan explicitly includes stub import.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `kotlin/settings.gradle.kts` | config | — | Phase 8 `settings.gradle.kts` | exact (extend) |
| `kotlin/modules/contracts/.../LaunchDarkly.kt` | model | transform | `packages/contracts/src/launchdarkly.ts` | exact (port) |
| `kotlin/modules/contracts/.../LaunchDarklyJsonTest.kt` | test | transform | `ContractsJsonTest.kt` + v1 wire JSON | role-match |
| `kotlin/modules/ld-adapter/build.gradle.kts` | config | — | `kotlin/modules/db/build.gradle.kts` | role-match |
| `kotlin/modules/ld-adapter/.../LdAdapterError.kt` | utility | transform | `errors/ld-adapter-error.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../LdApiClient.kt` | service | request-response | `client/ld-api-client.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../RateLimitedClient.kt` | middleware | request-response | `client/rate-limited-client.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../GetFlagState.kt` | service | request-response | `read/get-flag-state.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../Mappers.kt` | utility | transform | `read/mappers.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../VariationResolver.kt` | utility | transform | `resolve/variation-resolver.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../RuleResolver.kt` | utility | transform | `resolve/rule-resolver.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../SemanticPatch.kt` | utility | transform | `write/semantic-patch.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../ApplyTargeting.kt` | service | request-response | `write/apply-targeting.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../FlagProvider.kt` | provider | request-response | `provider/flag-provider.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../LaunchDarklyProvider.kt` | provider | request-response | `provider/launch-darkly-provider.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../LdAdapterModule.kt` | utility | transform | `index.ts` barrel | exact (port) |
| `kotlin/modules/ld-adapter/.../LdApiClientTest.kt` | test | request-response | `__tests__/ld-api-client.test.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../RateLimitedClientTest.kt` | test | request-response | `__tests__/rate-limited-client.test.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../MappersTest.kt` | test | transform | `__tests__/mappers.test.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../SemanticPatchTest.kt` | test | transform | `__tests__/semantic-patch-builder.test.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../VariationResolverTest.kt` | test | transform | `__tests__/variation-resolver.test.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../RuleResolverTest.kt` | test | transform | `__tests__/rule-resolver.test.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../ApplyTargetingTest.kt` | test | request-response | `__tests__/apply-targeting.test.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../LaunchDarklyProviderTest.kt` | test | request-response | `__tests__/launch-darkly-provider.test.ts` | exact (port) |
| `kotlin/modules/ld-adapter/.../fixtures/*.json` | test | file-I/O | `packages/ld-adapter/src/__tests__/fixtures/` | exact (copy) |
| root `package.json` `"build:kotlin"` / `"test:kotlin"` | config | — | existing Phase 8 scripts | role-match |

---

## Pattern Assignments

### Gradle module registration (`settings.gradle.kts`, `ld-adapter/build.gradle.kts`)

**Analog:** Phase 8 module wiring — `kotlin/settings.gradle.kts` + `kotlin/modules/db/build.gradle.kts`

**Extend settings** — mirror `:db` projectDir pattern:

```kotlin
// kotlin/settings.gradle.kts (add)
include("ld-adapter")
project(":ld-adapter").projectDir = file("modules/ld-adapter")
```

**Module dependencies** — contracts-only at runtime; test stack like `:db`:

```kotlin
// kotlin/modules/ld-adapter/build.gradle.kts
plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
}

dependencies {
    implementation(project(":contracts"))
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:${property("kotlinxSerializationVersion")}")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.1")

    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
```

**HTTP client choice:** v1 uses `launchdarkly-api` npm for GET and raw `fetch` for semantic PATCH. **Authoritative stack per 09-RESEARCH.md (committed):** `com.launchdarkly:api-client:22.0.0` for GET + **OkHttp** hand-rolled PATCH with `SEMANTIC_PATCH_CONTENT_TYPE`. Do **not** use `launchdarkly-java-server-sdk` (evaluation SDK). See 09-RESEARCH Standard Stack for rationale.

---

### `kotlin/modules/contracts/.../LaunchDarkly.kt` (model, transform)

**Analog:** `packages/contracts/src/launchdarkly.ts` (lines 1-110); Kotlin serialization from `Pipeline.kt`

**Enum + DTO pattern** — replace Zod with `@Serializable`:

```typescript
// packages/contracts/src/launchdarkly.ts lines 31-40
export const VariationRefSchema = z.discriminatedUnion('by', [
  z.object({ by: z.literal('id'), id: z.string() }),
  z.object({ by: z.literal('name'), name: z.string() }),
  z.object({ by: z.literal('value'), value: z.unknown() }),
]);
```

**Kotlin target** — sealed class for discriminated unions:

```kotlin
@Serializable
sealed class VariationRef {
    @Serializable
    @SerialName("id")
    data class ById(val by: String = "id", val id: String) : VariationRef()

    @Serializable
    @SerialName("name")
    data class ByName(val by: String = "name", val name: String) : VariationRef()

    @Serializable
    @SerialName("value")
    data class ByValue(val by: String = "value", val value: JsonElement) : VariationRef()
}
```

**Types to port 1:1 from `launchdarkly.ts`:**

| Kotlin type | v1 schema | Notes |
|-------------|-----------|-------|
| `FlagVariation` | `FlagVariationSchema` | |
| `FlagRule` | `FlagRuleSchema` | `clauses: List<JsonElement>` |
| `FlagEnvironmentState` | `FlagEnvironmentStateSchema` | |
| `FlagState` | `FlagStateSchema` | |
| `VariationRef` | `VariationRefSchema` | sealed class |
| `RuleRef` | `RuleRefSchema` | sealed class |
| `RolloutIntent` | `RolloutIntentSchema` | `mode` enum default `fallthrough` |
| `SemanticPatchInstruction` | `SemanticPatchInstructionSchema` | sealed class by `kind` |
| `TargetingIntent` | `TargetingIntentSchema` | |
| `GetFlagStateInput` | `GetFlagStateInputSchema` | |
| `ApplyTargetingInput` | `ApplyTargetingInputSchema` | |
| `LaunchDarklyClientConfig` | `LaunchDarklyClientConfigSchema` | |

**Json unknown fields:** use `Json { ignoreUnknownKeys = true }` in mapper validation (same as `ContractsJsonTest.kt` line 9).

**Validation:** Phase 9 minimum — decode/encode round-trip in `LaunchDarklyJsonTest.kt`; optional Konform at provider boundary matching v1 Zod `.parse()`.

---

### `LdAdapterError.kt` (utility, transform)

**Analog:** `errors/ld-adapter-error.ts` (lines 1-57)

**Exception hierarchy** — open base + typed subclasses:

```typescript
// ld-adapter-error.ts lines 1-8
export class LdAdapterError extends Error {
  constructor(
    message: string,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'LdAdapterError';
  }
}
```

**Kotlin target:**

```kotlin
open class LdAdapterError(
    message: String,
    val context: Map<String, JsonElement>? = null,
    cause: Throwable? = null,
) : Exception(message, cause)

class UnresolvedVariationError(message: String, context: Map<String, JsonElement>? = null) :
    LdAdapterError(message, context)

class UnresolvedRuleError(message: String, context: Map<String, JsonElement>? = null) :
    LdAdapterError(message, context)

class LdRateLimitError(
    message: String,
    val retryAfterMs: Long? = null,
    context: Map<String, JsonElement>? = null,
) : LdAdapterError(message, context)

class LdApiError(
    message: String,
    val status: Int,
    val body: JsonElement? = null,
    context: Map<String, JsonElement>? = null,
) : LdAdapterError(message, context)

class ApprovalRequiredError(
    message: String,
    val environmentKey: String? = null,
    context: Map<String, JsonElement>? = null,
) : LdAdapterError(message, context)
```

Port all six error types with same semantics as v1.

---

### `LdApiClient.kt` (service, request-response)

**Analog:** `client/ld-api-client.ts` (lines 1-37)

**Constants + factory:**

```typescript
// ld-api-client.ts lines 5-9
export const SEMANTIC_PATCH_CONTENT_TYPE =
  'application/json; domain-model=launchdarkly.semanticpatch';

export const DEFAULT_LD_BASE_URL = 'https://app.launchdarkly.com';
export const DEFAULT_LD_API_VERSION = '20240415';
```

**Kotlin target** — `LaunchDarklyRawClient` data class holding config + shared `HttpClient`:

```kotlin
const val SEMANTIC_PATCH_CONTENT_TYPE =
    "application/json; domain-model=launchdarkly.semanticpatch"

data class LaunchDarklyRawClient(
    val config: LaunchDarklyClientConfig,
    val httpClient: HttpClient,
)

fun createLaunchDarklyClient(configInput: LaunchDarklyClientConfig): LaunchDarklyRawClient {
    val baseUrl = configInput.baseUrl
        ?: System.getenv("LD_BASE_URL")
        ?: DEFAULT_LD_BASE_URL
    val apiVersion = configInput.apiVersion ?: DEFAULT_LD_API_VERSION
    // merge resolved baseUrl/apiVersion into config copy
    val httpClient = HttpClient.newBuilder().build()
    return LaunchDarklyRawClient(resolvedConfig, httpClient)
}
```

**Env defaults:** `LD_BASE_URL` fallback matches v1 line 23. Auth header: `Authorization: {accessToken}` (LD API key token, not Bearer).

**Test parity** — `LdApiClientTest.kt` mirrors `ld-api-client.test.ts`: assert resolved `baseUrl`, `apiVersion` header value `20240415`.

---

### `RateLimitedClient.kt` (middleware, request-response)

**Analog:** `client/rate-limited-client.ts` (lines 1-177)

**Core API:**

```typescript
// rate-limited-client.ts lines 17-20
export type RateLimitedLdClient = {
  schedule<T>(fn: () => Promise<T>): Promise<T>;
  rawClient: LaunchDarklyRawClient;
};
```

**Kotlin:** suspend `schedule` wrapped in coroutines; replace Bottleneck with `Semaphore(maxConcurrent)` + optional `delay(minTime)`; replace `p-retry` with manual retry loop.

**Retry policy** — port verbatim logic:

```typescript
// rate-limited-client.ts lines 115-124
function shouldRetry(error: unknown): boolean {
  const status = extractStatus(error);
  if (status === 405 || status === 422) {
    return false;
  }
  if (status === 429) {
    return true;
  }
  return status !== undefined && status >= 500;
}
```

**HTTP error mapping** (lines 76-93):

```typescript
if (status === 405) {
  return new ApprovalRequiredError(...);
}
if (status === 429) {
  return new LdRateLimitError(..., computeRetryDelayMs(error), ...);
}
```

**computeRetryDelayMs** (lines 52-74): honor `Retry-After` seconds, then `x-ratelimit-reset` epoch ms, else `1000 + jitter`.

**Test injectables:** `sleep: (Long) -> Unit`, `retries`, `jitterMs`, `maxConcurrent` — mirror `RateLimitedLdClientOptions` for deterministic tests (`rate-limited-client.test.ts` lines 29-77).

**Defaults:** `maxConcurrent = 2`, `retries = 4`, `jitterMs = 500` (v1 lines 131-136).

---

### `Mappers.kt` + `GetFlagState.kt` (read path)

**Analog:** `read/mappers.ts` (lines 29-61), `read/get-flag-state.ts` (lines 30-71)

**Mapper** — LD `_id` → domain `id`:

```typescript
// mappers.ts lines 36-48
for (const [envKey, env] of Object.entries(rawLdFlag.environments ?? {})) {
  environments[envKey] = {
    on: env.on ?? false,
    rules: (env.rules ?? []).map((rule) => ({
      id: rule._id ?? '',
      description: rule.description,
      clauses: rule.clauses ?? [],
      variationOrRollout: rule.variationOrRollout ?? null,
    })),
    ...
  };
}
```

**Kotlin:** deserialize raw LD JSON with `@Serializable` internal DTOs using `@SerialName("_id") val id: String`, or manual `JsonObject` walk — prefer internal `LdFlagResponse` DTO matching fixture shape.

**getFlagState flow:**
1. Validate input (GetFlagStateInput)
2. GET `/api/v2/flags/{projectKey}/{flagKey}` with `LD-API-Version` header
3. `mapLdFlagToFlagState(raw, projectKey, flagKey)`
4. `getEnvironmentState(flagState, environmentKey)` — throw `LdApiError(404, ...)` if missing (get-flag-state.ts lines 35-46)
5. Return `FlagState`

**Replace callback promisify** — v1 `promisifyGetFeatureFlag` (lines 14-28) becomes direct HttpClient suspend call.

---

### `VariationResolver.kt` + `RuleResolver.kt` (resolve path)

**Analog:** `resolve/variation-resolver.ts` (lines 8-41), `resolve/rule-resolver.ts` (lines 4-44)

**Variation match by ref** — exactly-one match rule:

```typescript
// variation-resolver.ts lines 12-29
const matches = flagState.variations.filter((variation) => {
  switch (ref.by) {
    case 'id': return variation.id === ref.id;
    case 'name': return variation.name === ref.name;
    case 'value': return valuesEqual(variation.value, ref.value);
    ...
  }
});
if (matches.length !== 1) {
  throw new UnresolvedVariationError(...);
}
```

**Value equality:** `JSON.stringify` compare in v1 — Kotlin: `Json.encodeToString(JsonElement.serializer(), a) == ...` or kotlinx.serialization structural compare.

**Rule resolver:** filter `flagState.environments[environmentKey].rules` by `id` or `description`; throw `UnresolvedRuleError` on 0 or >1 matches.

---

### `SemanticPatch.kt` (utility, transform)

**Analog:** `write/semantic-patch.ts` (lines 14-101)

**buildRolloutWeights** — thousandths sum to 100_000:

```typescript
// semantic-patch.ts lines 14-31
export function buildRolloutWeights(
  treatmentThousandths: number,
  treatmentVariationId: string,
  controlVariationId: string,
): Record<string, number> {
  if (treatmentThousandths < 0 || treatmentThousandths > 100_000) {
    throw new Error('treatmentThousandths must be between 0 and 100000');
  }
  const controlThousandths = 100_000 - treatmentThousandths;
  ...
}
```

**buildTargetingPatchBody** instruction order:
1. `turnFlagOff` if `intent.turnOn === false`
2. else `turnFlagOn` if `intent.turnOn ?? true`
3. rollout instruction if present (`updateFallthroughVariationOrRollout` or `updateRuleVariationOrRollout`)
4. reject `updatePercentageRollout` kind (lines 90-94)

**ResolvedRolloutIds** data class: `treatmentVariationId`, `controlVariationId`, optional `ruleId`.

Port unit tests from `semantic-patch-builder.test.ts` including PROV weight sum assertion.

---

### `ApplyTargeting.kt` (service, request-response)

**Analog:** `write/apply-targeting.ts` (lines 40-139)

**GET-before-write orchestration:**

```typescript
// apply-targeting.ts lines 88-94
const flagState = await rateLimitedClient.schedule(() =>
  getFlagState({ client: rawClient }, {
    projectKey: parsed.projectKey,
    flagKey: parsed.flagKey,
    environmentKey: parsed.intent.environmentKey,
  }),
);
```

**Semantic PATCH** — raw fetch, not LD SDK (lines 40-74):

```typescript
const url = `${client.config.baseUrl}/api/v2/flags/${encodeURIComponent(projectKey)}/${encodeURIComponent(flagKey)}`;
const response = await fetch(url, {
  method: 'PATCH',
  headers: {
    Authorization: client.config.accessToken,
    'LD-API-Version': client.config.apiVersion,
    'Content-Type': SEMANTIC_PATCH_CONTENT_TYPE,
    Accept: 'application/json',
  },
  body: JSON.stringify(body),
});
```

**Kotlin:** same URL/headers via `HttpClient.send`; wrap non-2xx in `HttpResponseError` carrying `status` + response headers for rate limiter (mirror `HttpResponseError` class lines 20-38).

**Full flow:**
1. GET flag state (rate-limited)
2. Resolve variation/rule IDs if rollout present
3. `buildTargetingPatchBody(intent, resolved)`
4. PATCH (rate-limited)
5. GET flag state again — return fresh `FlagState`

**Tests:** port `apply-targeting.test.ts` scenarios — GET-before-PATCH order, semantic patch content-type header, unresolved variation error.

---

### `FlagProvider.kt` + `LaunchDarklyProvider.kt` (provider)

**Analog:** `provider/flag-provider.ts` (lines 7-10), `provider/launch-darkly-provider.ts` (lines 18-41)

**Interface:**

```typescript
// flag-provider.ts lines 7-10
export interface FlagProvider {
  getFlagState(input: GetFlagStateInput): Promise<FlagState>;
  applyTargeting(input: ApplyTargetingInput): Promise<FlagState>;
}
```

**Kotlin:**

```kotlin
interface FlagProvider {
    suspend fun getFlagState(input: GetFlagStateInput): FlagState
    suspend fun applyTargeting(input: ApplyTargetingInput): FlagState
}
```

**Provider wiring:**

```typescript
// launch-darkly-provider.ts lines 35-40
export function createLaunchDarklyProvider(
  config: LaunchDarklyClientConfig,
): LaunchDarklyProvider {
  const rawClient = createLaunchDarklyClient(config);
  const rateLimitedClient = createRateLimitedLdClient(rawClient);
  return new LaunchDarklyProvider(rawClient, rateLimitedClient);
}
```

**getFlagState** wraps call in `rateLimitedClient.schedule` (lines 24-27); **applyTargeting** delegates to write module (lines 30-31).

**Factory:** `createLaunchDarklyProvider(config): LaunchDarklyProvider` exported from barrel.

---

### `LdAdapterModule.kt` (barrel exports)

**Analog:** `index.ts` (lines 1-21)

Export public API matching v1 barrel:
- `createLaunchDarklyClient`, `SEMANTIC_PATCH_CONTENT_TYPE`
- `createRateLimitedLdClient`
- All error classes
- `FlagProvider`, `LaunchDarklyProvider`, `createLaunchDarklyProvider`
- `getFlagState`, `getEnvironmentState`, `mapLdFlagToFlagState`
- `resolveRuleId`, `resolveVariationId`
- `applyTargeting`, `buildRolloutWeights`, `buildTargetingPatchBody`

No `@JvmStatic` re-exports required — Kotlin consumers import directly.

---

### Test harness (`LaunchDarklyProviderTest.kt`, fixtures)

**Analog:** `__tests__/launch-darkly-provider.test.ts` (nock); Kotlin `ContractsJsonTest.kt` for JSON fixtures

**HTTP mocking:** use **OkHttp MockWebServer** (not nock). Enqueue GET/PATCH responses in order.

**Fixtures:** copy verbatim from `packages/ld-adapter/src/__tests__/fixtures/` to `src/test/resources/fixtures/` or `src/test/kotlin/.../fixtures/` — keep JSON identical for cross-language parity.

**Test scenarios to port (PROV-* IDs from v1):**

| Test | v1 source | Assertion |
|------|-----------|-----------|
| PROV-01 read flag | `launch-darkly-provider.test.ts` L39-57 | 2 variations, production.on=true |
| PROV-02/03 semantic patch | L59-110 | turnFlagOn + rollout weights 10k/90k |
| 422 fail-fast | L112-137 | single PATCH attempt |
| 429 retry | L139-163 | retry then success |
| 405 approval | L165-185 | `ApprovalRequiredError` |
| Content-Type | L187-214 | semantic patch media type |

**Unit tests without HTTP:** `MappersTest`, `SemanticPatchTest`, `RateLimitedClientTest` — JUnit 5 + kotlin.test like `PipelineRepositoryIntegrationTest.kt` (lines 18-31).

**Coroutine tests:** use `runTest { }` from `kotlinx-coroutines-test` for suspend provider methods.

---

## Shared Patterns

### Contracts as single source of truth

**Source:** `packages/contracts/src/launchdarkly.ts`; Phase 8 `Pipeline.kt` pattern
**Apply to:** all ld-adapter read/write/resolve functions

```typescript
import { GetFlagStateInputSchema, type FlagState } from '@ff-promo/contracts';
```

Kotlin: `import com.ffpromo.contracts.FlagState` — never duplicate LD DTO shapes outside `:contracts`.

### Validate at module boundary

**Source:** `get-flag-state.ts` line 58, `apply-targeting.ts` line 84
**Apply to:** `getFlagState`, `applyTargeting`, `createLaunchDarklyClient`

```typescript
const parsed = GetFlagStateInputSchema.parse(input);
```

Kotlin: decode/validate required fields before HTTP calls; Phase 9 minimum matches v1 null/required rejection.

### Rate-limited schedule wrapper

**Source:** `launch-darkly-provider.ts` lines 24-27, `apply-targeting.ts` lines 88-137
**Apply to:** all external LD HTTP calls

Every GET/PATCH goes through `rateLimitedClient.schedule { }` — never call HttpClient directly from provider surface.

### Semantic patch only (not updatePercentageRollout)

**Source:** `semantic-patch.ts` lines 90-94
**Apply to:** `SemanticPatch.kt`

Reject `updatePercentageRollout` instruction kind — v1 uses `updateFallthroughVariationOrRollout` / `updateRuleVariationOrRollout` with explicit `rolloutWeights`.

### GET-before-write

**Source:** `apply-targeting.test.ts` — `GET-before-write: getFeatureFlag before fetch PATCH`
**Apply to:** `ApplyTargeting.kt`

Always read current flag state before PATCH to resolve variation/rule IDs from live LD data.

### LD API version header

**Source:** `ld-api-client.ts` lines 9, 29
**Apply to:** all HTTP requests

`LD-API-Version: 20240415` on every request; configurable via `LaunchDarklyClientConfig.apiVersion`.

### Error status mapping

**Source:** `rate-limited-client.ts` `mapHttpError`, `shouldRetry`
**Apply to:** `RateLimitedClient.kt`

| Status | Behavior |
|--------|----------|
| 405 | `ApprovalRequiredError`, no retry |
| 422 | fail-fast, no retry |
| 429 | retry with backoff |
| 5xx | retry |

### Test fixture reuse

**Source:** `packages/ld-adapter/src/__tests__/fixtures/*.json`
**Apply to:** all Kotlin ld-adapter tests

Copy fixtures unchanged — enables diff-free behavioral parity with v1 vitest suite.

---

## Anti-Patterns to Avoid

| Anti-pattern | Why | Do instead |
|--------------|-----|------------|
| `@launchdarkly/node-server-sdk` | Runtime evaluation SDK, not management API | HttpClient REST per v1 |
| `updatePercentageRollout` instruction | Invalid LD semantic patch kind | `updateFallthroughVariationOrRollout` / `updateRuleVariationOrRollout` |
| PATCH without prior GET | Stale variation/rule IDs | GET-before-write in `ApplyTargeting` |
| Bypass rate limiter for PATCH | Inconsistent retry/backoff | All HTTP via `RateLimitedClient.schedule` |
| Duplicate LD DTOs in ld-adapter | Drift from contracts | `:contracts` module only |
| Global mutable LD ApiClient singleton | v1 uses singleton but Kotlin should not share mutable state across tests | Instance-per-`LaunchDarklyRawClient` |
| Hardcoded snake_case JSON | LD API uses camelCase domain fields | Match v1 mapper field names |
| Wiring ld-adapter into worker in Phase 9 | Out of scope unless plan says so | Export module; worker import Phase 11 |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Kotlin `HttpClient` LD REST wrapper | service | request-response | No HTTP client code in Kotlin yet — port from v1 fetch + promisify patterns |
| `RateLimitedClient.kt` concurrency | middleware | request-response | No Bottleneck/p-retry equivalent in Kotlin codebase — use coroutines + Semaphore |
| `LaunchDarklyProviderTest.kt` MockWebServer | test | request-response | v1 uses nock; MockWebServer is idiomatic Kotlin substitute |
| Official LaunchDarkly Java management client | service | request-response | v1 avoids generated client for PATCH — follow raw HTTP |

---

## v1 Patterns to Reuse

| v1 artifact | Phase 9 Kotlin target |
|-------------|----------------------|
| `packages/contracts/src/launchdarkly.ts` | `contracts/LaunchDarkly.kt` |
| `packages/ld-adapter/src/index.ts` | `ldadapter/LdAdapterModule.kt` |
| `packages/ld-adapter/src/errors/ld-adapter-error.ts` | `errors/LdAdapterError.kt` |
| `packages/ld-adapter/src/client/ld-api-client.ts` | `client/LdApiClient.kt` |
| `packages/ld-adapter/src/client/rate-limited-client.ts` | `client/RateLimitedClient.kt` |
| `packages/ld-adapter/src/read/get-flag-state.ts` | `read/GetFlagState.kt` |
| `packages/ld-adapter/src/read/mappers.ts` | `read/Mappers.kt` |
| `packages/ld-adapter/src/resolve/variation-resolver.ts` | `resolve/VariationResolver.kt` |
| `packages/ld-adapter/src/resolve/rule-resolver.ts` | `resolve/RuleResolver.kt` |
| `packages/ld-adapter/src/write/semantic-patch.ts` | `write/SemanticPatch.kt` |
| `packages/ld-adapter/src/write/apply-targeting.ts` | `write/ApplyTargeting.kt` |
| `packages/ld-adapter/src/provider/flag-provider.ts` | `provider/FlagProvider.kt` |
| `packages/ld-adapter/src/provider/launch-darkly-provider.ts` | `provider/LaunchDarklyProvider.kt` |
| `packages/ld-adapter/src/__tests__/*.test.ts` | `src/test/kotlin/.../*Test.kt` |
| `packages/ld-adapter/src/__tests__/fixtures/*.json` | test fixtures (verbatim copy) |
| `kotlin/modules/contracts/.../ContractsJsonTest.kt` | `LaunchDarklyJsonTest.kt` structure |
| `kotlin/settings.gradle.kts` | add `:ld-adapter` module include |

---

## Metadata

**Analog search scope:** `packages/ld-adapter/src/` (27 files), `packages/contracts/src/launchdarkly.ts`, `kotlin/modules/contracts/`, `kotlin/modules/db/`, Phase 8 `08-PATTERNS.md`
**Files scanned:** ~40 source + test files
**Kotlin ld-adapter codebase:** none (greenfield module)
**Pattern extraction date:** 2026-06-22
