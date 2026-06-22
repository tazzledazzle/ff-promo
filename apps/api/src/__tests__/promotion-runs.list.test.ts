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
} from '../../../../packages/db/src/__tests__/setup.js';
import { buildApp } from '../app.js';
import { createPromotionRunService } from '../services/promotion-run.service.js';
import { createMockTemporalClient } from './helpers/mock-temporal.js';

describe('promotion-runs list route', () => {
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

	it('returns runs ordered by updatedAt desc with stage metadata', async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const pipelineRepo = new PipelineRepository(db);
		const pipeline = await pipelineRepo.create({
			name: `list-${randomUUID()}`,
			flagKey: 'list-flag',
			projectKey: 'default',
			stages: [
				{
					orderIndex: 0,
					environment: 'dev',
					displayName: 'Development',
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
			flagKey: 'list-flag',
		});
		await runRepo.updateState({
			promotionRunId: run.id,
			status: 'active',
			currentStageIndex: 0,
			temporalWorkflowId: run.id,
		});
		await db.$disconnect();

		const response = await app.inject({
			method: 'GET',
			url: '/v1/promotion-runs',
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.runs.length).toBeGreaterThanOrEqual(1);
		const item = body.runs.find((entry: { id: string }) => entry.id === run.id);
		expect(item.pipelineName).toBe(pipeline.name);
		expect(item.currentEnvironment).toBe('dev');
		expect(item.currentStageDisplayName).toBe('Development');
	});

	it('filters by status when query param provided', async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const pipelineRepo = new PipelineRepository(db);
		const pipeline = await pipelineRepo.create({
			name: `filter-${randomUUID()}`,
			flagKey: 'filter-flag',
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
			flagKey: 'filter-flag',
		});
		await runRepo.updateState({
			promotionRunId: run.id,
			status: 'active',
			temporalWorkflowId: run.id,
		});
		await db.$disconnect();

		const response = await app.inject({
			method: 'GET',
			url: '/v1/promotion-runs?status=active',
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.runs.every((entry: { status: string }) => entry.status === 'active')).toBe(
			true,
		);
		expect(body.runs.some((entry: { id: string }) => entry.id === run.id)).toBe(true);
	});
});
