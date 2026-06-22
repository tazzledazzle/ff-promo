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
import { evaluateGate } from '../activities/evaluate-gate.js';
import {
	LD_BASE_URL,
	nockLdGetFlag,
	setupLdNockEnv,
} from './helpers/nock-launchdarkly.js';
import {
	nockPrometheusGateFail,
	nockPrometheusPass,
	setupPrometheusNockEnv,
} from './helpers/nock-prometheus.js';

async function seedRun(policyCount = 1) {
	const db = createPrismaClient(getTestDatabaseUrl()!);
	const pipelineRepo = new PipelineRepository(db);
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

	const pipeline = await pipelineRepo.create({
		name: `evaluate-gate-${randomUUID()}`,
		flagKey: 'workflow-test-flag',
		projectKey: 'default',
		stages: [
			{
				orderIndex: 0,
				environment: 'dev',
				displayName: 'Dev',
				gatePolicies: policies,
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

describe('evaluateGate activity', () => {
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

	it('persists one GateResult per policy when gates pass', async () => {
		const run = await seedRun(1);
		nockPrometheusPass(4);

		const result = await evaluateGate({
			promotionRunId: run.id,
			stageIndex: 0,
			treatmentVariationId: 'var-on',
			controlVariationId: 'var-off',
		});

		expect(result.verdict).toBe('pass');
		expect(result.gateResultIds).toHaveLength(1);

		const db = createPrismaClient(getTestDatabaseUrl()!);
		const gateResults = await db.gateResult.findMany({
			where: { promotionRunId: run.id },
		});
		const audit = await db.auditEvent.findMany({
			where: { promotionRunId: run.id, action: 'gate_evaluated' },
		});
		expect(gateResults).toHaveLength(1);
		expect(audit).toHaveLength(1);
		expect(audit[0]?.gateResultId).toBe(gateResults[0]?.id);
		await db.$disconnect();
		expect(nock.isDone()).toBe(true);
	});

	it('returns fail with pauseReason when threshold exceeded', async () => {
		const run = await seedRun(1);
		nockPrometheusGateFail(4);

		const result = await evaluateGate({
			promotionRunId: run.id,
			stageIndex: 0,
			treatmentVariationId: 'var-on',
			controlVariationId: 'var-off',
		});

		expect(result.verdict).toBe('fail');
		expect(result.pauseReason).toBeTruthy();
		expect(result.gateResultIds).toHaveLength(1);
		expect(nock.isDone()).toBe(true);
	});

	it('creates GateResult rows for each policy', async () => {
		const run = await seedRun(2);
		nockPrometheusPass(8);

		const result = await evaluateGate({
			promotionRunId: run.id,
			stageIndex: 0,
			treatmentVariationId: 'var-on',
			controlVariationId: 'var-off',
		});

		expect(result.gateResultIds).toHaveLength(2);

		const db = createPrismaClient(getTestDatabaseUrl()!);
		const gateResults = await db.gateResult.count({
			where: { promotionRunId: run.id },
		});
		expect(gateResults).toBe(2);
		await db.$disconnect();
	});
});
