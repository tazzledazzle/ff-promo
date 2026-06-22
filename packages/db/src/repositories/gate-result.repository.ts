import {
  GateResultCreateInputSchema,
  type GateResultCreateInput,
} from '@ff-promo/contracts';
import { Prisma, type PrismaClient } from '../../generated/client/index.js';

export class GateResultRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: GateResultCreateInput) {
    const data = GateResultCreateInputSchema.parse(input);

    return this.db.gateResult.create({
      data: {
        promotionRunId: data.promotionRunId,
        stageId: data.stageId,
        verdict: data.verdict,
        metricType: data.metricType,
        observedValue: data.observedValue,
        threshold: data.threshold,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async findByRunId(promotionRunId: string) {
    return this.db.gateResult.findMany({
      where: { promotionRunId },
      orderBy: { evaluatedAt: 'desc' },
    });
  }

  async findByRunAndStage(promotionRunId: string, stageId: string) {
    return this.db.gateResult.findMany({
      where: { promotionRunId, stageId },
      orderBy: { evaluatedAt: 'desc' },
    });
  }
}
