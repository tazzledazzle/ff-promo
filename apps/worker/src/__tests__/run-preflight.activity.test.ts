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
import { runPreflight } from '../activities/run-preflight.js';
import {
	LD_BASE_URL,
	nockLdGetFlag,
	setupLdNockEnv,
} from './helpers/nock-launchdarkly.js';
import {
	nockPrometheusPreflightFail,
	nockPrometheusPreflightPass,
	PROMETHEUS_BASE_URL,
	setupPrometheusNockEnv,
} from './helpers/nock-prometheus.js';

async function seedRun() {
	const db = createPrismaClient(getTestDatabaseUrl()!);
	const pipelineRepo = new PipelineRepository(db);
	const pipeline = await pipelineRepo.create({
		name: `preflight-${randomUUID()}`,
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

describe('runPreflight activity', () => {
	beforeAll(async () => {
		await startTestDatabase();
	}, 120_000);

	afterAll(async () => {
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

	it('returns pass when Prometheus preflight checks succeed', async () => {
		const run = await seedRun();
		nockLdGetFlag('default', 'workflow-test-flag');
		nockPrometheusPreflightPass();

		const result = await runPreflight({ promotionRunId: run.id });

		expect(result.status).toBe('pass');
		expect(nock.isDone()).toBe(true);
	});

	it('returns fail without creating GateResult rows', async () => {
		const run = await seedRun();
		nockLdGetFlag('default', 'workflow-test-flag');
		nockPrometheusPreflightFail();

		const result = await runPreflight({ promotionRunId: run.id });

		expect(result.status).toBe('fail');
		expect(result.report.blockReason).toBeTruthy();

		const db = createPrismaClient(getTestDatabaseUrl()!);
		const gateResults = await db.gateResult.count({
			where: { promotionRunId: run.id },
		});
		const audit = await db.auditEvent.findMany({
			where: { promotionRunId: run.id, action: 'run_aborted' },
		});
		expect(gateResults).toBe(0);
		expect(audit.length).toBeGreaterThan(0);
		await db.$disconnect();
		expect(nock.isDone()).toBe(true);
	});
});
