import { describe, expect, it, vi } from 'vitest';
import { evaluateStageGates } from '../evaluate/evaluate-stage-gates.js';
import * as evaluateGatePolicyModule from '../evaluate/evaluate-gate-policy.js';

const runContext = {
	flagKey: 'demo-feature-flag',
	treatmentVariationId: 'treatment-var',
	controlVariationId: 'control-var',
};

describe('evaluateStageGates', () => {
	it('passes when all policies pass', async () => {
		const evaluateSpy = vi
			.spyOn(evaluateGatePolicyModule, 'evaluateGatePolicy')
			.mockImplementation(async (_client, policy) => ({
				verdict: 'pass',
				metricType: policy.metricType,
				threshold: policy.threshold,
				metadata: {},
			}));

		const result = await evaluateStageGates(
			{ config: { baseUrl: 'http://localhost:9090' }, queryInstant: vi.fn() },
			[
				{ metricType: 'error_rate', threshold: 0.01, serviceName: 'demo-service' },
				{ metricType: 'latency_p95', threshold: 500, serviceName: 'demo-service' },
			],
			runContext,
		);

		expect(result.verdict).toBe('pass');
		expect(result.results).toHaveLength(2);
		evaluateSpy.mockRestore();
	});

	it('fails when any policy fails', async () => {
		const evaluateSpy = vi
			.spyOn(evaluateGatePolicyModule, 'evaluateGatePolicy')
			.mockImplementation(async (_client, policy) => ({
				verdict: policy.metricType === 'latency_p95' ? 'fail' : 'pass',
				metricType: policy.metricType,
				threshold: policy.threshold,
				metadata:
					policy.metricType === 'latency_p95'
						? { reason: 'threshold_exceeded' }
						: {},
			}));

		const result = await evaluateStageGates(
			{ config: { baseUrl: 'http://localhost:9090' }, queryInstant: vi.fn() },
			[
				{ metricType: 'error_rate', threshold: 0.01, serviceName: 'demo-service' },
				{ metricType: 'latency_p95', threshold: 500, serviceName: 'demo-service' },
			],
			runContext,
		);

		expect(result.verdict).toBe('fail');
		evaluateSpy.mockRestore();
	});
});
