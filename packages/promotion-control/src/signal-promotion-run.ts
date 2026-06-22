import type { Client } from '@temporalio/client';
import { Connection, Client as TemporalClient } from '@temporalio/client';
import { createPrismaClient } from '@ff-promo/db';
import {
	abortSignal,
	pauseSignal,
	resumeSignal,
	statusQuery,
} from './signals.js';

export type PromotionControlAction = 'pause' | 'resume' | 'abort';

export async function resolveWorkflowId(
	promotionRunId: string,
	databaseUrl = process.env.DATABASE_URL,
) {
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is required');
	}
	const db = createPrismaClient(databaseUrl);
	try {
		const run = await db.promotionRun.findUniqueOrThrow({
			where: { id: promotionRunId },
		});
		return run.temporalWorkflowId ?? run.id;
	} finally {
		await db.$disconnect();
	}
}

async function getClient(temporalClient?: Client, temporalAddress?: string) {
	if (temporalClient) {
		return { client: temporalClient, ownedConnection: undefined };
	}
	const address =
		temporalAddress ?? process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
	const ownedConnection = await Connection.connect({ address });
	return {
		client: new TemporalClient({ connection: ownedConnection }),
		ownedConnection,
	};
}

export async function signalPromotionRun(input: {
	promotionRunId: string;
	action: PromotionControlAction;
	temporalClient?: Client;
	temporalAddress?: string;
	databaseUrl?: string;
}) {
	const workflowId = await resolveWorkflowId(
		input.promotionRunId,
		input.databaseUrl,
	);
	const { client, ownedConnection } = await getClient(
		input.temporalClient,
		input.temporalAddress,
	);

	try {
		const handle = client.workflow.getHandle(workflowId);
		switch (input.action) {
			case 'pause':
				await handle.signal(pauseSignal);
				break;
			case 'resume':
				await handle.signal(resumeSignal);
				break;
			case 'abort':
				await handle.signal(abortSignal);
				break;
		}
	} finally {
		await ownedConnection?.close();
	}
}

export async function queryPromotionStatus(input: {
	promotionRunId: string;
	temporalClient?: Client;
	temporalAddress?: string;
	databaseUrl?: string;
}) {
	const workflowId = await resolveWorkflowId(
		input.promotionRunId,
		input.databaseUrl,
	);
	const { client, ownedConnection } = await getClient(
		input.temporalClient,
		input.temporalAddress,
	);

	try {
		const handle = client.workflow.getHandle(workflowId);
		return await handle.query(statusQuery);
	} finally {
		await ownedConnection?.close();
	}
}
