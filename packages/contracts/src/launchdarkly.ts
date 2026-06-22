import { z } from 'zod';

export const FlagVariationSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	value: z.unknown(),
});

export const FlagRuleSchema = z.object({
	id: z.string(),
	description: z.string().optional(),
	clauses: z.array(z.unknown()),
	variationOrRollout: z.unknown(),
});

export const FlagEnvironmentStateSchema = z.object({
	on: z.boolean(),
	rules: z.array(FlagRuleSchema),
	fallthrough: z.unknown(),
	offVariation: z.number().optional(),
	targets: z.array(z.unknown()).optional(),
});

export const FlagStateSchema = z.object({
	projectKey: z.string(),
	flagKey: z.string(),
	variations: z.array(FlagVariationSchema),
	environments: z.record(z.string(), FlagEnvironmentStateSchema),
});

export const VariationRefSchema = z.discriminatedUnion('by', [
	z.object({ by: z.literal('id'), id: z.string() }),
	z.object({ by: z.literal('name'), name: z.string() }),
	z.object({ by: z.literal('value'), value: z.unknown() }),
]);

export const RuleRefSchema = z.discriminatedUnion('by', [
	z.object({ by: z.literal('id'), id: z.string() }),
	z.object({ by: z.literal('description'), description: z.string() }),
]);

export const RolloutIntentSchema = z.object({
	mode: z.enum(['fallthrough', 'rule']).default('fallthrough'),
	treatmentVariationRef: VariationRefSchema,
	controlVariationRef: VariationRefSchema,
	treatmentPercentThousandths: z.number().int().min(0).max(100_000),
	rolloutContextKind: z.string(),
	rolloutBucketBy: z.string(),
	ruleRef: RuleRefSchema.optional(),
});

export const SemanticPatchInstructionSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('turnFlagOn') }),
	z.object({ kind: z.literal('turnFlagOff') }),
	z.object({
		kind: z.literal('updateFallthroughVariationOrRollout'),
		rolloutWeights: z.record(z.string(), z.number().int()),
		rolloutBucketBy: z.string(),
		rolloutContextKind: z.string(),
	}),
	z.object({
		kind: z.literal('updateRuleVariationOrRollout'),
		ruleId: z.string(),
		rolloutWeights: z.record(z.string(), z.number().int()),
		rolloutBucketBy: z.string(),
		rolloutContextKind: z.string(),
	}),
]);

export const TargetingIntentSchema = z.object({
	environmentKey: z.string(),
	comment: z.string().optional(),
	turnOn: z.boolean().optional(),
	rollout: RolloutIntentSchema.optional(),
});

export const GetFlagStateInputSchema = z.object({
	projectKey: z.string(),
	flagKey: z.string(),
	environmentKey: z.string(),
});

export const ApplyTargetingInputSchema = z.object({
	projectKey: z.string(),
	flagKey: z.string(),
	intent: TargetingIntentSchema,
});

export const LaunchDarklyClientConfigSchema = z.object({
	accessToken: z.string(),
	baseUrl: z.string().url().optional(),
	apiVersion: z.string().optional(),
});

export type FlagVariation = z.infer<typeof FlagVariationSchema>;
export type FlagRule = z.infer<typeof FlagRuleSchema>;
export type FlagEnvironmentState = z.infer<typeof FlagEnvironmentStateSchema>;
export type FlagState = z.infer<typeof FlagStateSchema>;
export type VariationRef = z.infer<typeof VariationRefSchema>;
export type RuleRef = z.infer<typeof RuleRefSchema>;
export type RolloutIntent = z.infer<typeof RolloutIntentSchema>;
export type SemanticPatchInstruction = z.infer<
	typeof SemanticPatchInstructionSchema
>;
export type TargetingIntent = z.infer<typeof TargetingIntentSchema>;
export type GetFlagStateInput = z.infer<typeof GetFlagStateInputSchema>;
export type ApplyTargetingInput = z.infer<typeof ApplyTargetingInputSchema>;
export type LaunchDarklyClientConfig = z.infer<
	typeof LaunchDarklyClientConfigSchema
>;
