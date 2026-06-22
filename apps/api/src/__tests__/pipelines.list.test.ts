import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, PipelineRepository } from '@ff-promo/db';
import {
	getTestDatabaseUrl,
	startTestDatabase,
	stopTestDatabase,
} from '../../../../packages/db/src/__tests__/setup.js';
import { buildApp } from '../app.js';
import { createPromotionRunService } from '../services/promotion-run.service.js';
import { createMockTemporalClient } from './helpers/mock-temporal.js';

describe('pipelines list route', () => {
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

	it('returns active pipelines with stage counts', async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const pipelineRepo = new PipelineRepository(db);
		const pipeline = await pipelineRepo.create({
			name: `pipelines-list-${randomUUID()}`,
			flagKey: 'pipelines-list-flag',
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
				{
					orderIndex: 1,
					environment: 'staging',
					displayName: 'Staging',
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

		const response = await app.inject({
			method: 'GET',
			url: '/v1/pipelines',
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		const item = body.pipelines.find(
			(entry: { id: string }) => entry.id === pipeline.id,
		);
		expect(item).toMatchObject({
			id: pipeline.id,
			name: pipeline.name,
			flagKey: pipeline.flagKey,
			stageCount: 2,
		});
	});
});
