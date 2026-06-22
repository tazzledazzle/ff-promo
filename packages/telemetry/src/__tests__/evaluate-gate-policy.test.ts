import { describe, expect, it, vi } from 'vitest';
import { evaluateGatePolicy } from '../evaluate/evaluate-gate-policy.js';
import type { PrometheusClient } from '../client/prometheus-client.js';

const runContext = {
	flagKey: 'demo-feature-flag',
	treatmentVariationId: 'treatment-var',
	controlVariationId: 'control-var',
};

function vector(value: string) {
	return { resultType: 'vector', result: [{ metric: {}, value: [0, value] }] };
}

function mockClient(
	responses: Array<{ resultType: string; result: unknown }>,
): PrometheusClient {
	return {
		config: { baseUrl: 'http://localhost:9090' },
		queryInstant: vi
			.fn()
			.mockImplementation(async () => responses.shift() ?? vector('0')),
	};
}

describe('evaluateGatePolicy', () => {
	it('passes when delta equals threshold', async () => {
		const client = mockClient([
			vector('0.02'),
			vector('0.01'),
			vector('200'),
			vector('200'),
		]);
		const result = await evaluateGatePolicy(
			client,
			{
				metricType: 'error_rate',
				threshold: 0.01,
				serviceName: 'demo-service',
				minSampleSize: 100,
			},
			runContext,
		);
		expect(result.verdict).toBe('pass');
		expect(result.observedDelta).toBeCloseTo(0.01);
	});

	it('fails when delta exceeds threshold', async () => {
		const client = mockClient([
			vector('0.05'),
			vector('0.01'),
			vector('200'),
			vector('200'),
		]);
		const result = await evaluateGatePolicy(
			client,
			{
				metricType: 'error_rate',
				threshold: 0.01,
				serviceName: 'demo-service',
				minSampleSize: 100,
			},
			runContext,
		);
		expect(result.verdict).toBe('fail');
		expect(result.metadata.reason).toBe('threshold_exceeded');
	});

	it('fails closed on empty treatment data', async () => {
		const client = mockClient([
			{ resultType: 'vector', result: [] },
			vector('0.01'),
			vector('200'),
			vector('200'),
		]);
		const result = await evaluateGatePolicy(
			client,
			{
				metricType: 'error_rate',
				threshold: 0.01,
				serviceName: 'demo-service',
			},
			runContext,
		);
		expect(result.verdict).toBe('fail');
		expect(result.metadata.reason).toBe('no_data');
	});

	it('fails on insufficient samples', async () => {
		const client = mockClient([
			vector('0.02'),
			vector('0.01'),
			vector('50'),
			vector('200'),
		]);
		const result = await evaluateGatePolicy(
			client,
			{
				metricType: 'error_rate',
				threshold: 0.01,
				serviceName: 'demo-service',
				minSampleSize: 100,
			},
			runContext,
		);
		expect(result.verdict).toBe('fail');
		expect(result.metadata.reason).toBe('insufficient_samples');
	});

	it('evaluates latency_p95 delta in milliseconds', async () => {
		const client = mockClient([
			vector('900'),
			vector('300'),
			vector('200'),
			vector('200'),
		]);
		const result = await evaluateGatePolicy(
			client,
			{
				metricType: 'latency_p95',
				threshold: 500,
				serviceName: 'demo-service',
				minSampleSize: 100,
			},
			runContext,
		);
		expect(result.verdict).toBe('fail');
		expect(result.observedDelta).toBe(600);
	});
});
