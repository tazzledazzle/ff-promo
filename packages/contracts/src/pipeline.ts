import { z } from 'zod';

export const StageEnvironmentSchema = z.enum(['dev', 'staging', 'prod']);

export const GatePolicyInputSchema = z.object({
  metricType: z.string(),
  threshold: z.number(),
  serviceName: z.string(),
  comparisonMode: z.string().optional(),
  windowSeconds: z.number().int().optional(),
  minSampleSize: z.number().int().optional(),
});

export const StageInputSchema = z.object({
  orderIndex: z.number().int(),
  environment: StageEnvironmentSchema,
  displayName: z.string(),
  gatePolicies: z.array(GatePolicyInputSchema),
});

export const PipelineCreateInputSchema = z.object({
  name: z.string(),
  flagKey: z.string(),
  projectKey: z.string(),
  stages: z.array(StageInputSchema),
});

export type StageEnvironment = z.infer<typeof StageEnvironmentSchema>;
export type GatePolicyInput = z.infer<typeof GatePolicyInputSchema>;
export type StageInput = z.infer<typeof StageInputSchema>;
export type PipelineCreateInput = z.infer<typeof PipelineCreateInputSchema>;
