# Phase 9: LaunchDarkly Adapter (Kotlin) - Research

**Researched:** 2026-06-22
**Domain:** LaunchDarkly REST control-plane adapter in Kotlin — flag read, semantic-patch write, variation/rule resolution, rate limiting
**Confidence:** HIGH (v1 reference + official LD REST docs); MEDIUM (Java api-client semantic-patch header ergonomics)

## Summary

Phase 9 ports `packages/ld-adapter` to **`kotlin/modules/ld-adapter`** with behavioral parity against v1 nock integration tests [VERIFIED: `packages/ld-adapter/src/**`, `launch-darkly-provider.test.ts`]. v1 deliberately uses the **REST control plane**, not runtime evaluation SDKs: `launchdarkly-api@20.0.0` for GET, hand-rolled `fetch` for PATCH with `Content-Type: application/json; domain-model=launchdarkly.semanticpatch` [VERIFIED: `ld-api-client.ts`, `apply-targeting.ts`]. CLAUDE.md forbids `@launchdarkly/node-server-sdk` for orchestration; the Java analogue `launchdarkly-java-server-sdk` is equally wrong for promotion control [CITED: https://github.com/launchdarkly/api-client-java/blob/main/README.md — "DO NOT use this client library to include feature flags in your web or mobile application"].

**Primary recommendation:** Add **`kotlin/modules/ld-adapter`** depending on **`kotlin/modules/contracts`** (extend contracts with LaunchDarkly DTOs from `packages/contracts/src/launchdarkly.ts`). Use **hybrid HTTP like v1**: `com.launchdarkly:api-client` for `getFeatureFlag`, **OkHttp** hand-rolled PATCH for semantic patch writes. Port semantic-patch builder, variation/rule resolvers, and rate-limit/retry logic verbatim in behavior. Test with **OkHttp MockWebServer** + copied v1 JSON fixtures (nock port), JUnit 5.

ROADMAP line "LaunchDarkly Java SDK" means **`com.launchdarkly:api-client`** (OpenAPI REST client), **not** `launchdarkly-java-server-sdk` [CITED: `.planning/ROADMAP.md` Overview vs CLAUDE.md forbidden patterns].

<user_constraints>
## User Constraints (from ROADMAP / PROJECT — no CONTEXT.md yet)

### Locked Decisions (v2 milestone)

- **Parity baseline:** TypeScript `packages/ld-adapter` is the behavioral reference until Phase 14 cutover [CITED: `.planning/STATE.md`, `.planning/ROADMAP.md`]
- **PROV-01–03** re-implemented in Kotlin Phase 9 with same semantics as v1 Phase 2 [CITED: `.planning/REQUIREMENTS.md` traceability]
- **Do not use** runtime evaluation SDKs for promotion control (`@launchdarkly/node-server-sdk` / `launchdarkly-java-server-sdk`) [CITED: CLAUDE.md, STACK.md]
- **Semantic patch API** with `LD-API-Version: 20240415` default [VERIFIED: v1 `DEFAULT_LD_API_VERSION`]
- **Kotlin module layout:** `kotlin/` Gradle subroot; Phase 8 modules `contracts`, `db`, `worker` already shipped [VERIFIED: `kotlin/settings.gradle.kts`]
- **Pause-and-alert failure mode** unchanged — adapter surfaces 405 as `ApprovalRequiredError`, does not auto-bypass [VERIFIED: v1 `rate-limited-client.ts`]

### Claude's Discretion

- Hand-rolled REST vs `com.launchdarkly:api-client` for PATCH (research recommends hybrid — see Standard Stack)
- HTTP client for hand-rolled PATCH: OkHttp vs Ktor Client (research recommends OkHttp)
- Test HTTP mock: MockWebServer vs WireMock (research recommends MockWebServer)
- Rate limiter implementation: kotlinx.coroutines Semaphore vs Resilience4j (research recommends port v1 logic with coroutines)
- Contract validation: decode-only kotlinx-serialization vs konform validators (match Phase 8 contracts pattern)

### Deferred Ideas (OUT OF SCOPE for Phase 9)

- Temporal activities wiring LaunchDarkly provider (Phase 11)
- Ktor API routes exposing provider (Phase 12)
- Live LaunchDarkly integration tests / credentials in CI
- EU region-specific base URL handling beyond env var passthrough (already supported via config)
- Removing TypeScript `packages/ld-adapter` (Phase 14 / KOT-05)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | System reads flag state from LaunchDarkly (variations, targeting rules, environment) | `getFeatureFlag` via api-client + `mapLdFlagToFlagState` → `FlagState`; MockWebServer GET test from `flag-boolean.json` fixture |
| PROV-02 | System writes targeting updates via semantic patch API | OkHttp PATCH with `SEMANTIC_PATCH_CONTENT_TYPE`; `buildTargetingPatchBody` emits `turnFlagOn` + `updateFallthroughVariationOrRollout` / `updateRuleVariationOrRollout`; never `updatePercentageRollout` |
| PROV-03 | System resolves variation IDs per environment before promotion writes | `resolveVariationId` / `resolveRuleId` with `UnresolvedVariationError` / `UnresolvedRuleError`; GET-before-write in `applyTargeting`; port all v1 resolver edge-case tests |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Integration:** LaunchDarkly REST semantic patch (`updateFallthroughVariationOrRollout`, `turnFlagOn`, etc.) — not percentage-rollout-only shortcuts
- **Forbidden:** `@launchdarkly/node-server-sdk` / runtime evaluation SDKs as orchestrator client
- **Failure mode:** Surface rate limits (429) and approval gates (405); no silent bypass
- **GSD workflow:** Plans execute via `/gsd-execute-phase`
- **Monorepo:** Keep root `pnpm run build` green; add `:ld-adapter` to `./gradlew build`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LaunchDarkly contract DTOs (`FlagState`, `TargetingIntent`, …) | `kotlin/modules/contracts` | — | Shared with worker (Phase 11) and API (Phase 12); mirrors `@ff-promo/contracts` |
| LD REST GET (flag state) | `kotlin/modules/ld-adapter` client | `com.launchdarkly:api-client` | Control-plane read; generated client matches v1 `launchdarkly-api` npm role |
| LD REST PATCH (semantic patch) | `kotlin/modules/ld-adapter` write layer | OkHttp | v1 uses hand-rolled fetch because semantic patch requires custom Content-Type header [VERIFIED: v1 `apply-targeting.ts`] |
| Variation/rule ID resolution | `kotlin/modules/ld-adapter` resolve | — | Pure domain logic on `FlagState`; no HTTP |
| Rate limit + retry orchestration | `kotlin/modules/ld-adapter` client | — | Wraps all LD HTTP; matches v1 Bottleneck + p-retry semantics |
| `FlagProvider` interface | `kotlin/modules/ld-adapter` provider | Worker activities inject impl (Phase 11) | Same seam as v1 `FlagProvider` |
| Integration tests (mock HTTP) | `ld-adapter` test source set | MockWebServer | No browser tier; no DB tier |
| Env secrets (`LD_ACCESS_TOKEN`) | Worker/API runtime config (Phase 11+) | — | Phase 9 accepts config object; no secret storage |

## Standard Stack

### Core (Phase 9 scope)

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| **Kotlin** | 2.1.10 (pin with root) | Language | HIGH [VERIFIED: `kotlin/gradle.properties`] |
| **kotlinx-serialization-json** | 1.8.0 | Contract DTOs + patch JSON bodies | HIGH [VERIFIED: Phase 8 contracts module] |
| **kotlinx-coroutines-core** | 1.10.x | Async provider methods; rate-limiter scheduling | HIGH [CITED: Kotlin coroutines docs] |
| **com.launchdarkly:api-client** | 22.0.0 | `FeatureFlagsApi#getFeatureFlag` (REST control plane) | HIGH [VERIFIED: Maven Central `repo1.maven.org/maven2/com/launchdarkly/api-client/maven-metadata.xml`; CITED: https://github.com/launchdarkly/api-client-java] |
| **OkHttp** | 4.12.0 | Hand-rolled semantic PATCH; shares stack with api-client | HIGH [VERIFIED: Maven Central; api-client-java uses OkHttp] |
| **JUnit 5** | 5.11.4 | Test runner (matches `:worker`, `:db`) | HIGH [VERIFIED: existing modules] |
| **kotlin.test** | (Kotlin plugin) | Assertions in unit tests | HIGH [VERIFIED: `:contracts` tests] |
| **mockwebserver** (OkHttp) | 4.12.0 | nock-equivalent HTTP stubbing | HIGH [CITED: https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html] |

### Explicitly NOT in Phase 9

| Library | Reason |
|---------|--------|
| `com.launchdarkly:launchdarkly-java-server-sdk` | Runtime flag **evaluation** SDK — same anti-pattern as node-server-sdk [CITED: api-client-java README] |
| **Ktor Client** | Defers to Phase 12 Ktor API; adds second HTTP stack when OkHttp already present via api-client |
| **WireMock** | Heavier than needed; v1 nock tests are simple request/response stubs — MockWebServer sufficient |
| **Resilience4j** | v1 uses custom Retry-After / x-ratelimit-reset logic; port for parity instead of generic retry |
| **Testcontainers** | No database in ld-adapter; mock HTTP only |

### Decision: Hand-Rolled REST vs LaunchDarkly Java REST Client

| Approach | Verdict | Rationale |
|----------|---------|-----------|
| **Hybrid (recommended)** — api-client GET + OkHttp PATCH | ✅ **Use** | Exact v1 architecture [VERIFIED: `ld-api-client.ts` + `apply-targeting.ts`]. Generated `patchFeatureFlag` defaults to `Content-Type: application/json` without `domain-model=launchdarkly.semanticpatch` [CITED: api-client-java `FeatureFlagsApi.md` patchFeatureFlag headers] |
| api-client for GET + PATCH | ⚠️ Possible with custom header override | Requires verifying `ApiClient` allows per-operation semantic patch Content-Type; adds coupling to OpenAPI model classes (`PatchWithComment`) for instruction maps v1 builds as plain JSON |
| Fully hand-rolled REST (no api-client) | ❌ Reject | More code for GET deserialization; api-client mirrors proven npm `launchdarkly-api@20.0.0` choice |
| `launchdarkly-java-server-sdk` | ❌ **Forbidden** | Evaluation SDK; cannot perform semantic-patch targeting updates [CITED: CLAUDE.md, STACK.md] |

### Decision: OkHttp vs Ktor Client

| Client | Verdict | Rationale |
|--------|---------|-----------|
| **OkHttp** | ✅ **Use for PATCH** | Already transitive dependency of `com.launchdarkly:api-client`; MockWebServer is OkHttp-native; Spring docs recommend MockWebServer for outbound HTTP client tests [CITED: Spring Framework testing client applications] |
| Ktor Client | ❌ Defer to Phase 12 | Ktor server arrives Phase 12; introducing Ktor Client now means two HTTP stacks in worker |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MockWebServer | WireMock 3.x | WireMock better for complex stub DSLs; overkill for 6 nock scenarios |
| kotlinx Semaphore rate limit | Resilience4j RateLimiter + Retry | Resilience4j generic; won't match v1 `computeRetryDelayMs` without custom config |
| api-client PATCH | Hand-rolled PATCH only | Loses typed GET response parsing unless duplicating JSON models |

**Installation (Gradle — `kotlin/modules/ld-adapter/build.gradle.kts`):**

```kotlin
dependencies {
    implementation(project(":contracts"))
    implementation("com.launchdarkly:api-client:22.0.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.1")

    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
```

**Version verification (2026-06-22):**

```bash
curl -s https://repo1.maven.org/maven2/com/launchdarkly/api-client/maven-metadata.xml | grep '<latest>'
# → 22.0.0

curl -s https://repo1.maven.org/maven2/com/squareup/okhttp3/okhttp/maven-metadata.xml | grep '<latest>'
# → 4.12.0 (stable line; 5.x alpha exists — pin 4.12.0 for MockWebServer alignment)
```

## Package Legitimacy Audit

> slopcheck is PyPI/npm-only; Java coordinates verified via Maven Central + official LaunchDarkly GitHub repo [CITED: https://github.com/launchdarkly/api-client-java].

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `com.launchdarkly:api-client` | Maven Central | Multi-year (36 versions) | Enterprise SDK | github.com/launchdarkly/api-client-java | N/A (Java) | Approved [VERIFIED: Maven + official repo] |
| `com.squareup.okhttp3:okhttp` | Maven Central | 10+ yrs | Very high | github.com/square/okhttp | N/A (Java) | Approved |
| `com.squareup.okhttp3:mockwebserver` | Maven Central | 10+ yrs | Very high | github.com/square/okhttp | N/A (Java) | Approved |
| `org.jetbrains.kotlinx:kotlinx-coroutines-core` | Maven Central | 8+ yrs | Very high | github.com/Kotlin/kotlinx.coroutines | N/A (Java) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (Java packages not scanned by slopcheck)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────┐
                    │  Worker / API (Phase 11+)           │
                    │  injects FlagProvider               │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │  LaunchDarklyProvider               │
                    │  getFlagState / applyTargeting      │
                    └─────────┬───────────────┬───────────┘
                              │               │
              schedule()      │               │  schedule()
                              ▼               ▼
                    ┌─────────────────────────────────────┐
                    │  RateLimitedLdClient                │
                    │  Semaphore(2) + retry w/ headers    │
                    └─────────┬───────────────┬───────────┘
                              │               │
                     GET      │               │ PATCH (semantic)
                              ▼               ▼
              ┌───────────────────────┐  ┌────────────────────────┐
              │ FeatureFlagsApi       │  │ OkHttp PATCH           │
              │ (api-client)          │  │ Content-Type:          │
              │ GET /api/v2/flags/... │  │ ...semanticpatch       │
              └───────────┬───────────┘  └───────────┬────────────┘
                          │                          │
                          └──────────┬─────────────────┘
                                     ▼
                          ┌──────────────────────┐
                          │ LaunchDarkly REST    │
                          │ app.launchdarkly.com │
                          └──────────────────────┘

applyTargeting flow:
  GET flag → resolve variation/rule IDs → build patch body → PATCH → GET flag (return)
```

### Recommended Project Structure

```
kotlin/
  settings.gradle.kts          # include(":ld-adapter")
  modules/
    contracts/
      src/main/kotlin/com/ffpromo/contracts/
        LaunchDarkly.kt        # NEW — port launchdarkly.ts DTOs
    ld-adapter/
      build.gradle.kts
      src/main/kotlin/com/ffpromo/ldadapter/
        provider/
          FlagProvider.kt
          LaunchDarklyProvider.kt
        client/
          LdApiClient.kt           # api-client factory, constants
          RateLimitedLdClient.kt   # port rate-limited-client.ts
        read/
          GetFlagState.kt
          Mappers.kt
        write/
          ApplyTargeting.kt
          SemanticPatch.kt
        resolve/
          VariationResolver.kt
          RuleResolver.kt
        errors/
          LdAdapterErrors.kt
      src/test/kotlin/com/ffpromo/ldadapter/
        SemanticPatchTest.kt
        VariationResolverTest.kt
        RuleResolverTest.kt
        RateLimitedLdClientTest.kt
        ApplyTargetingTest.kt
        LaunchDarklyProviderIntegrationTest.kt   # MockWebServer — PROV-01/02/03
      src/test/resources/fixtures/
        flag-boolean.json                        # copy from v1
        patch-canary-success.json
        patch-422-invalid.json
        patch-429-retry.json
```

### Pattern 1: Hybrid client factory (match v1)

**What:** Configure `com.launchdarkly.api.ApiClient` with base URL, `Authorization` API key, `LD-API-Version` header — mirror v1 `createLaunchDarklyClient`.

**When:** All LD reads.

**Example:**

```kotlin
// Source: https://github.com/launchdarkly/api-client-java — Authentication section
val apiClient = ApiClient.getDefaultApiClient().apply {
    basePath = config.baseUrl.trimEnd('/')
    setApiKey(config.accessToken)  // Authorization header
    addDefaultHeader("LD-API-Version", config.apiVersion)
}
val flagsApi = FeatureFlagsApi(apiClient)
```

### Pattern 2: Hand-rolled semantic PATCH (match v1)

**What:** OkHttp PATCH to `/api/v2/flags/{projectKey}/{flagKey}` with semantic patch Content-Type.

**When:** All targeting writes (`applyTargeting`).

**Example:**

```kotlin
// Source: https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag
// Source: v1 apply-targeting.ts
const val SEMANTIC_PATCH_CONTENT_TYPE =
    "application/json; domain-model=launchdarkly.semanticpatch"

val request = Request.Builder()
    .url("${config.baseUrl}/api/v2/flags/${encode(projectKey)}/${encode(flagKey)}")
    .patch(body.toRequestBody(SEMANTIC_PATCH_MEDIA_TYPE))
    .header("Authorization", config.accessToken)
    .header("LD-API-Version", config.apiVersion)
    .header("Accept", "application/json")
    .build()
```

### Pattern 3: GET-before-write with resolution (PROV-03)

**What:** `applyTargeting` always reads current flag state, resolves variation/rule refs to LD `_id` values, builds patch, writes, re-reads.

**When:** Every write path — prevents stale ID writes.

**Port map (v1 → Kotlin):**

| v1 file | Kotlin target | Tests to port |
|---------|---------------|---------------|
| `read/mappers.ts` | `read/Mappers.kt` | `mappers.test.ts` |
| `read/get-flag-state.ts` | `read/GetFlagState.kt` | `get-flag-state.test.ts` |
| `resolve/variation-resolver.ts` | `resolve/VariationResolver.kt` | `variation-resolver.test.ts` |
| `resolve/rule-resolver.ts` | `resolve/RuleResolver.kt` | `rule-resolver.test.ts` |
| `write/semantic-patch.ts` | `write/SemanticPatch.kt` | `semantic-patch-builder.test.ts` |
| `write/apply-targeting.ts` | `write/ApplyTargeting.kt` | `apply-targeting.test.ts` |
| `client/rate-limited-client.ts` | `client/RateLimitedLdClient.kt` | `rate-limited-client.test.ts` |
| `provider/launch-darkly-provider.ts` | `provider/LaunchDarklyProvider.kt` | `launch-darkly-provider.test.ts` |

### Pattern 4: Rate limit + retry contract (v1 parity)

**What:** Port v1 defaults: `maxConcurrent = 2`, `retries = 4`, `jitterMs = 500`. Retry on 429 and 5xx; fail-fast on 405 → `ApprovalRequiredError`, 422 no retry. Honor `Retry-After` and `x-ratelimit-reset` headers in delay calculation.

**When:** All LD HTTP via `RateLimitedLdClient.schedule { }`.

### Pattern 5: MockWebServer as nock port

**What:** `@BeforeEach` start `MockWebServer`; configure api-client `basePath = server.url("/").toString().trimEnd('/')`; enqueue GET/PATCH responses; assert request headers (especially PATCH Content-Type).

**When:** Provider integration tests — no live LD credentials.

**Example sketch:**

```kotlin
// Source: https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html
@BeforeEach
fun setUp() {
    server = MockWebServer()
    server.start()
    provider = createLaunchDarklyProvider(
        LaunchDarklyClientConfig(
            accessToken = "test-token",
            baseUrl = server.url("/").toString().removeSuffix("/"),
        ),
    )
}

@Test
fun `PROV-01 reads flag state`() {
    server.enqueue(MockResponse().setResponseCode(200).setBody(flagFixture))
    val state = provider.getFlagState(...)
    assertEquals(2, state.variations.size)
    assertEquals(1, server.requestCount) // all requests consumed
}
```

### Anti-Patterns to Avoid

- **Using server SDK for writes:** Cannot semantic-patch; wrong tool for orchestration [CITED: CLAUDE.md]
- **Skipping GET-before-write:** Breaks PROV-03; v1 tests assert call order explicitly
- **JSON patch instead of semantic patch:** Different Content-Type; LD instruction kinds differ
- **Including `updatePercentageRollout` instruction:** v1 explicitly rejects this kind [VERIFIED: `semantic-patch.ts`]
- **Blocking coroutines on Temporal workflow thread:** Provider used from activities only (Phase 11), not workflow code

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LD GET response parsing | Custom JSON → FlagState | api-client `getFeatureFlag` + `Mappers.kt` | OpenAPI-generated models match LD schema; mappers normalize to contracts |
| HTTP connection pooling | Raw `HttpURLConnection` | OkHttp (via api-client + shared client for PATCH) | Timeouts, interceptors, testability |
| OpenAPI LD client | Copy-paste REST paths | `com.launchdarkly:api-client` | Maintained against LD OpenAPI spec [CITED: api-client-java README] |
| HTTP mock framework | Custom socket server | OkHttp MockWebServer | Battle-tested; header/body inspection |
| Rollout weight math | Ad-hoc percentages | Port `buildRolloutWeights` (thousandths sum to 100_000) | LD API requires thousandths-of-percent weights |
| Runtime flag evaluation | Custom LD polling | — (out of scope) | Orchestrator mutates targeting, does not evaluate flags |

**Key insight:** The valuable hand-rolled code in v1 is **semantic patch body construction** and **rate-limit policy** — not REST plumbing for GET. Keep that split in Kotlin.

## Common Pitfalls

### Pitfall 1: Semantic patch Content-Type omitted

**What goes wrong:** LD treats PATCH as JSON patch; instructions ignored or 422 returned.
**Why it happens:** Generated api-client `patchFeatureFlag` uses `application/json` only.
**How to avoid:** Hand-rolled OkHttp PATCH with full `application/json; domain-model=launchdarkly.semanticpatch` string.
**Warning signs:** Integration test `uses semantic patch content type on PATCH requests` fails.

### Pitfall 2: Variation ref ambiguity

**What goes wrong:** Two variations with same JSON value → patch targets wrong rollout.
**Why it happens:** `resolveVariationId` by `value` uses `JSON.stringify` equality in v1.
**How to avoid:** Port exact equality (`Json.encodeToString` for kotlinx-serialization unknown types); throw `UnresolvedVariationError` unless exactly one match.
**Warning signs:** `variation-resolver.test.ts` ambiguous-match scenario fails.

### Pitfall 3: Rate limit header parsing

**What goes wrong:** Retry too fast → 429 storm; or no retry → flaky promotions.
**Why it happens:** LD sends `Retry-After` (seconds) or `x-ratelimit-reset` (epoch ms).
**How to avoid:** Port `computeRetryDelayMs` logic verbatim including jitter.
**Warning signs:** `429 then 200 retries successfully` integration test fails.

### Pitfall 4: api-client basePath trailing slash

**What goes wrong:** Double slashes or wrong host in MockWebServer tests.
**Why it happens:** v1 normalizes `baseUrl.replace(/\/+$/, '')`.
**How to avoid:** `trimEnd('/')` on config base URL; MockWebServer URL without trailing slash.

### Pitfall 5: Contracts module missing LaunchDarkly types

**What goes wrong:** ld-adapter duplicates DTOs; worker/API drift in Phase 11–12.
**Why it happens:** Phase 8 contracts only ported pipeline/run enums.
**How to avoid:** Wave 0 adds `LaunchDarkly.kt` to `:contracts` with `@Serializable` data classes matching `launchdarkly.ts` wire format.

### Pitfall 6: LD `_id` vs contract `id` mapping

**What goes wrong:** Patch sends wrong variation keys in `rolloutWeights`.
**Why it happens:** LD API returns `_id`; contracts use `id`.
**How to avoid:** `Mappers.kt` maps `_id` → `id` exactly like v1 `mappers.ts`.

## Code Examples

### buildRolloutWeights (port from v1)

```kotlin
// Source: packages/ld-adapter/src/write/semantic-patch.ts
fun buildRolloutWeights(
    treatmentThousandths: Int,
    treatmentVariationId: String,
    controlVariationId: String,
): Map<String, Int> {
    require(treatmentThousandths in 0..100_000)
    val controlThousandths = 100_000 - treatmentThousandths
    val weights = mapOf(
        treatmentVariationId to treatmentThousandths,
        controlVariationId to controlThousandths,
    )
    check(weights.values.sum() == 100_000) { "rollout weights must sum to 100000" }
    return weights
}
```

### FlagProvider interface (port from v1)

```kotlin
// Source: packages/ld-adapter/src/provider/flag-provider.ts
interface FlagProvider {
    suspend fun getFlagState(input: GetFlagStateInput): FlagState
    suspend fun applyTargeting(input: ApplyTargetingInput): FlagState
}
```

Use `suspend` functions with coroutines (Kotlin idiomatic); v1 uses `Promise` — behavior equivalent when called from blocking Temporal activities via `runBlocking` in Phase 11.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm `launchdarkly-api` callback GET | Same via Java `api-client` | v1 Phase 2 / v2 Phase 9 | Parity maintained |
| Hand-rolled `fetch` PATCH | Hand-rolled OkHttp PATCH | v1 pattern continues | Semantic patch header control |
| nock HTTP mocks | MockWebServer | Phase 9 Kotlin | JVM-native equivalent |
| Bottleneck + p-retry | Coroutines Semaphore + custom retry | Phase 9 port | Same retry contract |

**Deprecated/outdated:**
- `@launchdarkly/node-server-sdk` / `launchdarkly-java-server-sdk` for orchestrator: evaluation only, not management API [CITED: CLAUDE.md, api-client-java README]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `com.launchdarkly:api-client:22.0.0` compatible with `LD-API-Version: 20240415` | Standard Stack | GET parsing breaks; pin token API version or downgrade client |
| A2 | api-client `ApiClient` accepts MockWebServer base URL for integration tests | Pattern 5 | May need custom OkHttp client injection on ApiClient |
| A3 | kotlinx `Json` equality matches v1 `JSON.stringify` for variation value refs | Pitfall 2 | Resolver false positives/negatives on complex values |
| A4 | `suspend` FlagProvider callable from Temporal Java activities via `runBlocking` | Code Examples | Activity threading issues in Phase 11 if misused |

## Open Questions

1. **api-client PATCH with semantic Content-Type override**
   - What we know: Generated client defaults to `application/json` for patchFeatureFlag [CITED: FeatureFlagsApi.md]
   - What's unclear: Whether `ApiClient.selectHeaderContentType` or request interceptor can set semantic patch type cleanly
   - Recommendation: **Stick with hand-rolled OkHttp PATCH** (v1 proven path); revisit only if duplicate HTTP clients cause operational pain

2. **api-client version pin vs latest**
   - What we know: Maven latest is 22.0.0 (2026-03 build date in README)
   - Recommendation: Pin `22.0.0` in `gradle.properties`; verify `getFeatureFlag` response shape against v1 fixtures in Wave 1

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| JDK 21+ | Gradle Kotlin compile | ✓ | 25.0.2 (Homebrew) | — |
| Gradle wrapper | `./gradlew build` | ✓ | 8.12.1 | — |
| Docker | Not required for ld-adapter tests | ✓ | — | — |
| Live LaunchDarkly account | Manual validation only | — | — | MockWebServer tests (CI default) |
| ctx7 / Context7 MCP | Doc lookup | ✗ | — | Official GitHub + launchdarkly.com docs used |

**Missing dependencies with no fallback:** none for Phase 9 implementation

**Missing dependencies with fallback:**
- Live LD API → MockWebServer + v1 fixtures

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | JUnit 5.11.4 + kotlin.test |
| Config file | Gradle `tasks.withType<Test> { useJUnitPlatform() }` in root `build.gradle.kts` |
| Quick run command | `cd kotlin && ./gradlew :ld-adapter:test --tests '*Resolver*'` |
| Full suite command | `cd kotlin && ./gradlew :ld-adapter:test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-01 | Read flag variations + environment state | integration (MockWebServer) | `./gradlew :ld-adapter:test --tests '*PROV_01*'` | ❌ Wave 0 |
| PROV-02 | Semantic patch with turnFlagOn + rollout instructions | integration | `./gradlew :ld-adapter:test --tests '*semantic*'` | ❌ Wave 0 |
| PROV-03 | Resolve variation IDs before PATCH; GET-before-write | unit + integration | `./gradlew :ld-adapter:test --tests '*VariationResolver*'` | ❌ Wave 0 |
| PROV-02/03 | Rate limit retry + 405/422 handling | unit | `./gradlew :ld-adapter:test --tests '*RateLimited*'` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `./gradlew :ld-adapter:test --tests '*Resolver*'`
- **Per wave merge:** `./gradlew :ld-adapter:test`
- **Phase gate:** `./gradlew build` (all modules) green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `kotlin/modules/contracts/.../LaunchDarkly.kt` — DTOs for PROV-01–03
- [ ] `kotlin/settings.gradle.kts` — include `:ld-adapter`
- [ ] `kotlin/modules/ld-adapter/build.gradle.kts` — dependencies
- [ ] `src/test/resources/fixtures/*.json` — copy from `packages/ld-adapter/src/__tests__/fixtures/`
- [ ] All test classes listed in Pattern 3 port map

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (outbound) | LD access token in `Authorization` header; never commit tokens |
| V3 Session Management | no | Stateless REST calls |
| V4 Access Control | partial | Adapter does not enforce RBAC; LD token scopes gate write access |
| V5 Input Validation | yes | kotlinx-serialization decode of inputs; reject malformed `TargetingIntent` at boundary |
| V6 Cryptography | no | TLS to LD handled by HTTPS client |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LD access token in logs/errors | Information disclosure | Redact `Authorization` in error messages; structured logging without token fields |
| SSRF via configurable `baseUrl` | Spoofing | Restrict `baseUrl` to LD host allowlist in production config (Phase 11 env validation) |
| Malformed patch body | Tampering | Build patch from typed `TargetingIntent`; no raw user JSON to LD |
| Rate limit exhaustion | DoS (self) | Port v1 concurrency limit (max 2) + retry backoff |

## Implications for Roadmap / Planner

Suggested plan waves:

**Wave 0:** `:contracts` LaunchDarkly DTOs + `:ld-adapter` Gradle module + fixture copy + `./gradlew :ld-adapter:compileKotlin`

**Wave 1:** Mappers, resolvers, semantic patch builder + unit tests (port pure-function tests)

**Wave 2:** LdApiClient factory, RateLimitedLdClient, GetFlagState, ApplyTargeting + unit tests

**Wave 3:** LaunchDarklyProvider + MockWebServer integration tests (PROV-01, PROV-02/03, 422/429/405 scenarios)

**Wave 4:** Export public API surface; `kotlin/README.md` ld-adapter section; verify `pnpm run build:kotlin` includes new module

## Sources

### Primary (HIGH confidence)
- `packages/ld-adapter/src/**` — v1 reference implementation [VERIFIED: codebase]
- https://github.com/launchdarkly/api-client-java — REST client README, FeatureFlagsApi docs [CITED]
- https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag — semantic patch requirements [CITED]
- https://launchdarkly.com/docs/guides/api/rest-api/ — Authorization + semantic patch overview [CITED]
- `.planning/ROADMAP.md` Phase 9 success criteria [VERIFIED]
- `.planning/REQUIREMENTS.md` PROV-01–03 definitions [VERIFIED]

### Secondary (MEDIUM confidence)
- https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html — MockWebServer for client testing [CITED]
- Maven Central metadata for `com.launchdarkly:api-client`, OkHttp 4.12.0 [VERIFIED: curl repo1.maven.org]

### Tertiary (LOW confidence)
- Spring WebClient + MockWebServer Kotlin blog patterns — applicable pattern, not project-specific [CITED: journeytoawebapp.com]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — v1 proven hybrid; official LD REST docs confirm semantic patch header
- Architecture: HIGH — 1:1 file port map from v1 with clear module boundaries
- Pitfalls: HIGH — derived from v1 test suite edge cases and LD API docs

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (api-client version may move monthly)

---
*Research completed for `/gsd-plan-phase --research-phase 9`*
