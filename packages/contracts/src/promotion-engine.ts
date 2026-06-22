import { z } from 'zod';
import { PreflightReportSchema } from './telemetry.js';

export const RunStageInputSchema = z.object({
	promotionRunId: z.string(),
	stageIndex: z.number().int(),
});

export const PreflightActivityInputSchema = z.object({
	promotionRunId: z.string(),
});

export const PreflightActivityResultSchema = z.object({
	status: z.enum(['pass', 'fail']),
	report: PreflightReportSchema,
});

export const EvaluateGateActivityInputSchema = RunStageInputSchema.extend({
	treatmentVariationId: z.string().optional(),
	controlVariationId: z.string().optional(),
});

export const EvaluateGateActivityResultSchema = z.object({
	verdict: z.enum(['pass', 'fail']),
	gateResultIds: z.array(z.string()),
	pauseReason: z.string().optional(),
});

export const ApplyStageTargetingResultSchema = z.object({
	environmentKey: z.string(),
	treatmentVariationId: z.string(),
	controlVariationId: z.string(),
});

export type RunStageInput = z.infer<typeof RunStageInputSchema>;
export type PreflightActivityInput = z.infer<typeof PreflightActivityInputSchema>;
export type PreflightActivityResult = z.infer<typeof PreflightActivityResultSchema>;
export type EvaluateGateActivityInput = z.infer<typeof EvaluateGateActivityInputSchema>;
export type EvaluateGateActivityResult = z.infer<typeof EvaluateGateActivityResultSchema>;
export type ApplyStageTargetingResult = z.infer<typeof ApplyStageTargetingResultSchema>;
