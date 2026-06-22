# Phase 4 Discussion Log

**Date:** 2026-06-22
**Phase:** Promotion Engine
**Mode:** yolo (autonomous — recommended defaults selected)

## Areas Discussed

### 1. LD Write vs Gate Ordering
| Question | Options | Selection |
|----------|---------|-----------|
| When to write LD targeting | Before gates on current env / After gates pass to next env / You decide | **Apply targeting for current stage env, then evaluate gates; advance index only on pass** |
| Cross-environment writes | Write next env early / Only after pass | **No write to next environment until gates pass** |

### 2. Gate Re-evaluation Cadence
| Question | Options | Selection |
|----------|---------|-----------|
| Evaluation frequency | Once per attempt / Poll on interval / You decide | **Once per stage attempt** |
| After gate fail | Pause for manual resume / Auto-retry timer | **Pause until operator resume (pause-and-alert)** |

### 3. Pre-flight Placement
| Question | Options | Selection |
|----------|---------|-----------|
| When to run TELE-04 | Workflow start only / Before each stage / Both | **Once at workflow start** |
| On pre-flight fail | Block start / Warn only | **Fail closed — abort run, no stage advancement** |

### 4. Starting Runs (PIPE-02)
| Question | Options | Selection |
|----------|---------|-----------|
| How developer starts run in Phase 4 | Worker dev script + tests / Minimal REST / You decide | **Worker-side Temporal starter only; REST in Phase 5** |

### 5. Variation ID Resolution
| Question | Options | Selection |
|----------|---------|-----------|
| When to resolve LD variation IDs | Once at start / Per stage per environment | **Per stage at entry via getFlagState** |

### 6. Emergency Stop (SAFE-02)
| Question | Options | Selection |
|----------|---------|-----------|
| Abort semantics | Immediate halt / Drain in-flight | **Immediate abort via abortSignal** |
| Phase 4 surface | Test helper only / REST now | **Test helper + signal; REST in Phase 5** |

## Auto-Selected Log
```
[yolo] Selected all gray areas: LD ordering, gate cadence, pre-flight, run start, variation resolution, emergency stop
[yolo] Activity architecture — Q: "Where does orchestration live?" → Workflow thin, new activities for preflight/apply/evaluate (recommended)
[yolo] Gate persistence — Q: "How many GateResult rows?" → One per GatePolicy per evaluation (recommended)
```

## Areas Skipped
None — all identified gray areas auto-resolved under yolo mode.

## Deferred Ideas
- Sub-stage rollouts, soak timers, alerting integrations, REST/CLI control, auto-retry polling, automatic rollback
