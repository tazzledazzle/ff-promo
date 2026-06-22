import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
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
} from '../../../../packages/db/src/__tests__/setup.js';
import { startPromotionRun } from '../lib/start-promotion-run.js';
import { promotionWorkflow } from '../workflows/promotion.workflow.js';
import { createMockActivities } from './helpers/mock-activities.js';

const require = createRequire(import.meta.url);
const workflowsPath = require.resolve('../workflows/promotion.workflow.ts');

const TASK_QUEUE = 'test-start-promotion-run';

async function seedPendingRun() {
	const db = createPrismaClient(getTestDatabaseUrl()!);
	const pipelineRepo = new PipelineRepository(db);
	const pipeline = await pipelineRepo.create({
		name: `start-run-${randomUUID()}`,
		flagKey: 'workflow-test-flag',
		projectKey: 'default',
		stages: [
			{
				orderIndex: 0,
				environment: 'dev',
				displayName: 'Dev',
				gatePolicies: [
					{
						metricType: 'error_rate',
						threshold: 0.01,
						serviceName: 'api',
					},
				],
			},
		],
	});
	const runRepo = new PromotionRunRepository(db);
	const run = await runRepo.create({
		pipelineId: pipeline.id,
		flagKey: 'workflow-test-flag',
	});
	await db.$disconnect();
	return run;
}

describe('startPromotionRun', () => {
	let testEnv: TestWorkflowEnvironment;

	beforeAll(async () => {
		await startTestDatabase();
		testEnv = await TestWorkflowEnvironment.createTimeSkipping();
	}, 120_000);

	afterAll(async () => {
		await testEnv?.teardown();
		await stopTestDatabase();
	});

	it('PIPE-02: transitions pending run to active and starts workflow', async () => {
		const run = await seedPendingRun();
		const mockActivities = createMockActivities();

		const worker = await Worker.create({
			connection: testEnv.nativeConnection,
			taskQueue: TASK_QUEUE,
			workflowsPath,
			activities: mockActivities,
		});

		await worker.runUntil(async () => {
			const result = await startPromotionRun({
				promotionRunId: run.id,
				taskQueue: TASK_QUEUE,
				actor: { actorType: 'system', actorId: 'test' },
				temporalClient: testEnv.client,
			});

			expect(result.workflowId).toBe(run.id);
			expect(result.runId).toBe(run.id);

			const handle = testEnv.client.workflow.getHandle(run.id);
			await handle.result();
		});

		const db = createPrismaClient(getTestDatabaseUrl()!);
		const updated = await db.promotionRun.findUnique({ where: { id: run.id } });
		expect(updated?.status).toBe('completed');
		expect(updated?.temporalWorkflowId).toBe(run.id);
		await db.$disconnect();
	});
});
