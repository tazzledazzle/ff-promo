import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import nock from 'nock';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
import * as realActivities from '../activities/index.js';
import {
	LD_BASE_URL,
	nockLdGetFlag,
	nockLdPatchFlag,
	setupLdNockEnv,
} from './helpers/nock-launchdarkly.js';
import {
	nockPrometheusGateFail,
	nockPrometheusPass,
	nockPrometheusPreflightPass,
	setupPrometheusNockEnv,
} from './helpers/nock-prometheus.js';

const require = createRequire(import.meta.url);
const workflowsPath = require.resolve('../workflows/promotion.workflow.ts');

const TASK_QUEUE = 'test-promotion-engine-integration';

async function seedPipeline(options?: {
	stageCount?: number;
	policyCount?: number;
}) {
	const stageCount = options?.stageCount ?? 1;
	const policyCount = options?.policyCount ?? 1;
	const environments = ['dev', 'staging', 'prod'] as const;

	const policies =
		policyCount === 2
			? [
					{
						metricType: 'error_rate',
						threshold: 0.01,
						serviceName: 'api',
					},
					{
						metricType: 'latency_p95',
						threshold: 500,
						serviceName: 'api',
					},
				]
			: [
					{
						metricType: 'error_rate',
						threshold: 0.01,
						serviceName: 'api',
					},
				];

	const db = createPrismaClient(getTestDatabaseUrl()!);
	const pipelineRepo = new PipelineRepository(db);
	const pipeline = await pipelineRepo.create({
		name: `engine-e2e-${randomUUID()}`,
		flagKey: 'workflow-test-flag',
		projectKey: 'default',
		stages: Array.from({ length: stageCount }, (_, orderIndex) => ({
			orderIndex,
			environment: environments[orderIndex] ?? 'dev',
			displayName: environments[orderIndex] ?? `Stage ${orderIndex}`,
			gatePolicies: policies,
		})),
	});
	const runRepo = new PromotionRunRepository(db);
	const run = await runRepo.create({
		pipelineId: pipeline.id,
		flagKey: 'workflow-test-flag',
	});
	await db.$disconnect();
	return { run, stageCount, policyCount };
}

function nockHappyPath(stageCount: number, policyCount: number) {
	nockLdGetFlag('default', 'workflow-test-flag', stageCount * 4 + 1);
	for (let i = 0; i < stageCount; i += 1) {
		nockLdPatchFlag('default', 'workflow-test-flag');
	}
	nockPrometheusPreflightPass();
	const promQueriesPerStage = policyCount * 4;
	nockPrometheusPass(2 + stageCount * promQueriesPerStage);
}

describe('promotion engine integration', () => {
	let testEnv: TestWorkflowEnvironment;

	beforeAll(async () => {
		await startTestDatabase();
		testEnv = await TestWorkflowEnvironment.createTimeSkipping();
	}, 120_000);

	afterAll(async () => {
		await testEnv?.teardown();
		await stopTestDatabase();
	});

	beforeEach(() => {
		nock.cleanAll();
		setupLdNockEnv();
		setupPrometheusNockEnv();
	});

	afterEach(() => {
		nock.cleanAll();
	});

	it('PIPE-02/03: startPromotionRun completes when gates pass', async () => {
		const { run, stageCount, policyCount } = await seedPipeline({
			stageCount: 1,
			policyCount: 1,
		});
		nockHappyPath(stageCount, policyCount);

		const worker = await Worker.create({
			connection: testEnv.nativeConnection,
			taskQueue: TASK_QUEUE,
			workflowsPath,
			activities: realActivities,
		});

		await worker.runUntil(async () => {
			await startPromotionRun({
				promotionRunId: run.id,
				taskQueue: TASK_QUEUE,
				actor: { actorType: 'system', actorId: 'integration-test' },
				temporalClient: testEnv.client,
			});

			const handle = testEnv.client.workflow.getHandle(run.id);
			await handle.result();
		});

		const db = createPrismaClient(getTestDatabaseUrl()!);
		const updated = await db.promotionRun.findUnique({ where: { id: run.id } });
		expect(updated?.status).toBe('completed');
		expect(updated?.currentStageIndex).toBe(1);

		const gateResults = await db.gateResult.count({
			where: { promotionRunId: run.id },
		});
		expect(gateResults).toBe(1);
		await db.$disconnect();
		expect(nock.isDone()).toBe(true);
	});

	it('D-12: two GateResult rows when stage has two policies', async () => {
		const { run, stageCount, policyCount } = await seedPipeline({
			stageCount: 1,
			policyCount: 2,
		});
		nockHappyPath(stageCount, policyCount);

		const worker = await Worker.create({
			connection: testEnv.nativeConnection,
			taskQueue: TASK_QUEUE,
			workflowsPath,
			activities: realActivities,
		});

		await worker.runUntil(async () => {
			await testEnv.client.workflow.execute(promotionWorkflow, {
				workflowId: run.id,
				taskQueue: TASK_QUEUE,
				args: [
					{
						promotionRunId: run.id,
						stageCount: 1,
						actor: { actorType: 'system', actorId: 'integration-test' },
					},
				],
			});
		});

		const db = createPrismaClient(getTestDatabaseUrl()!);
		const gateResults = await db.gateResult.count({
			where: { promotionRunId: run.id },
		});
		expect(gateResults).toBe(2);
		await db.$disconnect();
	});

	it('PIPE-04: gate fail pauses run with pauseReason', async () => {
		const { run } = await seedPipeline({ stageCount: 1, policyCount: 1 });
		nockLdGetFlag('default', 'workflow-test-flag', 4);
		nockLdPatchFlag('default', 'workflow-test-flag');
		nockPrometheusPreflightPass();
		nockPrometheusGateFail(4);

		const worker = await Worker.create({
			connection: testEnv.nativeConnection,
			taskQueue: TASK_QUEUE,
			workflowsPath,
			activities: realActivities,
		});

		await worker.runUntil(async () => {
			const handle = await testEnv.client.workflow.start(promotionWorkflow, {
				workflowId: run.id,
				taskQueue: TASK_QUEUE,
				args: [
					{
						promotionRunId: run.id,
						stageCount: 1,
						actor: { actorType: 'system', actorId: 'integration-test' },
					},
				],
			});

			await testEnv.sleep('1 second');

			const db = createPrismaClient(getTestDatabaseUrl()!);
			const paused = await db.promotionRun.findUnique({ where: { id: run.id } });
			expect(paused?.status).toBe('paused');
			expect(paused?.pauseReason).toBeTruthy();
			expect(paused?.currentStageIndex).toBe(0);
			await db.$disconnect();

			await handle.terminate('test cleanup');
		});
	});
});
