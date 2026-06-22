import type { PrismaClient } from '../../generated/client/index.js';
import { AuditRepository } from './audit.repository.js';
import { GateResultRepository } from './gate-result.repository.js';
import { PipelineAuditRepository } from './pipeline-audit.repository.js';
import { PipelineRepository } from './pipeline.repository.js';
import { PromotionRunRepository } from './promotion-run.repository.js';

export { AuditRepository } from './audit.repository.js';
export { GateResultRepository } from './gate-result.repository.js';
export { PipelineAuditRepository } from './pipeline-audit.repository.js';
export { PipelineRepository } from './pipeline.repository.js';
export { PromotionRunRepository } from './promotion-run.repository.js';

export function createRepositories(db: PrismaClient) {
  return {
    pipeline: new PipelineRepository(db),
    pipelineAudit: new PipelineAuditRepository(db),
    promotionRun: new PromotionRunRepository(db),
    gateResult: new GateResultRepository(db),
    audit: new AuditRepository(db),
  };
}
