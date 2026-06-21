# Feature Research

**Domain:** Feature flag promotion orchestration (orchestration layer atop LaunchDarkly)
**Researched:** 2026-06-20
**Confidence:** HIGH (official docs from LaunchDarkly, Statsig, Unleash, Harness, Codefresh, Flagger; MEDIUM for industry best-practice synthesis)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unsafe to adopt.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-environment promotion pipeline | Every competitor models dev → staging → prod (or equivalent) as ordered stages; teams ship through environments, not straight to prod | MEDIUM | LaunchDarkly Release Pipelines, Statsig Release Pipelines, Codefresh Promotion Flows, Unleash release plans all use sequential environment/phase progression |
| Sub-stage rollout within each transition (canary / stagger) | Percentage rollouts are the default progressive delivery pattern; "canary then full" is assumed for production-bound changes | MEDIUM | LaunchDarkly progressive/guarded rollouts, Unleash milestones, Flagger stepWeight — users expect gradual exposure, not binary flips |
| Telemetry gates before stage advancement | Guarded rollouts, safeguards, and metric analysis are now standard; promoting without health checks is considered reckless | HIGH | LaunchDarkly Guarded Rollouts, Unleash safeguards, Harness Release Monitoring, Flagger metric analysis — gate on error rate and latency at minimum |
| Pause on telemetry breach | When gates fail, advancement must stop; continuing automatically is a trust violation | MEDIUM | LaunchDarkly pauses guarded rollouts; Unleash safeguards pause automation; Flagger halts canary advancement |
| Pipeline status dashboard | Operators need a single view of current stage, progress %, gate health, and history — every product ships a monitoring UI | MEDIUM | LaunchDarkly Monitoring tab, Statsig pipeline actions UI, Codefresh Releases view |
| Alerting on pipeline events | Breach, pause, approval-needed, and completion must reach operators via email/Slack/PagerDuty | MEDIUM | LaunchDarkly PagerDuty notifications; Harness/Split alert policies; Statsig approval notifications |
| Approval gates (optional per stage) | Enterprise teams require human sign-off before prod-bound promotion; configurable per environment/stage | MEDIUM | LaunchDarkly approvals + Release Pipelines; Statsig requiredReview; Codefresh Promotion Policies |
| REST API for promotion control | Platform teams automate promotions in CI/CD; API is non-negotiable for orchestration products | MEDIUM | Statsig Release Pipeline API; LaunchDarkly REST API; Harness pipeline steps |
| CLI for developer workflows | Developers trigger and inspect promotions from terminal without opening a dashboard | LOW | LaunchDarkly ldcli; industry norm for platform tooling |
| Provider adapter (read flag state, write targeting) | Orchestration layer must integrate with existing flag provider without migration | HIGH | Core integration model — LaunchDarkly API for flag reads and targeting updates |
| Audit trail | Who triggered promotion, what changed, when gates passed/failed — required for compliance and postmortems | MEDIUM | LaunchDarkly approval history; Codefresh Git-tracked promotions; Harness audit trails |
| Emergency stop / abort active promotion | Operators must halt an in-flight promotion immediately without waiting for stage completion | LOW | Statsig Abort action; LaunchDarkly manual rollback; Harness Kill Feature Flag step |
| Configurable guardrails (platform-defined) | Release/platform engineers set thresholds, allowed environments, and approval requirements that constrain all promotions | MEDIUM | LaunchDarkly release policies (beta); Codefresh Promotion Policies; Statsig pipeline templates |
| Self-service promotion trigger (within guardrails) | Application developers initiate promotions without ticket-to-platform; guardrails enforce bounds | MEDIUM | Codefresh drag-and-drop promotion; Statsig Approve action; LaunchDarkly self-serve with approval gates |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required to exist, but align with Core Value: telemetry-gated environment progression atop an existing provider.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Orchestration layer atop existing FF provider (not replacement) | Zero migration friction — teams keep LaunchDarkly SDKs, segments, and workflows; adopt orchestration incrementally | HIGH | Most providers bundle orchestration into their flag platform; standalone orchestration is the gap this product fills |
| Telemetry-gated **environment** transitions | Provider-native guarded rollouts gate within one environment; gating the dev→staging→prod boundary on SLOs is the underserved gap | HIGH | LaunchDarkly Release Pipelines combine approvals + guarded rollouts per phase but don't natively gate env promotion on external SLO telemetry from observability stack |
| Opinionated pause-and-alert (not auto-rollback) | Reduces blast radius of false-positive rollbacks from noisy telemetry; operators decide rollback vs resume | MEDIUM | LaunchDarkly/Flagger default to auto-rollback; deliberate pause-only is a differentiated safety posture |
| Unified sub-stage model (pre-release → canary → stagger) per env transition | One coherent pipeline abstraction instead of stitching progressive rollouts + approvals + env promotion manually | MEDIUM | Competitors offer pieces; unified orchestration across sub-stages within env transitions is the product's opinionated model |
| SLO-only gate simplicity (error rate + latency) | Universal, testable gates without experimentation-platform complexity; faster adoption for platform teams | LOW | Harness/Split support arbitrary metrics; focusing on SLO-style gates reduces configuration burden and false positives |
| Dual user model (platform guardrails + dev self-service) | Platform sets policies once; devs operate within bounds without platform team bottleneck | MEDIUM | Codefresh has policies; explicit dual-role UX (guardrail config vs promotion trigger) is a product design differentiator |
| External observability integration for gates | Pull error rate and latency from Datadog/Prometheus/New Relic rather than requiring provider-native metrics only | HIGH | LaunchDarkly Guarded Rollouts uses LD metrics; external SLO sources let teams use existing monitoring investments |
| Pipeline-as-single-unit-of-work | One promotion run spans all environments and sub-stages with unified status — not per-flag siloed workflows | MEDIUM | LaunchDarkly Release Pipelines are per-flag; cross-environment orchestration as one tracked entity is cleaner for operators |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems or dilute Core Value.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automatic rollback on telemetry breach | "Fully automated safety" sounds ideal; Flagger/LaunchDarkly offer it | False positives from noisy metrics cause unnecessary rollbacks and erode trust; operators lose control during incidents | Pause-and-alert; operator decides rollback vs dismiss-and-continue (LaunchDarkly regression dismiss pattern) |
| Multi-provider support in v1 | "We use Split and LaunchDarkly" | Adapter complexity dominates engineering before orchestration logic is proven; delays MVP validation | LaunchDarkly-first adapter; prove orchestration; add providers in v2 |
| Custom business metric gates (conversion, revenue) | Product teams want funnel metrics as gates | Requires metric attribution infrastructure, increases false positive rate, expands gate configuration surface | SLO gates (error rate + latency) in v1; defer business metrics to experimentation platforms |
| Flag authoring / segment management | "One tool for everything" | Scope creep into full FF platform; competes with LaunchDarkly instead of complementing it | Orchestrate promotion only; flags created in LaunchDarkly |
| A/B experiment design and analysis | Experimentation is adjacent to progressive delivery | Different user persona (product/analytics), different statistical requirements; dilutes orchestration focus | Integrate with LD experiments or Statsig for experimentation; orchestration handles promotion |
| Time-only advancement (no telemetry gates) | "Schedule rollouts overnight" simplicity | Promotes broken changes during low-traffic windows when metrics are insufficient to detect issues | Time intervals as soak periods *after* telemetry gates pass (Statsig pattern: time starts after approval) |
| GitOps-as-source-of-truth for flag config | GitOps teams want flags in YAML repos | Different architecture (Flaggr, Codefresh GitOps); conflicts with provider-as-runtime-source model | Provider adapter writes to LaunchDarkly API; optional Git sync is v2+ |
| Infrastructure-level canary (K8s deployments) | "We already use Argo Rollouts" | Different layer (deployment vs feature flag); requires service mesh/ingress integration | Orchestrate flag targeting; let Flagger/Argo handle deployment canaries separately |
| Unlimited custom gate types / webhook gates | Flexibility for every team's unique checks | Configuration explosion, untestable pipelines, platform team becomes gate-script maintainer | Fixed SLO gate types + optional approval gate; expand gate types based on validated demand |
| Real-time sub-second promotion propagation | "Instant rollouts" marketing | Flag SDK propagation is already seconds; sub-second orchestration adds complexity without safety benefit | Orchestration decisions on minute-scale intervals (Flagger default: 60s analysis interval) |
| Per-flag unlimited pipeline customization | "Every flag is unique" | Unmaintainable at scale; platform teams can't enforce standards | Pipeline templates with guardrail bounds; per-flag overrides only within guardrails |

## Feature Dependencies

```
Provider Adapter (LaunchDarkly)
    └──requires──> Telemetry Integration (error rate + latency sources)
                       └──requires──> Gate Evaluation Engine
                                          └──requires──> Pipeline State Store

Multi-Environment Pipeline Definition
    └──requires──> Provider Adapter
    └──requires──> Guardrail Configuration (platform)

Sub-Stage Rollout (pre-release / canary / stagger)
    └──requires──> Provider Adapter (targeting updates)
    └──requires──> Gate Evaluation Engine

Telemetry Gates
    └──requires──> Telemetry Integration
    └──requires──> Sub-Stage Rollout (gates evaluate between stages)

Pause on Breach
    └──requires──> Telemetry Gates
    └──requires──> Alerting

Approval Gates
    └──enhances──> Multi-Environment Pipeline (optional per stage)
    └──conflicts──> Fully automated promotion (if approval required, automation pauses)

Dashboard
    └──requires──> Pipeline State Store
    └──enhances──> Self-Service Promotion Trigger (visibility for devs)

REST API + CLI
    └──requires──> Pipeline Orchestrator (core promotion logic)
    └──enhances──> Self-Service Promotion Trigger

Audit Trail
    └──requires──> Pipeline State Store
    └──enhances──> Approval Gates (records who approved)

Emergency Stop / Abort
    └──requires──> Provider Adapter
    └──requires──> Pipeline State Store
```

### Dependency Notes

- **Provider Adapter requires Telemetry Integration:** Orchestration reads flag state from LaunchDarkly and health from observability; both are inputs to every gate decision.
- **Sub-Stage Rollout requires Gate Evaluation Engine:** Percentage increases only happen after gates pass; without gates, sub-stages are just timed rollouts (anti-feature).
- **Approval Gates enhance Multi-Environment Pipeline:** Optional per stage; when enabled, pipeline pauses until human action (Statsig: time interval starts after approval).
- **Dashboard requires Pipeline State Store:** UI reads orchestration state, not provider state directly; provider shows flag config, orchestrator shows promotion progress.
- **Self-Service Promotion Trigger conflicts with unrestricted automation:** Devs trigger within guardrails; platform defines what devs can do without approval.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate telemetry-gated environment promotion atop LaunchDarkly.

- [ ] LaunchDarkly provider adapter (read flag state, write targeting updates) — foundation; nothing works without it
- [ ] Multi-environment promotion pipeline (dev → staging → prod) — core value proposition
- [ ] Sub-stage rollout within transitions (pre-release, canary, stagger) — table stakes progressive delivery
- [ ] SLO telemetry gates (error rate + latency thresholds) — Core Value: promote only when healthy
- [ ] Pause on telemetry breach — safety requirement; no silent advancement on failure
- [ ] Alerting on pause/breach/completion — operators must know when action is needed
- [ ] Platform guardrail configuration (thresholds, environment policies) — dual user model: platform sets bounds
- [ ] Developer self-service promotion trigger (within guardrails) — dual user model: devs operate
- [ ] REST API + CLI — programmatic control for platform and CI/CD integration
- [ ] Pipeline status dashboard — operators and devs need visibility
- [ ] Audit trail (who, what, when for promotion events) — enterprise adoption requirement
- [ ] Emergency stop / abort in-flight promotion — operational safety

### Add After Validation (v1.x)

Features to add once core orchestration is proven in production.

- [ ] Approval gates (configurable per stage) — many teams need human sign-off; can launch with guardrails-only if platform approves all prod promotions initially
- [ ] Slack / PagerDuty notification integrations — email-only alerting sufficient for MVP; rich integrations after workflow validated
- [ ] Pipeline templates (reusable promotion patterns) — start with one default pipeline; templates when multiple teams adopt
- [ ] Soak time intervals between sub-stages — time-based soak after telemetry gate passes (Statsig pattern)
- [ ] Regression dismiss / continue-after-breach (operator override) — LaunchDarkly pattern; add when pause-and-alert workflow is validated
- [ ] Promotion history and comparison view — audit trail in v1; richer analytics after data accumulates

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Multi-provider adapters (Split, Unleash, Flagsmith) — prove orchestration with LaunchDarkly first
- [ ] Custom business metric gates — requires attribution infrastructure; SLO gates sufficient for MVP
- [ ] Automatic rollback on breach — deliberate v1 anti-feature; revisit only if pause-and-alert proves insufficient
- [ ] Flag authoring / segment management — stay orchestration layer, not FF platform
- [ ] A/B experiment orchestration — different product surface; integrate with provider experiments
- [ ] GitOps flag config sync — different architecture; Codefresh/Flaggr territory
- [ ] Webhook / custom gate types — expand gate surface after SLO gates are stable
- [ ] Multi-flag batch promotion — single-flag pipelines first; batch when teams scale usage

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| LaunchDarkly provider adapter | HIGH | HIGH | P1 |
| Multi-environment pipeline | HIGH | MEDIUM | P1 |
| SLO telemetry gates (error + latency) | HIGH | HIGH | P1 |
| Pause on breach + alerting | HIGH | MEDIUM | P1 |
| Sub-stage rollout (canary/stagger) | HIGH | MEDIUM | P1 |
| Pipeline status dashboard | HIGH | MEDIUM | P1 |
| REST API + CLI | HIGH | MEDIUM | P1 |
| Platform guardrails | HIGH | MEDIUM | P1 |
| Dev self-service trigger | HIGH | LOW | P1 |
| Audit trail | MEDIUM | LOW | P1 |
| Emergency stop / abort | HIGH | LOW | P1 |
| Approval gates | MEDIUM | MEDIUM | P2 |
| Slack/PagerDuty integrations | MEDIUM | LOW | P2 |
| Pipeline templates | MEDIUM | MEDIUM | P2 |
| Soak time intervals | MEDIUM | LOW | P2 |
| Operator override (dismiss breach) | MEDIUM | LOW | P2 |
| Multi-provider support | MEDIUM | HIGH | P3 |
| Custom business metric gates | LOW | HIGH | P3 |
| Auto-rollback on breach | LOW | MEDIUM | P3 (anti-feature v1) |
| GitOps flag sync | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | LaunchDarkly | Statsig | Unleash | Harness/Split | Codefresh GitOps | Our Approach |
|---------|--------------|---------|---------|-----------------|------------------|--------------|
| Multi-env promotion | Release Pipelines (phases per env) | Release Pipelines (phases + env rules) | Manual env config update; release plans per env | Pipeline steps per env | Promotion Flows across envs | Orchestrated pipeline dev→staging→prod as single unit |
| Sub-stage % rollout | Progressive/guarded rollouts | Phase rules with targeting | Milestones with % strategies | Percentage rollouts | N/A (deployment-level) | Pre-release → canary → stagger within each transition |
| Telemetry gates | Guarded rollouts (LD metrics, sequential testing) | Manual approval + time; no native SLO gates | Safeguards on impact metrics | Alert policies + release monitoring | Promotion Workflows (custom) | External SLO gates (error rate + latency) from observability stack |
| On breach behavior | Pause + optional auto-rollback | Abort reverts; pause bake timer | Safeguard pauses automation | Alert + kill switch | Workflow failure blocks promotion | Pause-and-alert only (v1); operator decides rollback |
| Approval gates | Per-environment approvals + pipeline phases | requiredReview per phase | Manual milestone start | Pipeline governance | Promotion Policies | Optional per stage; platform-configured |
| Self-service trigger | Flag-level in LD UI | Approve/Skip actions | Start milestone manually | Pipeline trigger | Drag-and-drop promotion | Dev trigger within platform guardrails |
| Provider adapter model | Native (flag store) | Native (flag store) | Native (flag store) | Native (flag store) | GitOps (not FF provider) | Orchestration atop LaunchDarkly; no flag store |
| API + CLI | REST API + ldcli | REST API | REST API | REST API + pipeline YAML | REST API + YAML CRDs | REST API + CLI required in v1 |
| Audit trail | Approval history, change log | Pipeline action log | Release plan history | Audit trails | Git commit traceability | Promotion event log with actor + gate results |
| Dashboard | Monitoring tab, pipeline sidebar | Pipeline management UI | Release plan UI | Flag definition + alerts | Releases + Promotion Flow builder | Unified pipeline status + telemetry visualization |

## Sources

- [LaunchDarkly Release Pipelines](https://docs.launchdarkly.com/home/releases/release-pipelines/) — HIGH confidence
- [LaunchDarkly Guarded Rollouts](https://docs.launchdarkly.com/home/releases/guarded-rollouts/) — HIGH confidence
- [LaunchDarkly Approvals](https://docs.launchdarkly.com/home/releases/approvals/) — HIGH confidence
- [LaunchDarkly Release Policies API (beta)](https://launchdarkly.com/docs/api/release-policies-beta) — HIGH confidence (Context7)
- [Statsig Release Pipeline Overview](https://docs.statsig.com/release-pipeline/overview) — HIGH confidence
- [Statsig Release Pipeline Actions](https://docs.statsig.com/release-pipeline/actions) — HIGH confidence
- [Unleash Release Management Overview](https://docs.getunleash.io/concepts/release-management-overview) — HIGH confidence
- [Harness Feature Management & Experimentation](https://www.harness.io/products/feature-management-experimentation) — MEDIUM confidence
- [Harness Alert Policies (Split)](https://developer.harness.io/docs/feature-management-experimentation/experimentation/metrics/alert-policies/) — HIGH confidence
- [Codefresh Promotions Overview](https://codefresh.io/docs/docs/promotions/promotions-overview/) — HIGH confidence
- [Flagger Metrics Analysis](https://docs.flagger.app/main/usage/metrics) — HIGH confidence
- [Argo Rollouts Documentation](https://argo-rollouts.readthedocs.io/) — HIGH confidence
- [Feature Flags Best Practices (DesignRevision)](https://designrevision.com/blog/feature-flags-best-practices) — MEDIUM confidence (industry synthesis)
- [Cadence Feature Flag Rollout Playbook](https://cadence.withremote.ai/blog/feature-flags-rollout) — MEDIUM confidence (industry synthesis)

---
*Feature research for: Feature Flag Promotion Orchestration System*
*Researched: 2026-06-20*
