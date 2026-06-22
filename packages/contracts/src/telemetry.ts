import { z } from 'zod';

export const PrometheusClientConfigSchema = z.object({
	baseUrl: z.string().url().optional(),
	bearerToken: z.string().optional(),
	timeout: z.string().optional(),
});

export const GateRunContextSchema = z.object({
	flagKey: z.string(),
	treatmentVariationId: z.string(),
	controlVariationId: z.string(),
	environmentKey: z.string().optional(),
});

export const GateVerdictResultSchema = z.enum(['pass', 'fail']);

export const GateEvaluationResultSchema = z.object({
	verdict: GateVerdictResultSchema,
	metricType: z.string(),
	observedDelta: z.number().optional(),
	treatmentValue: z.number().optional(),
	controlValue: z.number().optional(),
	threshold: z.number(),
	metadata: z.record(z.string(), z.unknown()),
});

export const PreflightCheckSchema = z.object({
	id: z.string(),
	status: z.enum(['pass', 'fail']),
	detail: z.string().optional(),
	observed: z.number().optional(),
	required: z.number().optional(),
});

export const PreflightReportSchema = z.object({
	status: z.enum(['pass', 'fail']),
	checks: z.array(PreflightCheckSchema),
	blockReason: z.string().optional(),
});

export const StageGateEvaluationSchema = z.object({
	verdict: GateVerdictResultSchema,
	results: z.array(GateEvaluationResultSchema),
});

export type PrometheusClientConfig = z.infer<typeof PrometheusClientConfigSchema>;
export type GateRunContext = z.infer<typeof GateRunContextSchema>;
export type GateVerdictResult = z.infer<typeof GateVerdictResultSchema>;
export type GateEvaluationResult = z.infer<typeof GateEvaluationResultSchema>;
export type PreflightCheck = z.infer<typeof PreflightCheckSchema>;
export type PreflightReport = z.infer<typeof PreflightReportSchema>;
export type StageGateEvaluation = z.infer<typeof StageGateEvaluationSchema>;
