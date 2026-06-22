import type { Client } from '@temporalio/client';
import { Connection, Client as TemporalClient } from '@temporalio/client';
import { createPrismaClient, PromotionRunRepository } from '@ff-promo/db';
import { PROMOTION_WORKFLOW_TYPE } from './signals.js';

export type StartPromotionRunInput = {
	promotionRunId: string;
	temporalAddress?: string;
	taskQueue?: string;
	actor: {
		actorType: 'user' | 'system' | 'api_key';
		actorId: string;
		displayName?: string;
	};
	temporalClient?: Client;
	databaseUrl?: string;
};

export async function startPromotionRun(input: StartPromotionRunInput) {
	const databaseUrl = input.databaseUrl ?? process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is required for startPromotionRun');
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

		if (run.status !== 'pending') {
			throw new Error(
				`Promotion run ${input.promotionRunId} must be pending (current: ${run.status})`,
			);
		}

		const repo = new PromotionRunRepository(db);
		await repo.updateState({
			promotionRunId: run.id,
			status: 'active',
			temporalWorkflowId: run.id,
		});

		const taskQueue =
			input.taskQueue ?? process.env.TEMPORAL_TASK_QUEUE ?? 'promotion';

		let client = input.temporalClient;
		let ownedConnection: Connection | undefined;

		if (!client) {
			const address =
				input.temporalAddress ??
				process.env.TEMPORAL_ADDRESS ??
				'localhost:7233';
			ownedConnection = await Connection.connect({ address });
			client = new TemporalClient({ connection: ownedConnection });
		}

		try {
			await client.workflow.start(PROMOTION_WORKFLOW_TYPE, {
				workflowId: run.id,
				taskQueue,
				args: [
					{
						promotionRunId: run.id,
						stageCount: run.pipeline.stages.length,
						actor: input.actor,
					},
				],
			});
		} finally {
			await ownedConnection?.close();
		}

		return { workflowId: run.id, runId: run.id };
	} finally {
		await db.$disconnect();
	}
}
