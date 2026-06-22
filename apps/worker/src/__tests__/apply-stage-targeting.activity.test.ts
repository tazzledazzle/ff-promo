import { randomUUID } from 'node:crypto';
import nock from 'nock';
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
import { applyStageTargeting } from '../activities/apply-stage-targeting.js';
import {
	LD_BASE_URL,
	nockLdGetFlag,
	nockLdPatchFlag,
	setupLdNockEnv,
} from './helpers/nock-launchdarkly.js';

async function seedRun() {
	const db = createPrismaClient(getTestDatabaseUrl()!);
	const pipelineRepo = new PipelineRepository(db);
	const pipeline = await pipelineRepo.create({
		name: `targeting-${randomUUID()}`,
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

describe('applyStageTargeting activity', () => {
	beforeAll(async () => {
		await startTestDatabase();
	}, 120_000);

	afterAll(async () => {
		await stopTestDatabase();
	});

	beforeEach(() => {
		nock.cleanAll();
		setupLdNockEnv();
	});

	afterEach(() => {
		nock.cleanAll();
	});

	it('applies LD targeting and returns resolved variation ids', async () => {
		const run = await seedRun();
		let patchBody: Record<string, unknown> | undefined;

		nockLdGetFlag('default', 'workflow-test-flag', 3);
		nockLdPatchFlag('default', 'workflow-test-flag', (body) => {
			patchBody = body;
		});

		const result = await applyStageTargeting({
			promotionRunId: run.id,
			stageIndex: 0,
		});

		expect(result.environmentKey).toBe('dev');
		expect(result.treatmentVariationId).toBe('var-on');
		expect(result.controlVariationId).toBe('var-off');

		const instructions = (patchBody?.instructions ?? []) as Array<{
			kind: string;
		}>;
		expect(instructions.some((item) => item.kind === 'turnFlagOn')).toBe(true);
		expect(nock.isDone()).toBe(true);
	});
});
