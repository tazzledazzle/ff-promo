import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
import { buildApp } from '../app.js';
import { createPromotionRunService } from '../services/promotion-run.service.js';
import { createMockTemporalClient } from './helpers/mock-temporal.js';

async function seedPipeline() {
	const db = createPrismaClient(getTestDatabaseUrl()!);
	const pipelineRepo = new PipelineRepository(db);
	const pipeline = await pipelineRepo.create({
		name: `api-control-${randomUUID()}`,
		flagKey: 'api-control-flag',
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
	await db.$disconnect();
	return pipeline;
}

async function seedActiveRun(pipelineId: string, flagKey: string) {
	const db = createPrismaClient(getTestDatabaseUrl()!);
	const runRepo = new PromotionRunRepository(db);
	const run = await runRepo.create({ pipelineId, flagKey });
	await runRepo.updateState({
		promotionRunId: run.id,
		status: 'active',
		temporalWorkflowId: run.id,
	});
	await db.$disconnect();
	return run;
}

describe('promotion-runs control routes', () => {
	const { client: temporalClient, start, signal } = createMockTemporalClient();
	let app: Awaited<ReturnType<typeof buildApp>>;

	beforeAll(async () => {
		await startTestDatabase();
		const databaseUrl = getTestDatabaseUrl()!;
		process.env.DATABASE_URL = databaseUrl;

		const service = createPromotionRunService({
			databaseUrl,
			temporalAddress: 'localhost:7233',
			taskQueue: 'test-api',
			temporalClient,
		});

		app = await buildApp({
			env: {
				PORT: 3000,
				DATABASE_URL: databaseUrl,
				TEMPORAL_ADDRESS: 'localhost:7233',
				TEMPORAL_TASK_QUEUE: 'test-api',
			},
			service,
		});
	}, 120_000);

	afterAll(async () => {
		await app?.close();
		await stopTestDatabase();
	});

	it('API-01: creates pending promotion run', async () => {
		const pipeline = await seedPipeline();
		const response = await app.inject({
			method: 'POST',
			url: '/v1/promotion-runs',
			payload: {
				pipelineId: pipeline.id,
				flagKey: 'api-control-flag',
				actor: { actorType: 'api_key', actorId: 'test-key' },
			},
		});

		expect(response.statusCode).toBe(201);
		expect(response.json().status).toBe('pending');
	});

	it('API-01: starts pending run and records audit', async () => {
		const pipeline = await seedPipeline();
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const runRepo = new PromotionRunRepository(db);
		const run = await runRepo.create({
			pipelineId: pipeline.id,
			flagKey: 'api-control-flag',
		});
		await db.$disconnect();

		start.mockClear();
		const response = await app.inject({
			method: 'POST',
			url: `/v1/promotion-runs/${run.id}/start`,
			payload: {
				actor: { actorType: 'api_key', actorId: 'starter' },
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().status).toBe('active');
		expect(start).toHaveBeenCalledOnce();

		const auditDb = createPrismaClient(getTestDatabaseUrl()!);
		const audit = await auditDb.auditEvent.findMany({
			where: { promotionRunId: run.id, action: 'run_started' },
		});
		expect(audit.some((event) => event.actorId === 'starter')).toBe(true);
		await auditDb.$disconnect();
	});

	it('API-01: pauses active run', async () => {
		const pipeline = await seedPipeline();
		const run = await seedActiveRun(pipeline.id, 'api-control-flag');
		signal.mockClear();

		const response = await app.inject({
			method: 'POST',
			url: `/v1/promotion-runs/${run.id}/pause`,
			payload: {},
		});

		expect(response.statusCode).toBe(200);
		expect(signal).toHaveBeenCalled();
	});

	it('API-01: resumes paused run', async () => {
		const pipeline = await seedPipeline();
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const runRepo = new PromotionRunRepository(db);
		const run = await runRepo.create({
			pipelineId: pipeline.id,
			flagKey: 'api-control-flag',
		});
		await runRepo.updateState({
			promotionRunId: run.id,
			status: 'paused',
			temporalWorkflowId: run.id,
		});
		await db.$disconnect();

		signal.mockClear();
		const response = await app.inject({
			method: 'POST',
			url: `/v1/promotion-runs/${run.id}/resume`,
			payload: {},
		});

		expect(response.statusCode).toBe(200);
		expect(signal).toHaveBeenCalled();
	});

	it('SAFE-02: aborts active run via API', async () => {
		const pipeline = await seedPipeline();
		const run = await seedActiveRun(pipeline.id, 'api-control-flag');
		signal.mockClear();

		const response = await app.inject({
			method: 'POST',
			url: `/v1/promotion-runs/${run.id}/abort`,
			payload: {},
		});

		expect(response.statusCode).toBe(200);
		expect(signal).toHaveBeenCalled();
	});

	it('returns 409 for invalid start transition', async () => {
		const pipeline = await seedPipeline();
		const run = await seedActiveRun(pipeline.id, 'api-control-flag');

		const response = await app.inject({
			method: 'POST',
			url: `/v1/promotion-runs/${run.id}/start`,
			payload: {
				actor: { actorType: 'system', actorId: 'test' },
			},
		});

		expect(response.statusCode).toBe(409);
	});
});
