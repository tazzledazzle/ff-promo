# Phase 3 Discussion Log

**Date:** 2026-06-22
**Phase:** Telemetry Adapter

## Areas Discussed

### 1. Cohort Attribution
| Question | Options | Selection |
|----------|---------|-----------|
| Metric attribution model | LD variation labels / Service-level only / Custom attribute | **LD variation labels** (`ld_flag_key`, `ld_variation_id`, etc.) |
| Treatment vs control | Delta vs control / Absolute treatment / Both | **Delta vs control** |
| Context kind enforcement | `user` / Any / Configurable per pipeline | **`user` context kind** |
| PromQL construction | Standard labels / Templates in GatePolicy / You decide | **Standard label contract + built-in PromQL** |

### 2. Missing / Stale Data
| Question | Options | Selection |
|----------|---------|-----------|
| Empty Prometheus response | Fail closed / Inconclusive / Fail pre-flight only | **Fail closed** |
| Below minSampleSize | Fail / Ignore when 0 / Inconclusive | **Fail below minSampleSize** |
| Evaluation window | Window-bound instant / Range query / You decide | **Window-bound instant** (`windowSeconds`) |
| Multi-policy stages | All must pass / Per-metric results / You decide | **All policies must pass** |

### 3. Local Dev & Testing
| Question | Options | Selection |
|----------|---------|-----------|
| Test strategy | nock only / Docker Prometheus / Both | **nock + optional docker-compose Prometheus** |
| Connection config | Env vars / Config object / Both | **Config param + env fallback** |
| Package location | packages/telemetry / telemetry-adapter / You decide | **packages/telemetry** |
| Fixtures | JSON fixtures / Inline mocks / You decide | **JSON fixtures** |

## Areas Skipped
- **Pre-flight checks** — not explicitly discussed; TELE-04 decisions inferred in CONTEXT.md (D-10–D-12)

## Deferred Ideas
- Inconclusive verdict state
- Raw PromQL templates in GatePolicy
- Datadog adapter (v2)
