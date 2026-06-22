import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@ff-promo/db';
import {
	getTestDatabaseUrl,
	startTestDatabase,
	stopTestDatabase,
} from '../../../../packages/db/src/__tests__/setup.js';
import { buildApp } from '../app.js';
import { createPipelineService } from '../services/pipeline.service.js';
import { createPromotionRunService } from '../services/promotion-run.service.js';
import { createMockTemporalClient } from './helpers/mock-temporal.js';
import { createValidPipelinePayload } from './helpers/pipeline-test-fixtures.js';

describe('guardrails integration', () => {
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
			pipelineService: createPipelineService({ databaseUrl }),
		});
	}, 120_000);

	afterAll(async () => {
		await app?.close();
		await stopTestDatabase();
	});

	async function seedPipeline() {
		const response = await app.inject({
			method: 'POST',
			url: '/v1/pipelines',
			payload: createValidPipelinePayload(),
		});
		return response.json();
	}

	it('rejects createRun when flagKey does not match pipeline', async () => {
		const pipeline = await seedPipeline();

		const response = await app.inject({
			method: 'POST',
			url: '/v1/promotion-runs',
			payload: {
				pipelineId: pipeline.id,
				flagKey: 'wrong-flag',
				actor: { actorType: 'user', actorId: 'dev' },
			},
		});

		expect(response.statusCode).toBe(403);
		expect(response.json().error).toBe('forbidden');

		const db = createPrismaClient(getTestDatabaseUrl()!);
		const count = await db.promotionRun.count({
			where: { pipelineId: pipeline.id, flagKey: 'wrong-flag' },
		});
		expect(count).toBe(0);
		await db.$disconnect();
	});

	it('rejects createRun when pipeline is inactive', async () => {
		const pipeline = await seedPipeline();

		await app.inject({
			method: 'PATCH',
			url: `/v1/pipelines/${pipeline.id}`,
			payload: {
				isActive: false,
				actor: { actorType: 'user', actorId: 'platform' },
			},
		});

		const response = await app.inject({
			method: 'POST',
			url: '/v1/promotion-runs',
			payload: {
				pipelineId: pipeline.id,
				flagKey: pipeline.flagKey,
				actor: { actorType: 'user', actorId: 'dev' },
			},
		});

		expect(response.statusCode).toBe(403);
		expect(response.json().message).toContain('inactive');
	});

	it('accepts valid createRun with matching flagKey', async () => {
		const pipeline = await seedPipeline();

		const response = await app.inject({
			method: 'POST',
			url: '/v1/promotion-runs',
			payload: {
				pipelineId: pipeline.id,
				flagKey: pipeline.flagKey,
				actor: { actorType: 'user', actorId: 'dev' },
			},
		});

		expect(response.statusCode).toBe(201);
	});

	it('rejects startRun on deactivated pipeline after pending run created', async () => {
		const pipeline = await seedPipeline();

		const createResponse = await app.inject({
			method: 'POST',
			url: '/v1/promotion-runs',
			payload: {
				pipelineId: pipeline.id,
				flagKey: pipeline.flagKey,
				actor: { actorType: 'user', actorId: 'dev' },
			},
		});
		const run = createResponse.json();

		await app.inject({
			method: 'PATCH',
			url: `/v1/pipelines/${pipeline.id}`,
			payload: {
				isActive: false,
				actor: { actorType: 'user', actorId: 'platform' },
			},
		});

		const startResponse = await app.inject({
			method: 'POST',
			url: `/v1/promotion-runs/${run.id}/start`,
			payload: {
				actor: { actorType: 'user', actorId: 'dev' },
			},
		});

		expect(startResponse.statusCode).toBe(403);
	});

	it('valid self-service flow: createRun then startRun', async () => {
		const pipeline = await seedPipeline();

		const createResponse = await app.inject({
			method: 'POST',
			url: '/v1/promotion-runs',
			payload: {
				pipelineId: pipeline.id,
				flagKey: pipeline.flagKey,
				actor: { actorType: 'user', actorId: 'dev' },
			},
		});
		expect(createResponse.statusCode).toBe(201);
		const run = createResponse.json();

		const startResponse = await app.inject({
			method: 'POST',
			url: `/v1/promotion-runs/${run.id}/start`,
			payload: {
				actor: { actorType: 'user', actorId: 'dev' },
			},
		});
		expect(startResponse.statusCode).toBe(200);
	});
});
