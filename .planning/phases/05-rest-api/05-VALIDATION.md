# Phase 5 Validation Strategy

**Phase:** REST API  
**Requirements:** API-01, API-02, SAFE-02 (abort via API)

## Automated Gate

| Command | When |
|---------|------|
| `pnpm exec vitest run --project api` | Per task / plan |
| `pnpm --filter @ff-promo/api run build` | Wave merge / phase gate |
| `pnpm exec vitest run --project worker start-promotion-run` | Regression after promotion-control extract |
| `pnpm exec vitest run --project db` | Regression |

## Requirement → Test Map

| Req | Behavior | Test file pattern |
|-----|----------|-------------------|
| API-01 | Create pending promotion run | `promotion-runs.control` |
| API-01 | Start workflow | `promotion-runs.control`, `api.integration` |
| API-01 | Pause / resume / abort | `promotion-runs.control` |
| API-02 | GET status | `promotion-runs.read`, `api.integration` |
| API-02 | GET gate-results history | `promotion-runs.read`, `api.integration` |
| SC-3 | Gate forensics on paused status | `promotion-runs.read`, `api.integration` |
| SAFE-02 | Abort via POST .../abort | `promotion-runs.control` |

## Manual Smoke (optional)

```bash
pnpm --filter @ff-promo/api dev
curl http://localhost:3000/health
open http://localhost:3000/documentation
```

## CI Notes

- API integration tests use testcontainers PostgreSQL (same as worker/db)
- Temporal client mocked in unit tests; optional live Temporal for manual E2E
