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
import { createValidPipelinePayload, standardStages } from './helpers/pipeline-test-fixtures.js';

describe('pipelines create route', () => {
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

	it('creates pipeline with dev/staging/prod stages and gate policies', async () => {
		const payload = createValidPipelinePayload();

		const response = await app.inject({
			method: 'POST',
			url: '/v1/pipelines',
			payload,
		});

		expect(response.statusCode).toBe(201);
		const body = response.json();
		expect(body.stages).toHaveLength(3);
		for (const stage of body.stages) {
			expect(stage.gatePolicies).toHaveLength(2);
		}

		const db = createPrismaClient(getTestDatabaseUrl()!);
		const audits = await db.pipelineConfigAudit.findMany({
			where: { pipelineId: body.id, action: 'pipeline_created' },
		});
		expect(audits).toHaveLength(1);
		await db.$disconnect();
	});

	it('returns 400 when stage missing latency_p95 (schema validation)', async () => {
		const stages = standardStages();
		stages[0] = {
			...stages[0]!,
			gatePolicies: stages[0]!.gatePolicies.filter(
				(p) => p.metricType !== 'latency_p95',
			),
		};

		const response = await app.inject({
			method: 'POST',
			url: '/v1/pipelines',
			payload: createValidPipelinePayload({ stages }),
		});

		expect(response.statusCode).toBe(400);
		expect(response.json().error).toBe('validation_error');
	});

	it('PATCH deactivate sets isActive false and appends audit', async () => {
		const createResponse = await app.inject({
			method: 'POST',
			url: '/v1/pipelines',
			payload: createValidPipelinePayload(),
		});
		const pipeline = createResponse.json();

		const patchResponse = await app.inject({
			method: 'PATCH',
			url: `/v1/pipelines/${pipeline.id}`,
			payload: {
				isActive: false,
				actor: { actorType: 'user', actorId: 'platform' },
			},
		});

		expect(patchResponse.statusCode).toBe(200);
		expect(patchResponse.json().isActive).toBe(false);

		const db = createPrismaClient(getTestDatabaseUrl()!);
		const audits = await db.pipelineConfigAudit.findMany({
			where: { pipelineId: pipeline.id, action: 'pipeline_deactivated' },
		});
		expect(audits).toHaveLength(1);
		await db.$disconnect();
	});

	it('GET detail returns gate policy thresholds per stage', async () => {
		const createResponse = await app.inject({
			method: 'POST',
			url: '/v1/pipelines',
			payload: createValidPipelinePayload(),
		});
		const pipeline = createResponse.json();

		const detailResponse = await app.inject({
			method: 'GET',
			url: `/v1/pipelines/${pipeline.id}`,
		});

		expect(detailResponse.statusCode).toBe(200);
		const detail = detailResponse.json();
		expect(detail.stages[0].gatePolicies).toHaveLength(2);
		expect(detail.stages[0].gatePolicies[0].threshold).toBe(0.01);
	});
});
