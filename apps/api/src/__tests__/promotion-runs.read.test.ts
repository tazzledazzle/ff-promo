import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	createPrismaClient,
	GateResultRepository,
	PipelineRepository,
	PromotionRunRepository,
} from '@ff-promo/db';
import {
	getTestDatabaseUrl,
	startTestDatabase,
	stopTestDatabase,
} from '../../../../packages/db/src/__tests__/setup.js';
import { buildApp } from '../app.js';
import { createPromotionRunService } from '../services/promotion-run.service.js';
import { createMockTemporalClient } from './helpers/mock-temporal.js';
import { standardStages } from './helpers/pipeline-test-fixtures.js';

async function seedPausedRunWithGateFail() {
	const db = createPrismaClient(getTestDatabaseUrl()!);
	const pipelineRepo = new PipelineRepository(db);
	const pipeline = await pipelineRepo.create({
		name: `api-read-${randomUUID()}`,
		flagKey: 'api-read-flag',
		projectKey: 'default',
		stages: [standardStages('api')[0]!],
	});
	const stage = pipeline.stages[0]!;
	const runRepo = new PromotionRunRepository(db);
	const run = await runRepo.create({
		pipelineId: pipeline.id,
		flagKey: 'api-read-flag',
	});
	await runRepo.updateState({
		promotionRunId: run.id,
		status: 'paused',
		pauseReason: 'threshold_exceeded',
		temporalWorkflowId: run.id,
	});

	const gateResultRepo = new GateResultRepository(db);
	await gateResultRepo.create({
		promotionRunId: run.id,
		stageId: stage.id,
		verdict: 'fail',
		metricType: 'error_rate',
		observedValue: 0.05,
		threshold: 0.01,
		metadata: {
			reason: 'threshold_exceeded',
			treatmentValue: 0.05,
			controlValue: 0.01,
			observedDelta: 0.04,
		},
	});

	await db.$disconnect();
	return run;
}

describe('promotion-runs read routes', () => {
	const { client: temporalClient } = createMockTemporalClient();
	let app: Awaited<ReturnType<typeof buildApp>>;

	beforeAll(async () => {
		await startTestDatabase();
		const databaseUrl = getTestDatabaseUrl()!;
		process.env.DATABASE_URL = databaseUrl;

		app = await buildApp({
			env: {
				PORT: 3000,
				DATABASE_URL: databaseUrl,
				TEMPORAL_ADDRESS: 'localhost:7233',
				TEMPORAL_TASK_QUEUE: 'test-api',
			},
			service: createPromotionRunService({
				databaseUrl,
				temporalAddress: 'localhost:7233',
				taskQueue: 'test-api',
				temporalClient,
			}),
		});
	}, 120_000);

	afterAll(async () => {
		await app?.close();
		await stopTestDatabase();
	});

	it('API-02/SC-3: returns gate forensics when paused', async () => {
		const run = await seedPausedRunWithGateFail();

		const response = await app.inject({
			method: 'GET',
			url: `/v1/promotion-runs/${run.id}`,
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.run.status).toBe('paused');
		expect(body.gateForensics?.pauseReason).toBe('threshold_exceeded');
		expect(body.gateForensics?.results).toHaveLength(1);
		expect(body.gateForensics?.results[0]?.reason).toBe('threshold_exceeded');
	});

	it('API-02: lists gate results', async () => {
		const run = await seedPausedRunWithGateFail();

		const response = await app.inject({
			method: 'GET',
			url: `/v1/promotion-runs/${run.id}/gate-results`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toHaveLength(1);
	});
});
