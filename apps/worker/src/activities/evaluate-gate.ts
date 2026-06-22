import { GateResultRepository, createPrismaClient } from '@ff-promo/db';

export interface EvaluateGateInput {
  promotionRunId: string;
  stageIndex: number;
}

export interface EvaluateGateResult {
  verdict: 'pass' | 'fail';
  gateResultId: string;
}

/**
 * Stub gate evaluation (D-11) — always returns pass with mock metrics.
 * Requires DATABASE_URL — local dev needs docker compose postgres running.
 */
export async function evaluateGate(
  input: EvaluateGateInput,
): Promise<EvaluateGateResult> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for evaluateGate activity');
  }

  const db = createPrismaClient(databaseUrl);
  try {
    const run = await db.promotionRun.findUniqueOrThrow({
      where: { id: input.promotionRunId },
      include: {
        pipeline: {
          include: {
            stages: { orderBy: { orderIndex: 'asc' } },
          },
        },
      },
    });

    const stage = run.pipeline.stages.find(
      (s) => s.orderIndex === input.stageIndex,
    );
    if (!stage) {
      throw new Error(
        `Stage orderIndex ${input.stageIndex} not found for run ${input.promotionRunId}`,
      );
    }

    const gateResultRepo = new GateResultRepository(db);
    const gateResult = await gateResultRepo.create({
      promotionRunId: input.promotionRunId,
      stageId: stage.id,
      verdict: 'pass',
      metricType: 'error_rate',
      observedValue: 0.001,
      threshold: 0.01,
      metadata: { stub: true, message: 'Phase 1 mock pass' },
    });

    return { verdict: 'pass', gateResultId: gateResult.id };
  } finally {
    await db.$disconnect();
  }
}
