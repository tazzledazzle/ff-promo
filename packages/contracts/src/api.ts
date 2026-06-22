import { z } from 'zod';
import { ActorSchema } from './promotion-run.js';
import { GateVerdictSchema } from './gate-result.js';
import { PromotionStatusSchema } from './promotion-run.js';

export const CreatePromotionRunRequestSchema = z.object({
	pipelineId: z.string(),
	flagKey: z.string(),
	actor: ActorSchema,
});

export const ControlActionRequestSchema = z.object({
	actor: ActorSchema.optional(),
});

export const PromotionRunResponseSchema = z.object({
	id: z.string(),
	status: PromotionStatusSchema,
	flagKey: z.string(),
	pipelineId: z.string(),
	currentStageIndex: z.number().int(),
	pauseReason: z.string().nullable().optional(),
	temporalWorkflowId: z.string().nullable().optional(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

export const GateForensicsResultSchema = z.object({
	gateResultId: z.string(),
	stageId: z.string(),
	stageIndex: z.number().int(),
	environment: z.string(),
	displayName: z.string(),
	metricType: z.string(),
	verdict: GateVerdictSchema,
	threshold: z.number(),
	observedValue: z.number().optional(),
	treatmentValue: z.number().optional(),
	controlValue: z.number().optional(),
	observedDelta: z.number().optional(),
	reason: z.string().optional(),
	evaluatedAt: z.string().datetime(),
});

export const GateForensicsSchema = z.object({
	pauseReason: z.string().optional(),
	stageIndex: z.number().int().optional(),
	environment: z.string().optional(),
	displayName: z.string().optional(),
	results: z.array(GateForensicsResultSchema),
});

export const LiveWorkflowStatusSchema = z.object({
	status: z.string(),
	currentStageIndex: z.number().int(),
	isPaused: z.boolean(),
});

export const PromotionRunStatusResponseSchema = z.object({
	run: PromotionRunResponseSchema,
	gateForensics: GateForensicsSchema.optional(),
	liveWorkflowStatus: LiveWorkflowStatusSchema.optional(),
});

export const GateResultResponseSchema = z.object({
	id: z.string(),
	promotionRunId: z.string(),
	stageId: z.string(),
	verdict: GateVerdictSchema,
	metricType: z.string(),
	observedValue: z.number().nullable().optional(),
	threshold: z.number(),
	metadata: z.record(z.string(), z.unknown()),
	evaluatedAt: z.string().datetime(),
});

export const AuditEventResponseSchema = z.object({
	id: z.string(),
	promotionRunId: z.string(),
	action: z.string(),
	actorType: z.string(),
	actorId: z.string(),
	displayName: z.string().nullable().optional(),
	gateResultId: z.string().nullable().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	occurredAt: z.string().datetime(),
});

export type GateForensics = z.infer<typeof GateForensicsSchema>;
export type GateForensicsResult = z.infer<typeof GateForensicsResultSchema>;
export type CreatePromotionRunRequest = z.infer<
	typeof CreatePromotionRunRequestSchema
>;
export type ControlActionRequest = z.infer<typeof ControlActionRequestSchema>;
export type PromotionRunResponse = z.infer<typeof PromotionRunResponseSchema>;
export type PromotionRunStatusResponse = z.infer<
	typeof PromotionRunStatusResponseSchema
>;
export type GateResultResponse = z.infer<typeof GateResultResponseSchema>;
export type AuditEventResponse = z.infer<typeof AuditEventResponseSchema>;
