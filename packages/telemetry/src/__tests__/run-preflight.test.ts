import { describe, expect, it, vi } from 'vitest';
import { runPreflightChecks } from '../preflight/run-preflight.js';

const runContext = {
	flagKey: 'demo-feature-flag',
	treatmentVariationId: 'treatment-var',
	controlVariationId: 'control-var',
};

const policies = [
	{
		metricType: 'error_rate',
		threshold: 0.01,
		serviceName: 'demo-service',
		minSampleSize: 100,
	},
];

function vector(value: string) {
	return { resultType: 'vector', result: [{ metric: {}, value: [0, value] }] };
}

describe('runPreflightChecks', () => {
	it('passes when treatment/control samples and user context are present', async () => {
		const client = {
			config: { baseUrl: 'http://localhost:9090' },
			queryInstant: vi
				.fn()
				.mockResolvedValueOnce(vector('200'))
				.mockResolvedValueOnce(vector('200')),
		};

		const report = await runPreflightChecks(client, policies, runContext);
		expect(report.status).toBe('pass');
		expect(report.checks.map((check) => check.id)).toEqual([
			'metric_flow_treatment',
			'metric_flow_control',
			'min_sample_treatment',
			'min_sample_control',
			'context_kind_user',
		]);
	});

	it('fails when treatment metric flow is missing', async () => {
		const client = {
			config: { baseUrl: 'http://localhost:9090' },
			queryInstant: vi
				.fn()
				.mockResolvedValueOnce({ resultType: 'vector', result: [] })
				.mockResolvedValueOnce(vector('200')),
		};

		const report = await runPreflightChecks(client, policies, runContext);
		expect(report.status).toBe('fail');
		expect(report.blockReason).toBeTruthy();
		expect(
			report.checks.find((check) => check.id === 'metric_flow_treatment')?.status,
		).toBe('fail');
	});
});
