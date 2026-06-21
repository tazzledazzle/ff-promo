# Stack Research

**Domain:** Feature flag promotion orchestration (telemetry-gated, LaunchDarkly adapter)
**Researched:** 2026-06-20
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **TypeScript** | 5.8.x (pin; avoid 6.x until ecosystem catches up) | Single language across API, worker, CLI, dashboard, shared contracts | Platform tools with four surfaces need shared Zod schemas and typed clients; TypeScript monorepos are the 2025–2026 default for internal developer platforms | HIGH |
| **Node.js** | 24.x LTS ("Krypton") | Runtime for all services | Active LTS through April 2028; npm 11, stable `--experimental-strip-types`; Node 22 is maintenance-only | HIGH |
| **pnpm** | 10.x | Workspace package manager | Strict dependency boundaries, fast installs, `workspace:` protocol for monorepo packages | HIGH |
| **Turborepo** | 2.9.18 | Build/test/lint orchestration | Caches CI tasks across `apps/*` and `packages/*`; standard for multi-app TypeScript repos | HIGH |
| **Temporal** | Server: 1.27+ / TS SDK `@temporalio/*` 1.18.1 | Durable promotion workflow engine | Promotion pipelines span hours (pre-release → canary → stagger) with pause-on-breach; Temporal gives durable timers, replay-safe state, and signal-based pause/resume — the standard for long-running orchestration in 2025 | HIGH |
| **Fastify** | 5.8.5 | REST API server | Schema-first validation, OpenAPI generation, low overhead; production default over Express for new Node APIs | HIGH |
| **PostgreSQL** | 16+ | System of record | Pipeline configs, guardrails, promotion history, audit log, API keys; relational model fits RBAC + audit requirements | HIGH |
| **Prisma** | 7.8.0 | ORM + migrations | Type-safe queries, migration workflow, good DX for platform config tables; widely adopted in TypeScript backends | HIGH |
| **Next.js (App Router)** | 16.2.9 | Web dashboard | Server Components for pipeline status pages, streaming for telemetry widgets, Route Handlers as BFF; de facto standard for internal ops dashboards in 2025–2026 | HIGH |
| **React** | 19.2.7 | Dashboard UI | Pairs with Next.js 16; concurrent features for live promotion status | HIGH |
| **LaunchDarkly REST API** (`launchdarkly-api`) | 20.0.0 | Provider adapter (reads + writes) | Orchestrator mutates flag targeting via REST semantic patch (`updatePercentageRollout`, `turnFlagOn`, etc.); generated client matches OpenAPI spec | HIGH |
| **Prometheus HTTP API** | PromQL via `/api/v1/query` | Telemetry gate adapter (v1) | Error-rate and latency SLO gates are industry-standard PromQL patterns; Argo Rollouts, deployment gates, and SLO tools all query Prometheus the same way | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **Zod** | 4.4.3 | Runtime validation + shared schemas | API request/response bodies, guardrail config, CLI flags, env parsing; single source of truth in `packages/contracts` | HIGH |
| **@fastify/swagger** + **@fastify/swagger-ui** | 9.7.0 / latest | OpenAPI spec + docs | Auto-generate API docs from Zod schemas via `@fastify/type-provider-zod` 1.0.0 | HIGH |
| **@temporalio/workflow**, **@temporalio/worker**, **@temporalio/client** | 1.18.1 | Workflow definitions, worker, API triggers | Worker runs promotion workflows; API starts/signals workflows on promote/pause/resume | HIGH |
| **Commander** | 15.0.0 | CLI framework | 5–12 subcommands (`promote`, `status`, `pause`, `resume`, `pipelines`); lighter than oclif for v1 scope | HIGH |
| **openapi-fetch** | 0.17.0 | Typed fetch client | Generate typed client from OpenAPI for CLI → API calls; shares types with dashboard | MEDIUM |
| **@tanstack/react-query** | 5.101.0 | Dashboard data fetching | Poll pipeline/telemetry state with cache + refetch; pairs with Next.js RSC initial load | HIGH |
| **shadcn/ui** + **Tailwind CSS** v4 | shadcn 0.9.5 | Dashboard component library | Accessible ops UI (tables, dialogs, badges for pipeline states); standard for internal tools | HIGH |
| **Recharts** | 3.8.1 | Telemetry charts | Error-rate and latency time-series in promotion detail views | MEDIUM |
| **Better Auth** | 1.6.20 | Dashboard authentication | Self-hosted sessions + RBAC hooks for platform-engineer vs developer roles; verify auth in Route Handlers, not middleware-only | MEDIUM |
| **@slack/webhook** | 7.0.9 | Alerting (v1) | Pause-on-breach notifications to `#releases` or on-call channel | HIGH |
| **@opentelemetry/sdk-node** | 0.219.0 | Orchestrator observability | Trace promotion steps, LD API calls, PromQL queries; export to existing observability stack | HIGH |
| **prom-client** | 15.1.3 | Orchestrator metrics | Expose `/metrics` for pipeline counts, gate failures, LD API latency | HIGH |
| **Vitest** | 4.1.9 | Unit + integration tests | Fast TS-native testing across packages; `@temporalio/testing` for workflow tests | HIGH |
| **testcontainers** | latest | Integration tests | Spin up PostgreSQL + Temporal dev dependencies in CI | MEDIUM |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Temporal CLI** (`temporal`) | Local dev server + workflow debugging | `temporal server start-dev` for local worker development |
| **Docker Compose** | Local stack | PostgreSQL + Temporal dev server + API + worker + web |
| **Biome** or **ESLint + Prettier** | Lint/format | Biome is faster for monorepos; pick one, enforce via Turborepo |
| **Changesets** | Versioning | If publishing CLI to npm or internal registry |
| **GitHub Actions** | CI | `turbo run test lint build --filter=...[origin/main]` |

## Monorepo Layout

```
ff-promo/
├── apps/
│   ├── api/          # Fastify REST API (starts/signals Temporal workflows)
│   ├── worker/       # Temporal worker (promotion + gate activities)
│   ├── web/          # Next.js dashboard
│   └── cli/          # Commander CLI (wraps API)
├── packages/
│   ├── contracts/    # Zod schemas, shared types, OpenAPI types
│   ├── db/           # Prisma schema + client
│   ├── ld-adapter/   # LaunchDarkly REST adapter (semantic patch)
│   ├── telemetry/    # Prometheus query adapter (error rate, p95 latency)
│   └── ui/           # Shared shadcn components (optional)
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.yml
```

**Why this layout:** Keeps provider adapters swappable (v2 multi-provider), lets CLI and dashboard share contracts, and isolates durable workflow logic in the worker where it belongs.

## Installation

```bash
# Workspace root
corepack enable
pnpm init

# Core runtime
pnpm add -w typescript@~5.8.0 turbo@2.9.18

# API (apps/api)
pnpm add fastify@5.8.5 @fastify/swagger@9.7.0 @fastify/type-provider-zod@1.0.0 zod@4.4.3
pnpm add @temporalio/client@1.18.1
pnpm add -D @types/node

# Worker (apps/worker)
pnpm add @temporalio/worker@1.18.1 @temporalio/workflow@1.18.1 @temporalio/activity@1.18.1
pnpm add @temporalio/client@1.18.1

# LaunchDarkly adapter (packages/ld-adapter)
pnpm add launchdarkly-api@20.0.0

# Database (packages/db)
pnpm add prisma@7.8.0 @prisma/client@7.8.0
pnpm exec prisma init

# Dashboard (apps/web)
pnpm create next-app@16.2.9 . --typescript --tailwind --app --eslint
pnpm add @tanstack/react-query@5.101.0 recharts@3.8.1 better-auth@1.6.20

# CLI (apps/cli)
pnpm add commander@15.0.0 openapi-fetch@0.17.0 zod@4.4.3

# Observability (apps/api + apps/worker)
pnpm add @opentelemetry/sdk-node@0.219.0 prom-client@15.1.3 @slack/webhook@7.0.9

# Dev dependencies (root)
pnpm add -D vitest@4.1.9 @vitest/coverage-v8 biome
```

## LaunchDarkly Integration Details

**Use REST API, not the evaluation SDK.**

| Package | Role | Confidence |
|---------|------|------------|
| `launchdarkly-api@20.0.0` | Read flag state, patch targeting (percentage rollout, on/off, rules) | HIGH |
| `@launchdarkly/node-server-sdk@9.11.2` | **Do not use** in orchestrator — for runtime flag evaluation in application code, not promotion control | HIGH |

**Required headers for all LD REST calls:**

```http
Authorization: <access-token>
Content-Type: application/json; domain-model=launchdarkly.semanticpatch
LD-API-Version: 20240415
```

**Key semantic-patch instructions for promotion:**

- `updatePercentageRollout` — advance canary/stagger percentages
- `turnFlagOn` / `turnFlagOff` — environment transitions
- `addRule` / `updateRule` — targeting rules per stage

Pin `LD-API-Version: 20240415` on access tokens and per-request headers (LaunchDarkly versioning policy).

## Telemetry Gate Adapter (v1)

Query Prometheus (or Grafana Mimir, Thanos — Prometheus-compatible API) during each gate check:

```promql
# Error rate (5xx / all)
sum(rate(http_requests_total{service="$SERVICE",status=~"5.."}[5m]))
/ sum(rate(http_requests_total{service="$SERVICE"}[5m]))

# P95 latency (ms)
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{service="$SERVICE"}[5m])) by (le)
) * 1000
```

Implement as a `packages/telemetry` adapter with pluggable backend; v1 ships Prometheus only. Datadog/New Relic adapters defer to v2 (PROJECT.md scope).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Temporal** | BullMQ 5.79.0 + PostgreSQL job state | Simple cron-style jobs with no multi-hour durable timers; not suitable for canary windows + pause/resume |
| **Temporal** | AWS Step Functions | Already on AWS, team prefers managed state machines, no self-hosted Temporal |
| **Fastify** | Hono 4.12.26 | Edge/serverless-only API with minimal deps; Fastify wins for OpenAPI + validation maturity |
| **Fastify** | NestJS | Large team already standardized on Nest; adds ceremony for a focused orchestration API |
| **Prisma** | Drizzle ORM | Prefer SQL-first migrations and lighter runtime; both work with PostgreSQL |
| **Commander** | oclif 4.11.7 | 20+ commands, plugin ecosystem, multi-team CLI ownership |
| **Next.js dashboard** | Vite + React SPA | No SSR needs, separate static hosting; Next.js wins for auth + BFF patterns |
| **Prometheus gates** | LaunchDarkly Observability triggers | LD triggers handle single-flag kill switches; insufficient for multi-env pipeline orchestration |
| **TypeScript monorepo** | Go API + TS dashboard | Extreme performance requirements or existing Go platform standards |
| **Better Auth** | OIDC proxy (Authentik, Okta) | Enterprise SSO mandate; wrap with OIDC, keep RBAC in app |

## What NOT to Use

| Avoid | Why | Use Instead | Confidence |
|-------|-----|-------------|------------|
| **@launchdarkly/node-server-sdk** as orchestrator client | Evaluates flags at runtime in app code; cannot perform semantic-patch targeting updates needed for promotion | `launchdarkly-api` REST client with semantic patch | HIGH |
| **BullMQ / cron-only orchestration** | Jobs are not replay-safe across process restarts; no native durable timers for multi-hour canary/stagger windows; pause/resume requires hand-rolled state machine | Temporal workflows with `sleep()` timers and signals | HIGH |
| **LaunchDarkly percentage rollouts alone** | Provider-native rollouts lack environment progression (dev → staging → prod) and cross-system telemetry gates | This orchestration layer on top of LD REST API | HIGH |
| **Express 4** | Slower, no built-in schema validation story; Fastify is the modern default for new Node APIs | Fastify 5 + Zod type provider | MEDIUM |
| **Next.js API routes as primary backend** | Couples CLI/API consumers to web app deployment; harder to scale worker independently | Dedicated Fastify `apps/api` service | HIGH |
| **Middleware-only auth (Next.js)** | CVE-2025-29927 showed middleware bypass risk; auth must be verified in Route Handlers and Server Components | Better Auth / OIDC with per-route verification | MEDIUM |
| **Custom workflow state in Redis alone** | Loses audit trail, replay, and timer durability; reimplements Temporal poorly | Temporal + PostgreSQL for config/audit | HIGH |
| **Argo Rollouts / Flagger as orchestrator** | Kubernetes-coupled; solves deploy-time canary, not LaunchDarkly flag promotion across environments | Keep K8s tools for infra deploys; use ff-promo for flag lifecycle |
| **Auto-rollback on breach (v1)** | PROJECT.md explicitly defers auto-rollback to reduce false-positive blast radius | Pause workflow + Slack alert; manual resume/rollback | HIGH |
| **GraphQL API (v1)** | REST + OpenAPI is simpler for CLI generation and platform tooling | Fastify REST + OpenAPI | MEDIUM |

## Stack Patterns by Variant

**If team is Kubernetes-native:**
- Deploy Temporal via Helm (or use Temporal Cloud); run API + worker as Deployments
- Prometheus already in cluster — wire telemetry adapter to in-cluster Prometheus URL
- Because flag promotion is decoupled from pod rollout, do not replace ff-promo with Argo Rollouts

**If team is early-stage / portfolio project:**
- Use Temporal dev server via Docker Compose (no Temporal Cloud cost)
- SQLite is tempting but avoid — PostgreSQL is required for concurrent pipeline state and audit
- Skip Better Auth initially; use API-key-only auth for CLI + dashboard behind VPN

**If telemetry is Datadog-only (no Prometheus):**
- v1 still ships Prometheus adapter; add Datadog Metrics API adapter in v2
- Do not block v1 on Datadog — mock gates in tests, use Prometheus in dev

**If CLI ships to npm:**
- Bundle with `esbuild`; target Node 24+
- Generate client from OpenAPI spec shared with dashboard

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@temporalio/worker@1.18.1` | Temporal Server 1.25–1.27+ | Pin worker SDK to server compatibility matrix in Temporal docs |
| `launchdarkly-api@20.0.0` | `LD-API-Version: 20240415` | Pin version on access tokens; breaking changes are versioned by date |
| `next@16.2.9` | `react@19.2.7`, Node 20.9+ | Requires Node 20.9+; use Node 24 LTS |
| `prisma@7.8.0` | PostgreSQL 14–17 | Use PG 16+ for production |
| `fastify@5.8.5` | `@fastify/type-provider-zod@1.0.0`, `zod@4.4.3` | Zod 4 is current; validate type-provider compatibility in spike |
| `commander@15.0.0` | Node 18+ | Works on Node 24 LTS |
| `@tanstack/react-query@5.101.0` | React 19, Next.js 16 | Use `'use client'` boundary for polling components only |

## Infrastructure (Production)

| Component | Recommendation | Why |
|-----------|----------------|-----|
| **Temporal** | Temporal Cloud (prod) / dev server (local) | Managed durability; avoids operating Temporal cluster in v1 |
| **PostgreSQL** | Neon, RDS, or Cloud SQL | Managed backups for audit + config |
| **API + Worker** | Container on Fly.io, Railway, or K8s | Stateless services; worker scales independently |
| **Dashboard** | Vercel or same container platform | Next.js SSR; BFF calls internal API |
| **Secrets** | Doppler, Vault, or cloud secret manager | LD API tokens, DB URL, Slack webhook |

## Sources

- [LaunchDarkly REST API overview](https://launchdarkly.com/docs/api) — API versioning (`LD-API-Version: 20240415`), semantic patch header — **HIGH**
- [LaunchDarkly REST API guide](https://launchdarkly.com/docs/guides/api/rest-api) — semantic patch for flag updates — **HIGH**
- [LaunchDarkly Node.js server SDK docs](https://docs.launchdarkly.com/sdk/server-side/node-js/) — confirms SDK is for evaluation, not management API — **HIGH**
- [npm `@launchdarkly/node-server-sdk@9.11.2`](https://www.npmjs.com/package/@launchdarkly/node-server-sdk) — version verified 2026-06-05 — **HIGH**
- [npm `launchdarkly-api@20.0.0`](https://www.npmjs.com/package/launchdarkly-api) — REST client version — **HIGH**
- Context7 `/websites/launchdarkly` — semantic patch instructions (`updatePercentageRollout`, `turnFlagOn`) — **HIGH**
- Context7 `/websites/temporal_io` — durable timers, workflow signals, entity pattern — **HIGH**
- [Temporal TypeScript SDK docs](https://docs.temporal.io/develop/typescript/set-up-your-local-typescript) — workflow/activity model — **HIGH**
- [Node.js Release Schedule](https://github.com/nodejs/Release/blob/main/README.md) — Node 24 Active LTS, Node 22 Maintenance — **HIGH**
- npm registry queries (2026-06-20) — `@temporalio/*@1.18.1`, `fastify@5.8.5`, `next@16.2.9`, `prisma@7.8.0`, etc. — **HIGH**
- Deployment gate / PromQL patterns — OneUptime, NthLayer docs — **MEDIUM** (patterns verified against Prometheus query API)

---
*Stack research for: Feature Flag Promotion System (telemetry-gated orchestration on LaunchDarkly)*
*Researched: 2026-06-20*
