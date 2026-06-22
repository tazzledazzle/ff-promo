import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	createPrismaClient,
	PipelineRepository,
	PromotionRunRepository,
} from '@ff-promo/db';
import {
	getTestDatabaseUrl,
	startTestDatabase,
	stopTestDatabase,
} from '../../../../../packages/db/src/__tests__/setup.js';
import { loadAllGatePolicies, loadRunStageContext } from '../load-run-context.js';

async function seedPipeline(stageCount = 2) {
	const dbUrl = getTestDatabaseUrl();
	if (!dbUrl) {
		throw new Error('Test database not started');
	}

	const db = createPrismaClient(dbUrl);
	const pipelineRepo = new PipelineRepository(db);
	const pipeline = await pipelineRepo.create({
		name: `load-context-${randomUUID()}`,
		flagKey: 'load-context-flag',
		projectKey: 'default',
		stages: Array.from({ length: stageCount }, (_, orderIndex) => ({
			orderIndex,
			environment: ['dev', 'staging'][orderIndex] ?? 'dev',
			displayName: `Stage ${orderIndex}`,
			gatePolicies: [
				{
					metricType: 'error_rate',
					threshold: 0.01,
					serviceName: 'api',
				},
			],
		})),
	});

	const runRepo = new PromotionRunRepository(db);
	const run = await runRepo.create({
		pipelineId: pipeline.id,
		flagKey: 'load-context-flag',
	});

	await db.$disconnect();
	return run;
}

describe('load-run-context', () => {
	beforeAll(async () => {
		await startTestDatabase();
	}, 120_000);

	afterAll(async () => {
		await stopTestDatabase();
	});

	it('loads stage gate policies for a promotion run', async () => {
		const run = await seedPipeline(2);
		const context = await loadRunStageContext(run.id, 0);

		expect(context.flagKey).toBe('load-context-flag');
		expect(context.projectKey).toBe('default');
		expect(context.stage.orderIndex).toBe(0);
		expect(context.gatePolicies).toHaveLength(1);
		expect(context.gatePolicies[0]?.metricType).toBe('error_rate');
	});

	it('throws when stage index is missing', async () => {
		const run = await seedPipeline(1);
		await expect(loadRunStageContext(run.id, 99)).rejects.toThrow(
			/Stage orderIndex 99 not found/,
		);
	});

	it('loadAllGatePolicies returns policies across stages', async () => {
		const run = await seedPipeline(2);
		const { gatePolicies, stages } = await loadAllGatePolicies(run.id);

		expect(stages).toHaveLength(2);
		expect(gatePolicies).toHaveLength(2);
	});
});
