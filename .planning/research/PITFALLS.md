# Pitfalls Research

**Domain:** Feature flag promotion orchestration (telemetry-gated environment progression with LaunchDarkly adapter)
**Researched:** 2026-06-20
**Confidence:** HIGH (LaunchDarkly official docs + multiple production post-mortems and progressive-delivery case studies)

## Critical Pitfalls

### Pitfall 1: Split-Brain Between Orchestrator and LaunchDarkly UI

**What goes wrong:**
The orchestrator advances a promotion to 25% canary in production, but a release engineer manually edits the same flag in the LaunchDarkly dashboard (or via a CI script) between gate checks. The orchestrator's internal state says "canary 25%, awaiting telemetry," while LaunchDarkly serves 50% or a completely different targeting rule. Gates evaluate against traffic the orchestrator didn't authorize; pauses fire on the wrong cohort; audit logs contradict reality.

**Why it happens:**
Teams treat LaunchDarkly as the source of truth for flag *configuration* but build a separate promotion state machine without write ownership. LaunchDarkly has no concept of "this flag is under orchestrated promotion — hands off." Manual overrides feel faster during incidents.

**How to avoid:**
- Designate the orchestrator as the **sole writer** of targeting changes for flags in an active promotion pipeline; block or warn on out-of-band LD edits (detect via LD audit log webhooks or periodic reconciliation).
- On every gate evaluation cycle, **re-read actual LD flag state** and reconcile with expected state before advancing; pause immediately on drift.
- Expose a "manual override" path through the orchestrator API (with audit + guardrail checks), not through raw LD dashboard edits during active promotions.
- Store promotion intent (target percentage, stage, environment) in the orchestrator DB; treat LD as an effector, not the workflow record.

**Warning signs:**
- LD audit log shows flag changes whose `comment` or actor don't match orchestrator service account
- Dashboard percentage doesn't match orchestrator-reported stage
- Telemetry cohort sizes don't match expected rollout percentage (sample ratio mismatch)
- Operators say "I fixed it in LaunchDarkly" during an active promotion

**Phase to address:**
Phase 2 (LaunchDarkly Adapter) — reconciliation loop and write-lock semantics; Phase 4 (Promotion Pipeline) — drift detection before every gate transition

---

### Pitfall 2: Cohort-Blind Telemetry Gates (Aggregate vs. Treatment Delta)

**What goes wrong:**
Gates compare total service error rate or p95 latency against a static threshold. A spam attack, unrelated deploy, or misconfigured log line triggers a pause — or worse, a missed regression because aggregate metrics mask a small but real canary-only spike. Headout Studio documented reducing false-positive rollbacks from five per week to one by switching from total error rate to **canary-vs-stable delta**.

**Why it happens:**
Aggregate metrics are easier to query and feel "safer" (they include more data). Teams assume any error spike during rollout is caused by the flag. SLO-style thresholds in PROJECT.md (error rate + latency) tempt implementers to wire a single global query without cohort segmentation.

**How to avoid:**
- Gate on **treatment-vs-control delta** (or treatment-vs-baseline), not absolute aggregate values.
- Require metrics labeled or filterable by flag variant / cohort ID emitted at evaluation time.
- Use consecutive breach windows (`failureLimit: 2+`) before pausing — single-point spikes shouldn't halt promotion.
- Capture a **24-hour pre-rollout baseline** per environment before the first gate check; compare relative change, not magic numbers.
- Document in gate config whether the metric is absolute SLO (hard ceiling) or relative delta (regression detection); v1 supports both error rate and latency but must specify comparison mode.

**Warning signs:**
- Pauses correlate with unrelated incidents (DDoS, other team's deploy) but flag cohort looks healthy
- Canary at 5% shows 2× error rate but gate never fires because 5% is drowned in aggregate
- Operators dismiss alerts as "noise" and start ignoring the system
- No `flag_key` / `variant` dimension in telemetry queries

**Phase to address:**
Phase 3 (Telemetry Gates) — define query contract and comparison semantics; Phase 4 (Promotion Pipeline) — baseline capture at promotion start

---

### Pitfall 3: Context Kind / Randomization Unit Mismatch

**What goes wrong:**
The orchestrator sets a 10% percentage rollout in production, but metrics track a different context kind than the flag evaluates against (e.g., flag buckets by `user`, metrics emit by `organization`). LaunchDarkly Release Guardian marks the rollout "Health warnings" — evaluations and metric events never align. Gates either pass with no data (false confidence) or pause permanently (no valid signal). LaunchDarkly automatically rolls back guarded rollouts on sample ratio mismatch (SRM) even when auto-rollback is disabled.

**Why it happens:**
Multi-service apps use different context kinds across frontend (user) and backend (service/account). Metrics pipelines were built before the flag existed. The orchestrator copies targeting rules from staging without validating metric randomization unit alignment in the target environment.

**How to avoid:**
- Add a **pre-promotion health check phase** (mirroring LD guarded rollout health checks): flag receiving evaluations, metrics receiving events, context kinds aligned.
- Store `randomization_unit` (context kind) in pipeline config; validate metric definitions reference the same unit before allowing promotion start.
- Block environment promotion if health check fails; surface actionable remediation (which SDK, which metric, which context kind).
- Run health checks again after each environment transition — staging may use `user`, prod may use `organization`.

**Warning signs:**
- "Health check waiting" persists beyond expected warmup window
- Metric event count is zero while flag evaluation count is healthy
- Sample ratio mismatch alerts in LD or orchestrator
- Canary cohort size is 0 despite non-zero rollout percentage

**Phase to address:**
Phase 3 (Telemetry Gates) — health check prerequisites; Phase 2 (LaunchDarkly Adapter) — evaluation telemetry verification

---

### Pitfall 4: Blind Environment Copy-Promotion (Configuration Drift)

**What goes wrong:**
Promoting "staging → prod" copies flag targeting (rules, percentages, on/off state) but production diverges in ways that matter: different variation IDs across environments, prerequisites pointing to flags with different states, segment definitions that don't exist in prod, or code not yet deployed to prod that the flag gates. Staging-validated rollout catches fire in prod because the **code path + flag + telemetry triangle** wasn't aligned.

**Why it happens:**
Teams conflate "flag config promotion" with "release promotion." Environment drift accumulates silently — manual LD edits, different segment membership, missing prerequisites. LD's cross-environment copy API copies rules but not the surrounding ecosystem (code version, metric availability, segment parity).

**How to avoid:**
- Treat environment promotion as a **three-way gate**: (1) code artifact deployed to target env, (2) flag config matches approved promotion manifest, (3) telemetry health checks pass in target env.
- Diff flag state before promotion; require explicit approval for diffs beyond expected stage advancement.
- Never assume variation IDs are portable — resolve variation IDs **per environment** via LD GET before semantic patch.
- Reset rollout percentage to 0 (or pre-release stage) on environment entry; don't copy staging's 50% canary directly into prod.

**Warning signs:**
- Promotion succeeds but prod serves wrong variation (off variation, stale rule)
- Prerequisites fail silently (flag references another flag that's off in prod)
- "Works in staging" becomes the incident title
- Segment-targeted users get 0% exposure in prod

**Phase to address:**
Phase 4 (Promotion Pipeline) — environment transition protocol; Phase 2 (LaunchDarkly Adapter) — per-environment variation ID resolution

---

### Pitfall 5: Advancing Before Statistical Sufficiency (Minimum Sample / Stabilization Window)

**What goes wrong:**
Orchestrator advances from 5% canary to 25% stagger after a fixed 15-minute timer despite only 12 users hitting the treatment variant. Error rate looks perfect (0/12 errors) or latency looks fine but has no p99 signal. Next stage exposes 10× traffic; latent bug surfaces at scale. Conversely, LD guarded rollouts extend steps when minimum context count isn't met — an orchestrator with only time-based gates creates false confidence.

**Why it happens:**
Fixed-duration stages are simpler to implement than sample-size-aware gates. Low-traffic services and internal pre-release stages rarely hit meaningful sample counts. Teams optimize for promotion speed over signal quality.

**How to avoid:**
- Combine **time AND sample minimums**: advance only when both `min_duration` elapsed AND `min_contexts` (or `min_requests`) met.
- Extend current stage automatically when sample minimum not met (LD pattern); cap with max extension + operator alert.
- Scale minimum sample requirements by stage (higher percentages need more absolute samples for delta detection).
- For pre-release / internal stages, allow lower minimums but label results as "low confidence" in dashboard.

**Warning signs:**
- Stage durations are identical regardless of traffic volume
- Cohort sizes in dashboard show <30 contexts at gate pass
- Regressions appear only at 50%+ stages
- Gate pass times are suspiciously fast for low-traffic flags

**Phase to address:**
Phase 4 (Promotion Pipeline) — stage advancement logic; Phase 3 (Telemetry Gates) — sample size prerequisites

---

### Pitfall 6: Orchestrator–SDK Propagation Lag (Write-Then-Measure Race)

**What goes wrong:**
Orchestrator writes a targeting update to LaunchDarkly via REST API, immediately starts the gate evaluation window, and passes the gate because metrics still reflect the **pre-change** cohort. Or: gate fails because old cohort errors linger in the sliding window after a successful rollback write. The system advances or pauses based on stale telemetry.

**Why it happens:**
LD SDKs cache flag state locally (streaming updates, not synchronous per-request). REST API confirms write to LD control plane, not to every evaluating SDK instance. Gate windows start on write-ack rather than on confirmed exposure shift.

**How to avoid:**
- Insert a **propagation buffer** after LD writes before starting gate evaluation (configurable per environment; start with 2–5 minutes, tune per SDK cache TTL).
- Confirm exposure shift via LD evaluation metrics or custom exposure events before gating — don't gate on outcome metrics until exposure metrics show expected cohort ratio.
- On pause/resume, clear or annotate gate windows so pre-change data doesn't contaminate post-resume decisions.
- Use semantic patch (atomic instructions) for each stage change — single API call for turn-on + percentage update.

**Warning signs:**
- Gate passes within seconds of a percentage change
- Cohort ratio in metrics lags flag config by several minutes
- Pauses fire long after manual fix because sliding window retains old data
- Different services show different effective rollout percentages simultaneously

**Phase to address:**
Phase 2 (LaunchDarkly Adapter) — write confirmation + propagation delay; Phase 3 (Telemetry Gates) — exposure-aware window start

---

### Pitfall 7: Pause-and-Alert Without Actionable Operator Context

**What goes wrong:**
Telemetry breach triggers pause (correct per v1 design), but the alert says "gate failed" without: which stage, which metric, treatment vs control values, baseline comparison, direct link to LD flag state, or recommended next steps. Operators revert manually in LD (creating split-brain), or resume prematurely because they can't tell signal from noise. Trust in the system erodes faster than with auto-rollback.

**Why it happens:**
v1 explicitly defers auto-rollback to reduce false-positive blast radius, but teams underestimate the **alert quality** burden. Pause is treated as the entire failure-handling feature rather than the first act of an operator workflow.

**How to avoid:**
- Every pause alert includes: flag key, environment, stage, metric name, observed value, threshold, baseline, delta, cohort sizes, time window, orchestrator run ID, LD flag URL.
- Dashboard shows **promotion timeline** with gate results annotated — not just current state.
- Provide explicit operator actions: Resume (after review), Abort (return to safe state), Escalate — all through orchestrator, not raw LD.
- Track pause reasons and operator outcomes; review weekly for false-positive rate (GitPlumbers recommendation).
- Document runbooks per gate type before enabling self-service promotions.

**Warning signs:**
- Mean time to resume after pause increases over time
- Operators bypass orchestrator during incidents
- Slack alerts get muted or ignored
- Post-incident reviews can't answer "what did the gate see?"

**Phase to address:**
Phase 5 (API & CLI) — structured pause/resume endpoints; Phase 6 (Dashboard) — promotion forensics view; Phase 7 (Guardrails & Self-Service) — runbook integration

---

### Pitfall 8: Duplicating LaunchDarkly Guarded Rollouts Instead of Adding Environment Progression

**What goes wrong:**
The team rebuilds percentage ramp + metric regression detection inside the orchestrator — essentially cloning Release Guardian — while neglecting the actual differentiator: **dev → staging → prod progression with policy guardrails and self-service**. Scope explodes; behavior diverges from LD native rollouts; teams run guarded rollouts in LD *and* the orchestrator on the same flag, causing conflicting automation.

**Why it happens:**
LD guarded rollouts are the obvious reference implementation. Engineers gravitate toward familiar patterns. The product vision (orchestration layer on top of LD) gets lost in feature parity with provider-native tooling.

**How to avoid:**
- Scope v1 orchestrator to what LD **doesn't** do: multi-environment pipeline, platform guardrails, self-service within bounds, unified API/CLI/dashboard across flags.
- Use LD API for flag writes; use external telemetry (Prometheus/Datadog/etc.) for gates if LD metrics aren't the source — but don't rebuild LD's statistical engine unless necessary.
- Detect and block concurrent LD guarded rollouts on flags enrolled in orchestrator pipelines.
- Document clear boundary: "LD handles single-env percentage ramp with LD-native metrics; orchestrator handles cross-env promotion with org telemetry."

**Warning signs:**
- Sprint plans include "implement regression detection algorithm"
- Same flag has both LD guarded rollout and orchestrator promotion active
- Provider adapter scope exceeds flag read/write + audit
- No user story progress on environment progression or guardrails

**Phase to address:**
Phase 1 (Foundation) — scope boundary document; Phase 4 (Promotion Pipeline) — environment-stage state machine as core differentiator

---

### Pitfall 9: Non-Sticky Bucketing Contaminating Rollout Metrics

**What goes wrong:**
Percentage rollout assigns users to treatment/control independently per request. Users flicker between variants; error rates and latency metrics blend both code paths for the same user. Gates see unstable signals; UX bugs report "sometimes works." Sample ratio looks fine but cohort comparison is meaningless.

**Why it happens:**
Custom percentage logic implemented without bucket-by attribute. Misunderstanding that LD rollouts must specify `rolloutBucketBy` (context key) for stickiness. Testing with anonymous or per-request context.

**How to avoid:**
- All percentage rollouts must bucket by a stable context attribute (user key, org key — matching randomization unit).
- Validate stickiness in adapter: same context → same variant across repeated evaluations.
- Reject pipeline configs that specify percentage rollout without `bucketBy` field.
- Integration test: evaluate same context 100 times, assert single variant.

**Warning signs:**
- User bug reports of inconsistent feature behavior during rollout
- Treatment cohort error rate oscillates without traffic change
- Same user ID appears in both variant logs
- `rolloutBucketBy` missing from semantic patch instructions

**Phase to address:**
Phase 2 (LaunchDarkly Adapter) — sticky rollout enforcement; Phase 4 (Promotion Pipeline) — config validation

---

### Pitfall 10: API Rate-Limit Retry Storms During Stagger Rollouts

**What goes wrong:**
Orchestrator polls LD flag state and pushes targeting updates on short intervals across many concurrent promotions. LD returns 429 Rate Limited; retry loop without exponential backoff amplifies the problem. Promotions stall; some flags advance while others don't; system enters degraded state.

**Why it happens:**
Naive polling architecture for gate checks combined with per-stage LD writes. LaunchDarkly docs explicitly warn about 429 loops and recommend backoff. Multiple promotions × multiple environments × frequent polls exceeds API budget.

**How to avoid:**
- Event-driven over poll-driven where possible: LD webhooks/audit log streams for flag change confirmation; telemetry push or reasonable scrape intervals for gates.
- Centralized rate limiter with exponential backoff and jitter on all LD API calls.
- Batch stage changes into single semantic patch per transition.
- Cache flag reads with TTL; don't GET before every gate evaluation unless reconciling drift.
- Load-test API budget: N concurrent promotions × M gate checks/minute < LD rate limit with headroom.

**Warning signs:**
- 429 errors in adapter logs
- Increasing gate evaluation latency over time
- Promotions in same project interfere with each other
- LD API usage spikes correlate with stagger stage frequency

**Phase to address:**
Phase 2 (LaunchDarkly Adapter) — rate limiting and backoff; Phase 1 (Foundation) — event-driven architecture decision

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Poll LD + telemetry on fixed 30s interval | Simple scheduler, no webhook infra | Rate limits, stale state, scales poorly | MVP only with ≤10 concurrent promotions; replace with events before self-service |
| Store promotion state only in LD flag comments | No database migration | No audit trail, no reconciliation, lost on manual edit | Never |
| Hardcode gate thresholds in code | Faster v1 delivery | Every threshold change requires deploy | Never for production; platform guardrails require config-driven thresholds |
| Skip pre-promotion health checks | Faster time-to-first-promotion | Silent gate failures, SRM rollbacks, operator firefighting | Never |
| Allow LD dashboard as equal write path | Operator flexibility during incidents | Split-brain, permanent distrust of orchestrator state | Incident-only with break-glass audit — not default |
| Copy staging targeting verbatim to prod | One-click "promote" | Variation ID mismatch, wrong percentages, untested prod paths | Never without diff + reset-to-pre-release |
| Time-only stage gates (no sample minimum) | Simpler stage logic | False confidence, late detection at scale | Low-traffic internal flags only, with "low confidence" label |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| LaunchDarkly REST API | Multiple sequential PATCH calls per stage change | Single semantic patch with batched instructions (`turnFlagOn` + `updateFallthroughVariationOrRollout`) — atomic apply or full reject |
| LaunchDarkly REST API | Using JSON Patch with stale `_id` references after env copy | GET flag per environment first; resolve variation IDs and rule IDs in target env |
| LaunchDarkly REST API | Ignoring 429; immediate retry in loop | Exponential backoff with jitter; central rate limiter; reduce poll frequency |
| LaunchDarkly Guarded Rollouts | Running LD guarded rollout and orchestrator promotion on same flag | Mutual exclusion: orchestrator-managed flags reject LD native guarded rollout enrollment |
| LaunchDarkly SDK/streaming | Assuming REST write = immediate SDK visibility | Propagation buffer; verify via evaluation/exposure metrics before gating |
| Telemetry (Prometheus/Datadog) | Querying global service metrics | Cohort-filtered queries with flag/variant labels; treatment vs control delta |
| Telemetry | Starting gates immediately after deploy + flag change | Baseline window + propagation buffer + minimum sample before first gate |
| Alerting (PagerDuty/Slack) | Generic "gate failed" messages | Structured alert payload with metric values, cohort sizes, deep links, runbook link |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| O(n) LD API polling per active promotion | 429 rate limits; gate latency grows with promotion count | Event-driven updates; shared poll scheduler; cached flag state | ~20+ concurrent promotions or <60s poll interval |
| Unbounded promotion history in hot path | Dashboard/API slow; DB bloat | Archive completed promotions; paginate timeline; aggregate gate results | ~1000 promotions or ~6 months history without archival |
| Synchronous gate evaluation blocking stage worker | Head-of-line blocking; one slow telemetry query stalls all promotions | Async gate evaluation with timeout; per-promotion worker isolation | ≥5 concurrent promotions with 30s+ telemetry query latency |
| Full flag config fetch on every reconciliation | Large payloads; slow diff | Use LD summary endpoints where sufficient; diff only changed environments | Projects with 500+ flags or complex targeting rules |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| LaunchDarkly API token in promotion worker with write access to all environments | Compromised orchestrator writes arbitrary prod targeting — instant blast radius | Scoped API tokens per environment; orchestrator uses least-privilege token that can only write enrolled flags |
| Self-service promotion API without guardrail enforcement | Developer promotes directly to prod at 100%, bypassing canary/stagger | Server-side guardrail validation on every promote request; pipeline definition caps max stage jump |
| Client-side dashboard bypassing orchestrator to call LD API | Split-brain + unaudited prod changes | Dashboard talks only to orchestrator API; LD tokens never exposed to browser |
| Promotion API lacks authZ separation (platform vs dev roles) | App dev modifies pipeline definitions or SLO thresholds | RBAC: platform engineers configure pipelines/guardrails; developers trigger within assigned pipelines only |
| Audit log gaps on pause/resume/abort | Compliance failure; can't reconstruct incident timeline | Append-only promotion event log; correlate orchestrator actions with LD audit log entries |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Dashboard shows LD state but not orchestrator intent | Operators don't know if drift exists | Side-by-side: "expected stage" vs "observed LD state" with drift highlight |
| No visibility into *why* gate is waiting | Developers think system is stuck | Show: propagation buffer countdown, sample count progress, baseline collection status |
| Self-service promote button with no pipeline context | Devs trigger prod promotion without understanding stages | Show full pipeline preview (stages, estimated duration, guardrails) before confirm |
| Alert fatigue from noisy gates | Operators ignore pauses | Consecutive-failure requirement; delta-based gates; weekly false-positive review |
| Identical UI for platform engineers and app developers | Devs overwhelmed by config; platform can't find guardrail settings | Dual user model: separate views for pipeline config vs promotion trigger/monitor |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **LaunchDarkly adapter:** Writes targeting via semantic patch — verify atomic multi-instruction patches, not separate on/rollout calls
- [ ] **LaunchDarkly adapter:** Resolves variation IDs per environment — verify staging IDs aren't reused in prod
- [ ] **Telemetry gates:** Gate queries use cohort/variant labels — verify aggregate-only query can't pass gates
- [ ] **Telemetry gates:** Baseline captured before first gate — verify promotion started without baseline is rejected or flagged
- [ ] **Promotion pipeline:** Environment entry resets to pre-release — verify prod never inherits staging's mid-canary percentage
- [ ] **Promotion pipeline:** Sample minimum enforced — verify time-only advance is blocked for low-traffic flags
- [ ] **Split-brain protection:** Reconciliation detects manual LD edits — verify out-of-band change triggers pause
- [ ] **Propagation handling:** Gate window starts after exposure confirmation — verify no gate pass within seconds of LD write
- [ ] **Pause workflow:** Alert includes metric values + cohort sizes + deep links — verify alert payload is actionable without dashboard
- [ ] **Self-service guardrails:** Server rejects out-of-policy promotion — verify client-side validation isn't the only enforcement
- [ ] **Concurrent promotion safety:** Two pipelines on same flag blocked — verify enrollment is exclusive per flag per environment
- [ ] **Audit trail:** Every stage transition logged with actor — verify developer vs service account attribution

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Split-brain (manual LD override) | MEDIUM | Pause orchestrator promotion; reconcile LD state to last known good orchestrator intent or abort to safe state; re-enroll flag with health check |
| False-positive pause (noisy telemetry) | LOW | Operator reviews gate forensics; adjust threshold or wait for consecutive breach; resume with annotated override reason; log for weekly review |
| Variation ID mismatch after env copy | HIGH | Abort promotion; GET prod flag config; remap variation IDs; restart from pre-release at 0% |
| Context kind mismatch | MEDIUM | Fix metric SDK or flag evaluation context; re-run health check; restart gate window (don't resume mid-window) |
| Rate limit storm (429 loop) | LOW | Circuit-break LD calls; backoff 5–15 min; resume promotions in priority order |
| Non-sticky bucketing discovered mid-rollout | HIGH | Pause; fix bucketBy config; abort and restart promotion (metrics during rollout are invalid) |
| Missed regression (insufficient sample) | HIGH | Manual rollback in LD via orchestrator abort; lower stage; increase sample minimums; post-incident threshold review |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. Phase names are provisional for roadmap creation.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Split-brain (LD UI vs orchestrator) | Phase 2 (LD Adapter) + Phase 4 (Pipeline) | Integration test: manual LD edit during active promotion triggers drift pause |
| Cohort-blind telemetry gates | Phase 3 (Telemetry Gates) | Unit test: aggregate healthy + treatment degraded → gate fails |
| Context kind mismatch | Phase 3 (Telemetry Gates) | Health check blocks promotion when metric context ≠ flag context |
| Blind environment copy | Phase 4 (Promotion Pipeline) | Test: staging 50% canary → prod entry starts at pre-release 0% |
| Insufficient sample size | Phase 4 (Promotion Pipeline) | Test: low-traffic flag cannot advance on timer alone |
| SDK propagation lag | Phase 2 (LD Adapter) + Phase 3 (Gates) | Test: gate window doesn't start until exposure metrics confirm cohort ratio |
| Pause without context | Phase 5 (API/CLI) + Phase 6 (Dashboard) | Alert payload review: all required fields present in staging fire drill |
| Duplicating LD guarded rollouts | Phase 1 (Foundation) | Architecture review: no statistical engine scope; environment progression is P0 |
| Non-sticky bucketing | Phase 2 (LD Adapter) | Test: 100 evaluations same context → 1 variant |
| API rate-limit storms | Phase 2 (LD Adapter) | Load test: 25 concurrent promotions without 429 errors |
| Self-service guardrail bypass | Phase 7 (Guardrails) | Pen test: API rejects out-of-policy prod jump |
| Missing audit trail | Phase 1 (Foundation) + Phase 5 (API) | Compliance check: full promotion reconstructable from event log |

### Suggested Phase Ordering Rationale

1. **Phase 1 (Foundation)** — Domain model, promotion state machine, audit event log. Prevents scope creep and audit gaps before any integration.
2. **Phase 2 (LaunchDarkly Adapter)** — Semantic patch writes, variation ID resolution, rate limiting, sticky rollouts, propagation awareness. Highest integration risk.
3. **Phase 3 (Telemetry Gates)** — Health checks, baseline capture, cohort delta queries, consecutive breach logic. Core value proposition.
4. **Phase 4 (Promotion Pipeline)** — Environment progression, sub-stages, sample minimums, drift reconciliation. Depends on adapter + gates.
5. **Phase 5 (API & CLI)** — Operator actions (pause/resume/abort), structured alerts. Depends on pipeline existing.
6. **Phase 6 (Dashboard)** — Forensics, drift visibility, dual user views. Depends on API events.
7. **Phase 7 (Guardrails & Self-Service)** — RBAC, pipeline config, guardrail enforcement. Last because it wraps proven pipeline behavior.

## Sources

- [LaunchDarkly: Health checks for guarded rollouts](https://launchdarkly.com/docs/home/releases/guarded-health-checks) — context kind alignment, metric tracking prerequisites (HIGH)
- [LaunchDarkly: Managing guarded rollouts](https://launchdarkly.com/docs/home/releases/managing-guarded-rollouts) — SRM auto-rollback, minimum contexts, regression weighting (HIGH)
- [LaunchDarkly: Sample ratio mismatch](https://docs.launchdarkly.com/guides/statistical-methodology/sample-ratios) — event loss, randomization failures (HIGH)
- [LaunchDarkly: REST API — semantic patch](https://launchdarkly.com/docs/guides/api/rest-api) — atomic instructions, 429 handling (HIGH)
- [LaunchDarkly AI tooling: targeting patterns](https://github.com/launchdarkly/ai-tooling/blob/main/skills/feature-flags/launchdarkly-flag-targeting/references/targeting-patterns.md) — rollout weights, bucketBy, cross-env copy (HIGH)
- [Featureflip: Feature Flag Anti-Patterns](https://featureflip.io/blog/feature-flag-anti-patterns/) — Knight Capital, Slack 2020, observability gaps (MEDIUM)
- [Headout Studio: Canary rollback metric selection](https://www.headout.studio/canary-deployment-with-automated-rollback/) — aggregate vs delta false positives (MEDIUM)
- [GitPlumbers: Metrics-gated deployments](https://gitplumbers.com/blog/the-rollback-button-that-presses-itself-metrics-gated-deployments-without-the-pa/) — consecutive failures, version-specific metrics (MEDIUM)
- [Dan Lorenc: Pitfalls of Progressive Delivery](https://dlorenc.medium.com/pitfalls-of-progressive-delivery-114c6e3f9dbb) — multi-version state, observability requirements (MEDIUM)
- [DataJelly: Staging vs Production Parity](https://datajelly.com/guides/staging-vs-production-parity) — flag state drift across environments (MEDIUM)
- [Cadence: Feature flag rollout playbook](https://cadence.withremote.ai/blog/feature-flags-rollout) — kill switch separation, baseline period, sticky bucketing (MEDIUM)

---
*Pitfalls research for: Feature Flag Promotion System (ff-promo)*
*Researched: 2026-06-20*
