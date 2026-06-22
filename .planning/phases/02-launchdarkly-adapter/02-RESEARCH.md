# Phase 2: LaunchDarkly Adapter - Research

**Researched:** 2026-06-21
**Domain:** LaunchDarkly REST API adapter (semantic patch, variation/rule ID resolution, rate limiting)
**Confidence:** HIGH

## Summary

Phase 2 delivers `packages/ld-adapter`: a provider adapter that reads flag state from LaunchDarkly and writes targeting changes via **semantic patch** on `PATCH /api/v2/flags/{projectKey}/{featureFlagKey}`. The adapter sits between the Temporal worker (Phase 4) and LaunchDarkly; Phase 1 already provides persistence and workflow scaffolding but has **no LD activities yet**.

Official LaunchDarkly documentation confirms three properties that must drive the design:

1. **Semantic patches are atomic** — all instructions apply or none do; invalid instructions return an error with **no flag mutation** [CITED: launchdarkly.com/docs/api#updates-using-semantic-patch].
2. **Percentage rollouts use `updateFallthroughVariationOrRollout` / `updateRuleVariationOrRollout`** with `rolloutWeights` in thousandths of a percent (100000 = 100%, must sum to 100000) — there is **no** `updatePercentageRollout` instruction in the current API [CITED: launchdarkly.com/docs/api/feature-flags/patch-feature-flag].
3. **Rate limits are account-global and route-level** (10-second windows); 429 responses require honoring `Retry-After` / `X-Ratelimit-Reset` with backoff and jitter — never tight retry loops [CITED: launchdarkly.com/docs/api#rate-limiting].

Variation `_id` values are **project-scoped** (same across environments within a project) [CITED: launchdarkly.com/docs/home/flags/variations]. Rule `_id` values are **environment-scoped** (inside `environments[envKey].rules`). PROV-03 resolution therefore means: always **GET the flag before writes**, map logical promotion intent (variation value/name/index, rule description/key) to current `_id`s for the **target environment**, and reject writes when IDs cannot be resolved.

**Primary recommendation:** Implement a `FlagProvider` interface in `packages/ld-adapter` using `launchdarkly-api@20.0.0` for typed GET/PATCH, a dedicated `VariationResolver` + `RuleResolver` fed by GET responses, semantic-patch builders that batch `turnFlagOn` + rollout instructions in one call, and a shared `RateLimitedLdClient` wrapping all HTTP with `bottleneck` + `p-retry` (429-only retries).

## Project Constraints (from CLAUDE.md)

- **Integration:** LaunchDarkly as first provider adapter — do not use `@launchdarkly/node-server-sdk` for orchestration writes [CITED: launchdarkly.com/docs/guides/api/rest-api].
- **Failure mode:** Pause-and-alert on breach — adapter must not auto-rollback flag targeting.
- **Promotion model:** Environment-based progression; adapter writes per-environment targeting only.
- **Stack lock:** `launchdarkly-api@20.0.0`, `LD-API-Version: 20240415`, semantic patch header on all writes.
- **Monorepo layout:** `packages/ld-adapter` per STACK.md; worker consumes adapter via activities in Phase 4.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | System reads flag state from LaunchDarkly (variations, targeting rules, environment) | `getFeatureFlag` returns `variations[]`, `environments[envKey]` with `on`, `rules`, `fallthrough`, `targets`; map to internal `FlagState` DTO in `packages/contracts` |
| PROV-02 | System writes targeting updates to LaunchDarkly via semantic patch API | `patchFeatureFlag` with `Content-Type: application/json; domain-model=launchdarkly.semanticpatch`; batch instructions; include `comment` for audit correlation |
| PROV-03 | System resolves LaunchDarkly variation IDs per environment before promotion writes | Pre-write GET + `VariationResolver` (value/name/index → `_id`) + `RuleResolver` (env-scoped `ruleId`); fail closed if unresolved |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Flag state read (GET) | **Adapter (`packages/ld-adapter`)** | Worker activity (Phase 4) | External HTTP to LD; adapter owns API semantics and mapping |
| Semantic patch write | **Adapter** | Worker activity | Only adapter mutates LD; worker passes domain intent |
| Variation/rule ID resolution | **Adapter** | Contracts (types only) | Resolution requires live GET response; not a DB concern |
| Rate limit / retry | **Adapter** | — | All LD calls must share one limiter per token/account |
| Promotion orchestration | Worker (Phase 4) | — | Out of scope for Phase 2; adapter exposes primitives only |
| Audit trail of LD writes | Worker + DB (Phase 1) | Adapter returns request metadata | Adapter logs correlation ID; `recordAuditEvent` persists |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `launchdarkly-api` | 20.0.0 | Generated OpenAPI client (`FeatureFlagsApi.getFeatureFlag`, `patchFeatureFlag`) | Official LD REST client; matches pinned API version [VERIFIED: npm registry + LD README in package tarball] |
| `zod` | 4.4.3 | Validate env config, map LD payloads to `@ff-promo/contracts` types | Already in monorepo; single validation layer |
| TypeScript | ~5.8.3 | Adapter implementation | Monorepo standard |
| Vitest | 4.1.9 | Unit + contract tests | Phase 1 harness |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bottleneck` | 2.19.5 | Token-bucket / concurrency limiter for LD API | Serialize PATCH calls; cap concurrent GETs |
| `p-retry` | 8.0.0 | Retry with backoff on 429 (and transient 409) | Wrap each LD HTTP call inside limiter |
| `nock` | 14.0.15 | HTTP mocking in tests | Recorded GET/PATCH fixtures without live LD account |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `launchdarkly-api` | Raw `fetch` + OpenAPI types | More control over semantic-patch `Content-Type`; loses generated method signatures; more maintenance |
| `bottleneck` | In-process mutex + manual sleep | Reinvents rate limiting; no queue observability |
| `nock` | Live LD sandbox integration tests | Flaky, needs secrets in CI; reserve for optional manual/e2e lane |

**Installation (in `packages/ld-adapter`):**

```bash
pnpm add launchdarkly-api@20.0.0 bottleneck@2.19.5 p-retry@8.0.0
pnpm add -D nock@14.0.15
```

**Version verification (2026-06-21):**

```bash
npm view launchdarkly-api version   # 20.0.0 (modified 2026-02-03)
npm view bottleneck version         # 2.19.5
npm view p-retry version            # 8.0.0
npm view zod version                # 4.4.3
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `launchdarkly-api` | npm | ~7 yrs (pkg since 2018) | High (official) | OpenAPI-generated; npm lacks `repository` field | OK | Approved — official LD client [CITED: launchdarkly.com/docs/api] |
| `bottleneck` | npm | ~8 yrs | High | github.com/SGrondin/bottleneck | OK | Approved |
| `p-retry` | npm | ~8 yrs | High | github.com/sindresorhus/p-retry | OK | Approved |
| `zod` | npm | ~6 yrs | Very high | github.com/colinhacks/zod | OK | Approved (already in repo) |
| `nock` | npm | ~12 yrs | High | github.com/nock/nock | Not scanned | Approved — standard Node HTTP mock [ASSUMED] |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**Note:** STACK.md and CLAUDE.md reference `updatePercentageRollout` and `updateRule` — these instruction kinds **do not exist** in the current semantic patch API. Planner must use `updateFallthroughVariationOrRollout` and `updateRuleVariationOrRollout` instead [CITED: launchdarkly.com/docs/api/feature-flags/patch-feature-flag].

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Temporal Worker (Phase 4)                     │
│  applyFlagStage activity ──► FlagProvider.applyTargeting()     │
│  readFlagState activity  ──► FlagProvider.getFlagState()       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                   packages/ld-adapter                            │
│  ┌──────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ FlagProvider │  │ VariationResolver│  │ SemanticPatchBuilder│ │
│  │  (interface) │──│ RuleResolver     │──│ (batch instructions)│ │
│  └──────┬───────┘  └────────▲─────────┘  └──────────┬──────────┘ │
│         │                   │ GET fresh state         │          │
│  ┌──────▼───────────────────┴─────────────────────────▼────────┐ │
│  │              RateLimitedLdClient                             │ │
│  │   bottleneck queue → p-retry (429/409) → FeatureFlagsApi    │ │
│  └──────────────────────────────┬───────────────────────────────┘ │
└─────────────────────────────────┼───────────────────────────────┘
                                  │ HTTPS
                                  ▼
                    ┌─────────────────────────────┐
                    │  LaunchDarkly REST API v2    │
                    │  GET  /flags/{proj}/{key}    │
                    │  PATCH (semantic patch)      │
                    └─────────────────────────────┘
```

### Recommended Project Structure

```
packages/ld-adapter/
├── src/
│   ├── index.ts                    # Public exports
│   ├── provider/
│   │   ├── flag-provider.ts        # FlagProvider interface
│   │   └── launch-darkly-provider.ts
│   ├── client/
│   │   ├── ld-api-client.ts        # ApiClient setup, headers, base URL
│   │   └── rate-limited-client.ts  # bottleneck + p-retry wrapper
│   ├── read/
│   │   ├── get-flag-state.ts       # GET + normalize to FlagState
│   │   └── mappers.ts              # LD JSON → contracts types
│   ├── write/
│   │   ├── semantic-patch.ts       # Patch body types + builders
│   │   └── apply-targeting.ts      # resolve IDs → patch → PATCH
│   ├── resolve/
│   │   ├── variation-resolver.ts   # value | name | index → _id
│   │   └── rule-resolver.ts        # env + ruleRef → ruleId
│   └── errors/
│       └── ld-adapter-error.ts     # Typed errors (rate limit, unresolved ID, 422)
├── src/__tests__/
│   ├── fixtures/                   # Recorded GET/PATCH JSON
│   ├── variation-resolver.test.ts
│   ├── semantic-patch-builder.test.ts
│   ├── rate-limited-client.test.ts
│   └── launch-darkly-provider.test.ts
├── package.json
└── tsconfig.json
```

### Pattern 1: Read-Before-Write with Normalized FlagState

**What:** Every write path starts with `getFeatureFlag(projectKey, flagKey)` and maps the response to an internal `FlagState` containing variations, per-environment targeting (on/off, rules, fallthrough rollout, targets).

**When to use:** All PROV-02/PROV-03 writes; reconciliation reads (Phase 4 drift detection).

**Example:**

```typescript
// Source: https://launchdarkly.com/docs/api/feature-flags/get-feature-flag
// Variation _id: flag.variations[n]._id
// Rule _id: flag.environments[envKey].rules[n]._id

interface FlagState {
  projectKey: string;
  flagKey: string;
  variations: Array<{ id: string; name?: string; value: unknown }>;
  environments: Record<
    string,
    {
      on: boolean;
      rules: Array<{ id: string; description?: string; clauses: unknown[]; variationOrRollout: unknown }>;
      fallthrough: unknown;
      offVariation?: number;
    }
  >;
}
```

### Pattern 2: Atomic Semantic Patch Batching

**What:** Combine stage transitions into one PATCH: e.g. `turnFlagOn` + `updateFallthroughVariationOrRollout` with `rolloutWeights` in a single `instructions` array.

**When to use:** Canary/stagger percentage changes; environment entry (turn on + set 0% or pre-release rule).

**Example:**

```typescript
// Source: https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag
// Source: https://github.com/launchdarkly/ai-tooling/.../targeting-patterns.md

const patchBody = {
  environmentKey: 'production',
  comment: 'ff-promo run abc123 stage canary-10pct',
  instructions: [
    { kind: 'turnFlagOn' },
    {
      kind: 'updateFallthroughVariationOrRollout',
      rolloutContextKind: 'user',
      rolloutBucketBy: 'key', // sticky bucketing — required for meaningful rollout metrics
      rolloutWeights: {
        [treatmentVariationId]: 10_000,  // 10%
        [controlVariationId]: 90_000,  // 90% — must sum to 100_000
      },
    },
  ],
};

// Headers required:
// Authorization: <token>
// LD-API-Version: 20240415
// Content-Type: application/json; domain-model=launchdarkly.semanticpatch
```

### Pattern 3: VariationResolver + RuleResolver (PROV-03)

**What:** Promotion engine passes **logical** references (e.g. `{ by: 'value', value: true }` or `{ by: 'name', name: 'enabled' }`). Resolver converts to `_id` using the latest GET payload. Rule references resolve against `environments[targetEnv].rules` only.

**When to use:** Before building any semantic patch that references `variationId` or `ruleId`.

**Rules:**

| ID type | Scope | Resolution source |
|---------|-------|-------------------|
| Variation `_id` | Project (same all envs) | `flag.variations[]` — map by `_id`, `value`, `name`, or index |
| Rule `_id` | Per environment | `flag.environments[envKey].rules[]._id` only |
| Clause `_id` | Per environment + rule | `rules[].clauses[]._id` |

**Fail closed:** If logical ref doesn't match exactly one variation, throw `UnresolvedVariationError` — do not PATCH.

### Pattern 4: Centralized Rate Limiting

**What:** Single `Bottleneck` instance per LD access token (minTime + maxConcurrent), wrapping all GET/PATCH. On 429, read `Retry-After` (seconds) or `X-Ratelimit-Reset` (epoch ms), sleep, retry with jitter via `p-retry` (max 3–5 attempts).

**When to use:** Every LD HTTP call.

**Example:**

```typescript
// Source: https://launchdarkly.com/docs/api#rate-limiting
// Source: https://support.launchdarkly.com/hc/en-us/articles/22328238491803

async function withLdRetry<T>(fn: () => Promise<T>): Promise<T> {
  return pRetry(fn, {
    retries: 4,
    onFailedAttempt: (err) => {
      if (!isRateLimitError(err)) throw err; // don't retry 4xx except 429
      const retryAfterMs = parseRetryAfter(err.response?.headers);
      // honor Retry-After before next attempt + random jitter 0–500ms
    },
  });
}
```

### Anti-Patterns to Avoid

- **JSON Patch for targeting:** Fragile `_id` paths; breaks when rules reorder. Use semantic patch only for targeting writes [CITED: PITFALLS.md Integration Gotchas].
- **Separate PATCH for on + rollout:** Non-atomic; partial failure leaves flag on with stale percentage. Batch in one semantic patch.
- **Caching variation IDs across promotion runs without re-GET:** Variations can be added/removed at project level; always refresh before write.
- **Reusing staging `ruleId` in prod:** Rule IDs differ per environment — always resolve from target env GET.
- **Immediate retry on 429:** Causes retry storms [CITED: launchdarkly.com/docs/guides/api/rest-api].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LD HTTP client | Custom axios wrapper from scratch | `launchdarkly-api` + thin header config | OpenAPI-aligned; tracks API surface |
| Semantic patch grammar | Ad-hoc JSON objects | Typed builders + LD docs instruction kinds | 422 on invalid kind/params; atomicity rules |
| Rate limiting | `setTimeout` loop on 429 | `bottleneck` + `p-retry` + response headers | Global + route limits shared across tokens |
| Flag evaluation at runtime | `@launchdarkly/node-server-sdk` in worker | REST adapter only | SDK evaluates flags; cannot semantic-patch targeting |
| Rollout percentage math | Float percentages in API | Integer thousandths summing to 100000 | LD API contract |

**Key insight:** Semantic patch atomicity is the safety rail — if variation IDs are wrong, the entire PATCH fails and flag state stays unchanged [CITED: launchdarkly.com/docs/api#updates-using-semantic-patch]. Combine this with read-before-write so invalid IDs are caught in resolver **before** network call when possible.

## Common Pitfalls

### Pitfall 1: Wrong Semantic Patch Instruction Names

**What goes wrong:** Code sends `updatePercentageRollout` (from stale STACK.md) → 422 Unprocessable Entity.

**Why it happens:** Training data and project docs use abbreviated names; official API uses `updateFallthroughVariationOrRollout` / `updateRuleVariationOrRollout`.

**How to avoid:** Generate patch builders from official instruction list; unit test serializes known kinds.

**Warning signs:** 422 responses; `invalid_request` code in LD error body.

### Pitfall 2: Stale Rule IDs After Environment Copy

**What goes wrong:** PATCH references `ruleId` from staging when writing prod → error or wrong rule updated.

**Why it happens:** Rule `_id` is per-environment in GET response.

**How to avoid:** `RuleResolver` always reads `environments[targetEnvKey].rules`; never persist rule IDs cross-env.

**Warning signs:** 422 on `updateRuleVariationOrRollout`; audit shows wrong environment targeting.

### Pitfall 3: Rollout Weights Not Summing to 100000

**What goes wrong:** PATCH rejected; canary percentage silently fails to apply.

**Why it happens:** LD uses thousandths-of-percent scale; off-by-one or float math.

**How to avoid:** `buildRolloutWeights(treatmentPct, treatmentId, controlId)` helper with integer math and assertion `sum === 100_000`.

**Warning signs:** 422; integration test fixture mismatch.

### Pitfall 4: Missing `rolloutBucketBy` (Non-Sticky Rollout)

**What goes wrong:** Users flicker variants; telemetry gates meaningless (PITFALLS #9).

**Why it happens:** Default fallthrough rollout without bucket attribute.

**How to avoid:** Require `rolloutBucketBy` + `rolloutContextKind` in pipeline/adapter config; reject promotion writes without bucket field.

**Warning signs:** Unstable cohort metrics; SRM warnings in LD.

### Pitfall 5: 429 Retry Storm

**What goes wrong:** Concurrent promotions stall; some writes succeed others fail → split state.

**Why it happens:** Worker + reconciliation polling without shared limiter.

**How to avoid:** Process-wide `RateLimitedLdClient` singleton per token; honor `Retry-After`; cache GETs with short TTL (30–60s) for read-heavy paths.

**Warning signs:** Log spam with 429; increasing `X-Ratelimit-Global-Remaining` depletion.

### Pitfall 6: Missing Semantic Patch Content-Type

**What goes wrong:** Body interpreted as JSON Patch array → 400/422.

**Why it happens:** Default `Content-Type: application/json` on generated client.

**How to avoid:** Set default header on `ApiClient`: `application/json; domain-model=launchdarkly.semanticpatch` for PATCH calls only, or use `callApi` override.

**Warning signs:** 400 with patch parse errors on valid semantic body.

### Pitfall 7: Using SDK Keys for REST Writes

**What goes wrong:** 401/403 on PATCH.

**Why it happens:** SDK/mobile keys are read-only, env-scoped [CITED: launchdarkly.com/docs/guides/api/rest-api].

**How to avoid:** Service token with Writer role; validate token type at adapter init.

**Warning signs:** Auth errors only on PATCH, not GET.

## Code Examples

### Configure launchdarkly-api Client

```typescript
// Source: launchdarkly-api@20.0.0 README (npm tarball)
// Source: https://launchdarkly.com/docs/guides/api/rest-api

import LaunchDarklyApi from 'launchdarkly-api';

const client = LaunchDarklyApi.ApiClient.instance;
client.authentications['ApiKey'].apiKey = process.env.LD_ACCESS_TOKEN;
client.defaultHeaders['LD-API-Version'] = '20240415';

// For semantic patch writes — set per PATCH or via callApi opts:
const SEMANTIC_PATCH_CONTENT_TYPE =
  'application/json; domain-model=launchdarkly.semanticpatch';

const flagsApi = new LaunchDarklyApi.FeatureFlagsApi();
```

### Read Flag State

```typescript
// Source: https://launchdarkly.com/docs/api/feature-flags/get-feature-flag

const flag = await flagsApi.getFeatureFlag(projectKey, flagKey);
// flag.variations[]._id — project-wide
// flag.environments[envKey].on, .rules, .fallthrough, .targets
```

### Apply Canary Rollout (PROV-02)

```typescript
// Source: https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag

await flagsApi.patchFeatureFlag(
  projectKey,
  flagKey,
  {
    comment: `ff-promo:${runId}:${stageKey}`,
    environmentKey: targetEnv,
    instructions: [
      { kind: 'turnFlagOn' },
      {
        kind: 'updateFallthroughVariationOrRollout',
        rolloutContextKind: 'user',
        rolloutBucketBy: 'key',
        rolloutWeights: {
          [treatmentId]: 5_000,   // 5% canary
          [controlId]: 95_000,
        },
      },
    ],
  },
  { headers: { 'Content-Type': SEMANTIC_PATCH_CONTENT_TYPE } },
);
```

### Resolve Variation by Value (PROV-03)

```typescript
// Source: https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag
// "The variation ID is the _id field in each element of the variations array"

function resolveVariationId(
  variations: Array<{ _id: string; value: unknown; name?: string }>,
  ref: { by: 'value'; value: unknown } | { by: 'name'; name: string } | { by: 'id'; id: string },
): string {
  const matches =
    ref.by === 'id'
      ? variations.filter((v) => v._id === ref.id)
      : ref.by === 'name'
        ? variations.filter((v) => v.name === ref.name)
        : variations.filter((v) => JSON.stringify(v.value) === JSON.stringify(ref.value));

  if (matches.length !== 1) {
    throw new Error(`Unresolved variation: expected 1 match, got ${matches.length}`);
  }
  return matches[0]._id;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON Patch for flag targeting | Semantic patch instructions | LD semantic patch GA (see [Announcing Semantic Patch](https://launchdarkly.com/blog/announcing-semantic-patch/)) | Use intent-based instructions; atomic batches |
| Unversioned REST API | `LD-API-Version: 20240415` header | 2024-04-15 API version | Paginated list endpoints; pin header on every call |
| `updatePercentageRollout` (docs/training shorthand) | `updateFallthroughVariationOrRollout` / `updateRuleVariationOrRollout` | Current patch-feature-flag spec | Update STACK.md during Phase 2 execution |
| Per-request LD polling without limits | Header-driven rate limit + backoff | Current API spec | Mandatory shared limiter in adapter |

**Deprecated/outdated:**

- `@launchdarkly/node-server-sdk` for promotion control — evaluation only [CITED: launchdarkly.com/docs/guides/api/rest-api].
- JSON Patch paths referencing environment rule indices — use semantic patch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `launchdarkly-api` CJS package works in ESM monorepo via default import / `createRequire` | Standard Stack | Build failure; fallback to fetch wrapper |
| A2 | `patchFeatureFlag` opts accept per-request `Content-Type` override | Code Examples | Must use lower-level `callApi` if opts insufficient |
| A3 | Optional LD sandbox project available for manual verification | Environment Availability | CI relies on nock fixtures only |
| A4 | Promotion v1 targets fallthrough percentage rollout (not rule-specific rollouts) | Architecture | Need `updateRuleVariationOrRollout` if pipelines target custom rules |

## Open Questions (RESOLVED)

1. **Which rollout surface does v1 target — fallthrough only or a named rule?** — **RESOLVED**
   - What we know: Most canary patterns use fallthrough; custom rules need `ruleId` per env.
   - Decision: v1 adapter supports fallthrough (default) + optional `ruleRef` resolver when `rollout.mode` is `rule`; pipeline config selects mode in Phase 4. Locked in contracts `RolloutIntentSchema` and plan 02-03 applyTargeting.

2. **EU/Federal LD base URL?** — **RESOLVED**
   - What we know: Commercial default `https://app.launchdarkly.com`; EU `https://app.eu.launchdarkly.com`; Federal `https://app.launchdarkly.us` [CITED: launchdarkly.com/docs/api].
   - Decision: `LD_BASE_URL` env var on adapter with default commercial; overridable via `LaunchDarklyClientConfig.baseUrl`. Locked in plan 02-01 client factory and `.env.example`.

3. **Approval-required environments (405)?** — **RESOLVED**
   - What we know: PATCH fails with 405 when env requires approvals [CITED: patch-feature-flag docs].
   - Decision: Map 405 to typed `ApprovalRequiredError`; defer approval-request workflow to v2. Locked in plan 02-01 error hierarchy and plan 02-03 rate-limited client.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | ✓ | v25.9.0 (>=24 required) | — |
| pnpm | Monorepo | ✓ | 10.33.0 | — |
| Docker | Phase 1 testcontainers | ✓ | 27.0.3 | — |
| LaunchDarkly account + Writer token | Integration/manual tests | ✗ (not probed) | — | nock HTTP fixtures in CI |
| `launchdarkly-api` installed | Phase 2 | ✗ | — | Wave 0 `pnpm add` in ld-adapter |
| `packages/ld-adapter` | Phase 2 | ✗ (not created) | — | Create in Wave 0 |

**Missing dependencies with no fallback:**

- None for CI — nock-based tests suffice if fixtures cover PROV-01–03 behaviors.

**Missing dependencies with fallback:**

- Live LaunchDarkly project — optional manual test lane with `LD_ACCESS_TOKEN` env var.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `/vitest.config.ts` (add `ld-adapter` project) |
| Quick run command | `pnpm exec vitest run --project ld-adapter` |
| Full suite command | `pnpm test` (turbo all packages) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-01 | GET maps variations, rules, env on/off to FlagState | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/get-flag-state.test.ts -x` | ❌ Wave 0 |
| PROV-01 | Parser handles multivariate + boolean flags | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/mappers.test.ts -x` | ❌ Wave 0 |
| PROV-02 | Semantic patch batches turnFlagOn + rollout weights | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/semantic-patch-builder.test.ts -x` | ❌ Wave 0 |
| PROV-02 | PATCH sends semantic Content-Type header | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/launch-darkly-provider.test.ts -x` | ❌ Wave 0 |
| PROV-03 | Resolve variation by value/name/id | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/variation-resolver.test.ts -x` | ❌ Wave 0 |
| PROV-03 | Reject ambiguous/unresolved variation | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/variation-resolver.test.ts -x` | ❌ Wave 0 |
| PROV-03 | Rule IDs resolved from target env only | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/rule-resolver.test.ts -x` | ❌ Wave 0 |
| PROV-02/03 | 429 retry honors backoff, no tight loop | unit | `pnpm exec vitest run --project ld-adapter src/__tests__/rate-limited-client.test.ts -x` | ❌ Wave 0 |
| PROV-02 | Invalid patch returns error without partial apply | unit | nock returns 422 → assert no second PATCH | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm exec vitest run --project ld-adapter`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Create `packages/ld-adapter` package shell + `tsconfig.json`
- [ ] Add vitest project `{ name: "ld-adapter", root: "./packages/ld-adapter" }` to `vitest.config.ts`
- [ ] Install `launchdarkly-api`, `bottleneck`, `p-retry`, `nock`
- [ ] Add `@ff-promo/contracts` types for `FlagState`, `TargetingIntent`, `SemanticPatchInstruction`
- [ ] Create JSON fixtures from LD doc examples (`src/__tests__/fixtures/`)
- [ ] Wire `turbo.json` test dependency for ld-adapter

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | LD access token via env/secret manager; never in dashboard/CLI |
| V3 Session Management | no | Service token only; no sessions |
| V4 Access Control | yes | Least-privilege Writer token scoped to target project/env |
| V5 Input Validation | yes | Zod validate env config + patch payloads before HTTP |
| V6 Cryptography | no | TLS to LD API (HTTPS minimum TLS 1.2) [CITED: launchdarkly.com/docs/api] |

### Known Threat Patterns for LD Adapter

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LD token exfiltration from logs | Spoofing/Tampering | Redact `Authorization` in logs; structured errors without token |
| Over-privileged API token | Elevation | Env-scoped tokens; separate read vs write tokens when possible |
| Unvalidated patch payloads | Tampering | Resolver + Zod schema for instruction kinds/weight sums |
| Rate-limit DoS on shared token | Denial of Service | Shared limiter; circuit-break after N consecutive 429s |

## Sources

### Primary (HIGH confidence)

- [LaunchDarkly REST API overview](https://launchdarkly.com/docs/api) — semantic patch atomicity, rate limiting headers, versioning
- [LaunchDarkly REST API guide](https://launchdarkly.com/docs/guides/api/rest-api) — headers, 429 guidance
- [Patch feature flag](https://launchdarkly.com/docs/api/feature-flags/patch-feature-flag) — instruction kinds, variation/rule ID locations, rollout weights
- [Creating flag variations](https://launchdarkly.com/docs/home/flags/variations) — variations project-scoped across environments
- `launchdarkly-api@20.0.0` npm tarball README — client setup, `FeatureFlagsApi` methods

### Secondary (MEDIUM confidence)

- [LaunchDarkly 429 support article](https://support.launchdarkly.com/hc/en-us/articles/22328238491803) — Retry-After behavior
- [LD targeting patterns (ai-tooling)](https://github.com/launchdarkly/ai-tooling/blob/main/skills/feature-flags/launchdarkly-flag-targeting/references/targeting-patterns.md) — batching, weight scale
- `.planning/research/PITFALLS.md` — split-brain, rate storms, sticky bucketing
- `.planning/research/ARCHITECTURE.md` — FlagProvider adapter boundary

### Tertiary (LOW confidence)

- None marked for execution without verification

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — verified against npm + official LD docs + slopcheck
- Architecture: **HIGH** — aligns with Phase 1 worker scaffold and ARCHITECTURE.md adapter tier
- Pitfalls: **HIGH** — official API + project PITFALLS cross-check; instruction name correction verified via grep of patch-feature-flag spec

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (30 days — LD API stable; verify on `launchdarkly-api` minor bumps)
