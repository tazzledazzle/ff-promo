import type {
	GuardrailViolation,
	PipelineCreateInput,
} from '@ff-promo/contracts';
import { ENV_ORDER, REQUIRED_METRICS } from '@ff-promo/contracts';

export { ENV_ORDER, REQUIRED_METRICS };

type PipelineForValidation = {
	name: string;
	flagKey: string;
	isActive: boolean;
	stages: Array<{
		orderIndex: number;
		environment: string;
		displayName: string;
		gatePolicies: Array<{ metricType: string }>;
	}>;
};

function validateStageGatePolicies(
	stage: PipelineForValidation['stages'][number],
): GuardrailViolation[] {
	const violations: GuardrailViolation[] = [];
	const metrics = new Set(stage.gatePolicies.map((p) => p.metricType));

	if (!metrics.has('error_rate')) {
		violations.push({
			code: 'missing_error_rate',
			message: `Stage ${stage.displayName} missing required gate policy: error_rate`,
			httpStatus: 422,
		});
	}
	if (!metrics.has('latency_p95')) {
		violations.push({
			code: 'missing_latency_p95',
			message: `Stage ${stage.displayName} missing required gate policy: latency_p95`,
			httpStatus: 422,
		});
	}

	return violations;
}

function validateStageOrder(
	stages: PipelineForValidation['stages'],
): GuardrailViolation[] {
	if (stages.length === 0) {
		return [
			{
				code: 'pipeline_empty',
				message: 'Pipeline has no stages',
				httpStatus: 422,
			},
		];
	}

	const environments = stages.map((s) => s.environment);
	const uniqueEnvs = new Set(environments);
	if (uniqueEnvs.size !== environments.length) {
		return [
			{
				code: 'duplicate_environment',
				message: 'Duplicate environment values are not allowed',
				httpStatus: 422,
			},
		];
	}

	const sortedStages = [...stages].sort((a, b) => a.orderIndex - b.orderIndex);
	for (let i = 1; i < sortedStages.length; i++) {
		const prevIdx = ENV_ORDER.indexOf(
			sortedStages[i - 1]!.environment as (typeof ENV_ORDER)[number],
		);
		const currIdx = ENV_ORDER.indexOf(
			sortedStages[i]!.environment as (typeof ENV_ORDER)[number],
		);
		if (prevIdx === -1 || currIdx === -1 || currIdx <= prevIdx) {
			return [
				{
					code: 'invalid_stage_order',
					message: 'Stages must follow dev → staging → prod order',
					httpStatus: 422,
				},
			];
		}
	}

	return [];
}

export function validatePipelineConfig(
	input: PipelineCreateInput,
): GuardrailViolation[] {
	const violations: GuardrailViolation[] = [];

	violations.push(...validateStageOrder(input.stages));

	for (const stage of input.stages) {
		violations.push(...validateStageGatePolicies(stage));
	}

	return violations;
}

export function validatePromotionRequest(input: {
	pipeline: PipelineForValidation | null;
	flagKey: string;
}): GuardrailViolation[] {
	if (!input.pipeline) {
		return [
			{
				code: 'pipeline_not_found',
				message: 'Pipeline not found',
				httpStatus: 422,
			},
		];
	}

	if (!input.pipeline.isActive) {
		return [
			{
				code: 'pipeline_inactive',
				message: `Pipeline ${input.pipeline.name} is inactive`,
				httpStatus: 403,
			},
		];
	}

	if (input.pipeline.flagKey !== input.flagKey) {
		return [
			{
				code: 'flag_key_mismatch',
				message: `Flag key "${input.flagKey}" does not match pipeline flag "${input.pipeline.flagKey}"`,
				httpStatus: 403,
			},
		];
	}

	const violations: GuardrailViolation[] = [];
	violations.push(...validateStageOrder(input.pipeline.stages));

	for (const stage of input.pipeline.stages) {
		violations.push(...validateStageGatePolicies(stage));
	}

	return violations;
}

export function throwOnViolation(
	violations: GuardrailViolation[],
	handlers: {
		notFound: (message: string) => Error;
		forbidden: (message: string) => Error;
		unprocessableEntity: (message: string) => Error;
	},
): void {
	if (violations.length === 0) {
		return;
	}

	const violation = violations[0]!;
	if (violation.code === 'pipeline_not_found') {
		throw handlers.notFound(violation.message);
	}
	if (violation.httpStatus === 403) {
		throw handlers.forbidden(violation.message);
	}
	throw handlers.unprocessableEntity(violation.message);
}
