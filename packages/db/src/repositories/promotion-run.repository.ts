import { PersistRunStateInputSchema } from '@ff-promo/contracts';
import { z } from 'zod';
import type { PrismaClient, PromotionStatus } from '../../generated/client/index.js';

const PromotionRunCreateSchema = z.object({
  pipelineId: z.string(),
  flagKey: z.string(),
});

export class PromotionRunRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: { pipelineId: string; flagKey: string }) {
    const { pipelineId, flagKey } = PromotionRunCreateSchema.parse(input);

    const pipeline = await this.db.pipeline.findUniqueOrThrow({
      where: { id: pipelineId },
    });

    return this.db.promotionRun.create({
      data: {
        pipelineId,
        flagKey,
        pipelineVersion: pipeline.version,
      },
    });
  }

  async updateState(input: {
    promotionRunId: string;
    status: PromotionStatus;
    currentStageIndex?: number;
    pauseReason?: string;
    temporalWorkflowId?: string;
  }) {
    const parsed = PersistRunStateInputSchema.parse({
      promotionRunId: input.promotionRunId,
      status: input.status,
      currentStageIndex: input.currentStageIndex,
      pauseReason: input.pauseReason,
    });

    const existing = await this.db.promotionRun.findUniqueOrThrow({
      where: { id: parsed.promotionRunId },
    });

    const isFirstActiveTransition =
      existing.status !== 'active' && parsed.status === 'active';
    const temporalWorkflowId =
      input.temporalWorkflowId ??
      (isFirstActiveTransition && !existing.temporalWorkflowId
        ? parsed.promotionRunId
        : undefined);

    return this.db.promotionRun.update({
      where: { id: parsed.promotionRunId },
      data: {
        status: parsed.status,
        ...(parsed.currentStageIndex !== undefined && {
          currentStageIndex: parsed.currentStageIndex,
        }),
        ...(parsed.pauseReason !== undefined && {
          pauseReason: parsed.pauseReason,
        }),
        ...(temporalWorkflowId !== undefined && { temporalWorkflowId }),
      },
    });
  }

  async findById(id: string) {
    return this.db.promotionRun.findUnique({
      where: { id },
    });
  }

  async findByStatus(status: PromotionStatus) {
    return this.db.promotionRun.findMany({
      where: { status },
    });
  }

  async findRecent(input: { status?: PromotionStatus; limit?: number } = {}) {
    const limit = input.limit ?? 50;

    return this.db.promotionRun.findMany({
      where: input.status ? { status: input.status } : undefined,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        pipeline: {
          include: {
            stages: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });
  }
}
