import { z } from 'zod';
import { ActorSchema } from './promotion-run.js';

export const StageEnvironmentSchema = z.enum(['dev', 'staging', 'prod']);

export const MetricTypeSchema = z.enum(['error_rate', 'latency_p95']);

export const REQUIRED_METRICS = ['error_rate', 'latency_p95'] as const;
export const ENV_ORDER = ['dev', 'staging', 'prod'] as const;

export const GatePolicyInputSchema = z.object({
	metricType: MetricTypeSchema,
	threshold: z.number().positive(),
	serviceName: z.string(),
	comparisonMode: z.string().optional(),
	windowSeconds: z.number().int().optional(),
	minSampleSize: z.number().int().optional(),
});

export const GatePolicyResponseSchema = GatePolicyInputSchema.extend({
	id: z.string(),
});

export const StageInputSchema = z.object({
	orderIndex: z.number().int(),
	environment: StageEnvironmentSchema,
	displayName: z.string(),
	gatePolicies: z.array(GatePolicyInputSchema),
});

export const StageResponseSchema = StageInputSchema.extend({
	id: z.string(),
	gatePolicies: z.array(GatePolicyResponseSchema),
});

export const GuardrailPolicySchema = z.object({
	allowedEnvironments: z.array(StageEnvironmentSchema).optional(),
	requirePreflightPass: z.boolean().optional(),
	maxConcurrentRunsPerFlag: z.number().int().positive().optional(),
});

export const GuardrailViolationSchema = z.object({
	code: z.string(),
	message: z.string(),
	httpStatus: z.union([z.literal(403), z.literal(422)]),
});

const pipelineStageRefinement = (
	data: { stages: z.infer<typeof StageInputSchema>[] },
	ctx: z.RefinementCtx,
) => {
	if (data.stages.length < 1) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Pipeline must have at least one stage',
			path: ['stages'],
		});
		return;
	}

	const environments = data.stages.map((s) => s.environment);
	const uniqueEnvs = new Set(environments);
	if (uniqueEnvs.size !== environments.length) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Duplicate environment values are not allowed',
			path: ['stages'],
		});
	}

	const orderIndices = data.stages.map((s) => s.orderIndex).sort((a, b) => a - b);
	for (let i = 0; i < orderIndices.length; i++) {
		if (orderIndices[i] !== i) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Stage orderIndex must be sequential starting at 0',
				path: ['stages'],
			});
			break;
		}
	}

	const sortedStages = [...data.stages].sort((a, b) => a.orderIndex - b.orderIndex);
	for (let i = 1; i < sortedStages.length; i++) {
		const prevIdx = ENV_ORDER.indexOf(sortedStages[i - 1]!.environment);
		const currIdx = ENV_ORDER.indexOf(sortedStages[i]!.environment);
		if (prevIdx === -1 || currIdx === -1 || currIdx <= prevIdx) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Stages must follow dev → staging → prod order',
				path: ['stages'],
			});
			break;
		}
	}

	for (const stage of data.stages) {
		const metrics = new Set(stage.gatePolicies.map((p) => p.metricType));
		for (const required of REQUIRED_METRICS) {
			if (!metrics.has(required)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Stage ${stage.displayName} missing required gate policy: ${required}`,
					path: ['stages'],
				});
			}
		}
	}
};

const PipelineCreateInputBaseSchema = z.object({
	name: z.string(),
	flagKey: z.string(),
	projectKey: z.string(),
	description: z.string().optional(),
	version: z.number().int().positive().optional(),
	stages: z.array(StageInputSchema),
});

export const PipelineCreateInputSchema =
	PipelineCreateInputBaseSchema.superRefine(pipelineStageRefinement);

export const PipelineCreateRequestSchema = PipelineCreateInputBaseSchema.extend({
	actor: ActorSchema,
}).superRefine(pipelineStageRefinement);

export const PipelineUpdateRequestSchema = z.object({
	isActive: z.boolean().optional(),
	description: z.string().optional(),
	actor: ActorSchema,
});

export const PipelineResponseSchema = z.object({
	id: z.string(),
	name: z.string(),
	flagKey: z.string(),
	projectKey: z.string(),
	description: z.string().nullable().optional(),
	isActive: z.boolean(),
	version: z.number().int(),
	stages: z.array(StageResponseSchema),
	createdAt: z.string().datetime().optional(),
	updatedAt: z.string().datetime().optional(),
});

export type StageEnvironment = z.infer<typeof StageEnvironmentSchema>;
export type MetricType = z.infer<typeof MetricTypeSchema>;
export type GatePolicyInput = z.infer<typeof GatePolicyInputSchema>;
export type GatePolicyResponse = z.infer<typeof GatePolicyResponseSchema>;
export type StageInput = z.infer<typeof StageInputSchema>;
export type StageResponse = z.infer<typeof StageResponseSchema>;
export type GuardrailPolicy = z.infer<typeof GuardrailPolicySchema>;
export type GuardrailViolation = z.infer<typeof GuardrailViolationSchema>;
export type PipelineCreateInput = z.infer<typeof PipelineCreateInputSchema>;
export type PipelineCreateRequest = z.infer<typeof PipelineCreateRequestSchema>;
export type PipelineUpdateRequest = z.infer<typeof PipelineUpdateRequestSchema>;
export type PipelineResponse = z.infer<typeof PipelineResponseSchema>;
