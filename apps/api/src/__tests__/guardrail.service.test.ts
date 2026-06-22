import { describe, expect, it } from 'vitest';
import type { PipelineCreateInput, StageInput } from '@ff-promo/contracts';
import {
	ENV_ORDER,
	REQUIRED_METRICS,
	validatePipelineConfig,
	validatePromotionRequest,
} from '../services/guardrail.service.js';

const defaultGatePolicies = [
	{ metricType: 'error_rate' as const, threshold: 0.01, serviceName: 'demo-service' },
	{ metricType: 'latency_p95' as const, threshold: 500, serviceName: 'demo-service' },
];

function validStages(): StageInput[] {
	return ENV_ORDER.map((environment, orderIndex) => ({
		orderIndex,
		environment,
		displayName: environment.charAt(0).toUpperCase() + environment.slice(1),
		gatePolicies: [...defaultGatePolicies],
	}));
}

function validPipelineInput(): PipelineCreateInput {
	return {
		name: 'checkout',
		flagKey: 'checkout-v2',
		projectKey: 'default',
		stages: validStages(),
	};
}

function validPipeline() {
	return {
		name: 'checkout',
		flagKey: 'checkout-v2',
		isActive: true,
		stages: validStages(),
	};
}

describe('validatePipelineConfig', () => {
	it.each([
		['empty stages', { ...validPipelineInput(), stages: [] }, 'pipeline_empty'],
		[
			'duplicate environment',
			{
				...validPipelineInput(),
				stages: [
					{ ...validStages()[0]!, environment: 'dev' },
					{ ...validStages()[1]!, environment: 'dev', orderIndex: 1 },
				],
			},
			'duplicate_environment',
		],
		[
			'invalid stage order',
			{
				...validPipelineInput(),
				stages: [
					{ ...validStages()[0]!, environment: 'staging', orderIndex: 0 },
					{ ...validStages()[1]!, environment: 'dev', orderIndex: 1 },
				],
			},
			'invalid_stage_order',
		],
		[
			'missing error_rate',
			{
				...validPipelineInput(),
				stages: validStages().map((stage) => ({
					...stage,
					gatePolicies: stage.gatePolicies.filter((p) => p.metricType !== 'error_rate'),
				})),
			},
			'missing_error_rate',
		],
		[
			'missing latency_p95',
			{
				...validPipelineInput(),
				stages: validStages().map((stage) => ({
					...stage,
					gatePolicies: stage.gatePolicies.filter((p) => p.metricType !== 'latency_p95'),
				})),
			},
			'missing_latency_p95',
		],
	])('returns %s violation', (_label, input, expectedCode) => {
		const violations = validatePipelineConfig(input as PipelineCreateInput);
		expect(violations.some((v) => v.code === expectedCode)).toBe(true);
		expect(violations[0]?.httpStatus).toBe(422);
	});

	it('returns no violations for valid 3-stage pipeline', () => {
		expect(validatePipelineConfig(validPipelineInput())).toEqual([]);
	});
});

describe('validatePromotionRequest', () => {
	it('returns pipeline_not_found when pipeline is null', () => {
		const violations = validatePromotionRequest({
			pipeline: null,
			flagKey: 'checkout-v2',
		});
		expect(violations[0]?.code).toBe('pipeline_not_found');
	});

	it('returns pipeline_inactive when pipeline is inactive', () => {
		const violations = validatePromotionRequest({
			pipeline: { ...validPipeline(), isActive: false },
			flagKey: 'checkout-v2',
		});
		expect(violations[0]).toMatchObject({
			code: 'pipeline_inactive',
			httpStatus: 403,
		});
	});

	it('returns flag_key_mismatch when flagKey differs', () => {
		const violations = validatePromotionRequest({
			pipeline: validPipeline(),
			flagKey: 'wrong-flag',
		});
		expect(violations[0]).toMatchObject({
			code: 'flag_key_mismatch',
			httpStatus: 403,
		});
	});

	it('returns structural violations for invalid pipeline', () => {
		const violations = validatePromotionRequest({
			pipeline: {
				...validPipeline(),
				stages: validStages().map((stage) => ({
					...stage,
					gatePolicies: stage.gatePolicies.filter((p) => p.metricType !== 'latency_p95'),
				})),
			},
			flagKey: 'checkout-v2',
		});
		expect(violations.some((v) => v.code === 'missing_latency_p95')).toBe(true);
	});

	it('returns no violations for valid promotion request', () => {
		expect(
			validatePromotionRequest({
				pipeline: validPipeline(),
				flagKey: 'checkout-v2',
			}),
		).toEqual([]);
	});
});

describe('REQUIRED_METRICS', () => {
	it('includes error_rate and latency_p95', () => {
		expect(REQUIRED_METRICS).toEqual(['error_rate', 'latency_p95']);
	});
});
