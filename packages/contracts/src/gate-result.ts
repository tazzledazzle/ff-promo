import { z } from 'zod';

export const GateVerdictSchema = z.enum(['pass', 'fail', 'pending', 'skipped']);

export const GateResultCreateInputSchema = z.object({
  promotionRunId: z.string(),
  stageId: z.string(),
  verdict: GateVerdictSchema,
  metricType: z.string(),
  observedValue: z.number().optional(),
  threshold: z.number(),
  metadata: z.record(z.string(), z.unknown()),
});

export type GateVerdict = z.infer<typeof GateVerdictSchema>;
export type GateResultCreateInput = z.infer<typeof GateResultCreateInputSchema>;
