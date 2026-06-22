import { z } from 'zod';

export const ActorTypeSchema = z.enum(['user', 'system', 'api_key']);

export const AuditActionSchema = z.enum([
  'run_started',
  'run_paused',
  'run_resumed',
  'run_aborted',
  'run_completed',
  'stage_entered',
  'stage_advanced',
  'gate_evaluated',
]);

export const AuditEventInputSchema = z.object({
  promotionRunId: z.string(),
  action: AuditActionSchema,
  actorType: ActorTypeSchema,
  actorId: z.string(),
  displayName: z.string().optional(),
  gateResultId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ActorType = z.infer<typeof ActorTypeSchema>;
export type AuditAction = z.infer<typeof AuditActionSchema>;
export type AuditEventInput = z.infer<typeof AuditEventInputSchema>;
