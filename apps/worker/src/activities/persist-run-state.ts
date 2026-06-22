import { PersistRunStateInputSchema } from '@ff-promo/contracts';
import {
  createPrismaClient,
  PromotionRunRepository,
  type PromotionRun,
} from '@ff-promo/db';

/**
 * Persists promotion run state to Postgres (canonical source per D-07).
 * Requires DATABASE_URL — local dev needs docker compose postgres running.
 */
export async function persistRunState(
  input: Parameters<PromotionRunRepository['updateState']>[0],
): Promise<PromotionRun> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for persistRunState activity');
  }

  PersistRunStateInputSchema.parse({
    promotionRunId: input.promotionRunId,
    status: input.status,
    currentStageIndex: input.currentStageIndex,
    pauseReason: input.pauseReason,
  });

  const db = createPrismaClient(databaseUrl);
  try {
    const repo = new PromotionRunRepository(db);
    return await repo.updateState(input);
  } finally {
    await db.$disconnect();
  }
}
