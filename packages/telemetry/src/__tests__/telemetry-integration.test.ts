import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import nock from 'nock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPrometheusClient } from '../client/prometheus-client.js';
import { evaluateGatePolicy } from '../evaluate/evaluate-gate-policy.js';
import { evaluateStageGates } from '../evaluate/evaluate-stage-gates.js';
import { runPreflightChecks } from '../preflight/run-preflight.js';

const baseUrl = 'http://localhost:9090';
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(name: string) {
	return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
}

const runContext = {
	flagKey: 'demo-feature-flag',
	treatmentVariationId: 'treatment-var-id',
	controlVariationId: 'control-var-id',
};

const errorRatePolicy = {
	metricType: 'error_rate',
	threshold: 0.01,
	serviceName: 'demo-service',
	windowSeconds: 300,
	minSampleSize: 100,
};

const latencyPolicy = {
	metricType: 'latency_p95',
	threshold: 500,
	serviceName: 'demo-service',
	windowSeconds: 300,
	minSampleSize: 100,
};

function replyForQuery(query: string) {
	if (query.includes('treatment-var-id') && query.includes('increase(')) {
		return loadFixture('prometheus-sample-count-high.json');
	}
	if (query.includes('control-var-id') && query.includes('increase(')) {
		return loadFixture('prometheus-sample-count-high.json');
	}
	if (query.includes('treatment-var-id') && query.includes('histogram_quantile')) {
		return loadFixture('prometheus-treatment-latency.json');
	}
	if (query.includes('control-var-id') && query.includes('histogram_quantile')) {
		return loadFixture('prometheus-control-latency.json');
	}
	if (query.includes('treatment-var-id') && query.includes('status=~"5.."')) {
		return loadFixture('prometheus-treatment-error-rate.json');
	}
	if (query.includes('control-var-id') && query.includes('status=~"5.."')) {
		return loadFixture('prometheus-control-error-rate.json');
	}
	if (query.includes('treatment-var-id')) {
		return loadFixture('prometheus-treatment-error-rate.json');
	}
	if (query.includes('control-var-id')) {
		return loadFixture('prometheus-control-error-rate.json');
	}
	return loadFixture('prometheus-vector-empty.json');
}

function promqlFromUri(uri: string): string {
	const url = new URL(uri, baseUrl);
	return url.searchParams.get('query') ?? '';
}

describe('telemetry nock integration', () => {
	beforeEach(() => {
		nock.cleanAll();
	});

	afterEach(() => {
		nock.cleanAll();
	});

	it('TELE-03: error rate delta pass at HTTP boundary', async () => {
		nock(baseUrl)
			.get('/api/v1/query')
			.query(true)
			.times(4)
			.reply(200, (uri) => ({
				status: 'success',
				data: replyForQuery(promqlFromUri(uri)),
			}));

		const client = createPrometheusClient({ baseUrl });
		const result = await evaluateGatePolicy(client, errorRatePolicy, runContext);

		expect(result.verdict).toBe('pass');
		expect(result.observedDelta).toBeCloseTo(0.01);
		expect(nock.isDone()).toBe(true);
	});

	it('TELE-03: threshold exceeded fails at HTTP boundary', async () => {
		nock(baseUrl)
			.get('/api/v1/query')
			.query(true)
			.times(4)
			.reply(200, (uri) => {
				const promql = promqlFromUri(uri);
				if (promql.includes('treatment-var-id') && promql.includes('status=~"5.."')) {
					return {
						status: 'success',
						data: loadFixture('prometheus-treatment-error-rate-fail.json'),
					};
				}
				return {
					status: 'success',
					data: replyForQuery(promql),
				};
			});

		const client = createPrometheusClient({ baseUrl });
		const result = await evaluateGatePolicy(client, errorRatePolicy, runContext);

		expect(result.verdict).toBe('fail');
		expect(result.metadata.reason).toBe('threshold_exceeded');
	});

	it('TELE-03: empty vector fails closed with no_data', async () => {
		nock(baseUrl)
			.get('/api/v1/query')
			.query(true)
			.times(4)
			.reply(200, {
				status: 'success',
				data: loadFixture('prometheus-vector-empty.json'),
			});

		const client = createPrometheusClient({ baseUrl });
		const result = await evaluateGatePolicy(client, errorRatePolicy, runContext);
		expect(result.verdict).toBe('fail');
		expect(result.metadata.reason).toBe('no_data');
	});

	it('TELE-03: insufficient samples fail closed', async () => {
		nock(baseUrl)
			.get('/api/v1/query')
			.query(true)
			.times(4)
			.reply(200, (uri) => {
				const promql = promqlFromUri(uri);
				if (promql.includes('increase(')) {
					return {
						status: 'success',
						data: loadFixture('prometheus-sample-count-low.json'),
					};
				}
				return {
					status: 'success',
					data: replyForQuery(promql),
				};
			});

		const client = createPrometheusClient({ baseUrl });
		const result = await evaluateGatePolicy(client, errorRatePolicy, runContext);
		expect(result.verdict).toBe('fail');
		expect(result.metadata.reason).toBe('insufficient_samples');
	});

	it('TELE-03: stage fails when one policy fails (D-09)', async () => {
		let call = 0;
		nock(baseUrl)
			.get('/api/v1/query')
			.query(true)
			.times(8)
			.reply(200, (uri) => {
				call += 1;
				const promql = promqlFromUri(uri);
				if (call <= 4) {
					return {
						status: 'success',
						data: replyForQuery(promql),
					};
				}
				if (promql.includes('histogram_quantile')) {
					if (promql.includes('treatment-var-id')) {
						return {
							status: 'success',
							data: {
								resultType: 'vector',
								result: [{ metric: {}, value: [0, '1000'] }],
							},
						};
					}
					return {
						status: 'success',
						data: loadFixture('prometheus-control-latency.json'),
					};
				}
				if (promql.includes('increase(')) {
					return {
						status: 'success',
						data: loadFixture('prometheus-sample-count-high.json'),
					};
				}
				return {
					status: 'success',
					data: loadFixture('prometheus-control-latency.json'),
				};
			});

		const client = createPrometheusClient({ baseUrl });
		const result = await evaluateStageGates(
			client,
			[errorRatePolicy, latencyPolicy],
			runContext,
		);
		expect(result.verdict).toBe('fail');
	});

	it('TELE-04: preflight passes when checks succeed', async () => {
		nock(baseUrl)
			.get('/api/v1/query')
			.query(true)
			.times(2)
			.reply(200, {
				status: 'success',
				data: loadFixture('prometheus-sample-count-high.json'),
			});

		const client = createPrometheusClient({ baseUrl });
		const report = await runPreflightChecks(client, [errorRatePolicy], runContext);
		expect(report.status).toBe('pass');
		expect(nock.isDone()).toBe(true);
	});

	it('TELE-04: preflight fails with blockReason when treatment missing', async () => {
		nock(baseUrl)
			.get('/api/v1/query')
			.query(true)
			.times(2)
			.reply(200, (uri) => {
				const promql = promqlFromUri(uri);
				if (promql.includes('treatment-var-id')) {
					return {
						status: 'success',
						data: loadFixture('prometheus-vector-empty.json'),
					};
				}
				return {
					status: 'success',
					data: loadFixture('prometheus-sample-count-high.json'),
				};
			});

		const client = createPrometheusClient({ baseUrl });
		const report = await runPreflightChecks(client, [errorRatePolicy], runContext);
		expect(report.status).toBe('fail');
		expect(report.blockReason).toBeTruthy();
	});
});
