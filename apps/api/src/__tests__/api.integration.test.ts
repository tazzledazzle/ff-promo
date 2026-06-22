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
import { standardStages } from './helpers/pipeline-test-fixtures.js';

describe('API integration', () => {
	const { client: temporalClient, start } = createMockTemporalClient();
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

	it('D-18/API-02: create → start → GET active status', async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const pipelineRepo = new PipelineRepository(db);
		const pipeline = await pipelineRepo.create({
			name: `api-e2e-${randomUUID()}`,
			flagKey: 'api-e2e-flag',
			projectKey: 'default',
			stages: [standardStages('api')[0]!],
		});
		await db.$disconnect();

		const createResponse = await app.inject({
			method: 'POST',
			url: '/v1/promotion-runs',
			payload: {
				pipelineId: pipeline.id,
				flagKey: 'api-e2e-flag',
				actor: { actorType: 'api_key', actorId: 'e2e' },
			},
		});
		expect(createResponse.statusCode).toBe(201);
		const runId = createResponse.json().id;

		const pendingStatus = await app.inject({
			method: 'GET',
			url: `/v1/promotion-runs/${runId}`,
		});
		expect(pendingStatus.json().run.status).toBe('pending');

		start.mockClear();
		const startResponse = await app.inject({
			method: 'POST',
			url: `/v1/promotion-runs/${runId}/start`,
			payload: { actor: { actorType: 'api_key', actorId: 'e2e' } },
		});
		expect(startResponse.statusCode).toBe(200);
		expect(start).toHaveBeenCalledOnce();

		const activeStatus = await app.inject({
			method: 'GET',
			url: `/v1/promotion-runs/${runId}`,
		});
		expect(activeStatus.json().run.status).toBe('active');
	});
});
