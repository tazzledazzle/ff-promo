import { z } from 'zod';
import { ActorTypeSchema } from './audit.js';

export const PromotionStatusSchema = z.enum([
  'pending',
  'active',
  'paused',
  'completed',
  'aborted',
]);

export const ActorSchema = z.object({
  actorType: ActorTypeSchema,
  actorId: z.string(),
  displayName: z.string().optional(),
});

export const PromotionRunCreateInputSchema = z.object({
  pipelineId: z.string(),
  flagKey: z.string(),
  actor: ActorSchema,
});

export const PersistRunStateInputSchema = z.object({
  promotionRunId: z.string(),
  status: PromotionStatusSchema,
  currentStageIndex: z.number().int().optional(),
  pauseReason: z.string().optional(),
});

export type PromotionStatus = z.infer<typeof PromotionStatusSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type PromotionRunCreateInput = z.infer<typeof PromotionRunCreateInputSchema>;
export type PersistRunStateInput = z.infer<typeof PersistRunStateInputSchema>;
