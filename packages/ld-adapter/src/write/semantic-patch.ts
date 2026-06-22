import {
	SemanticPatchInstructionSchema,
	type RolloutIntent,
	type SemanticPatchInstruction,
	type TargetingIntent,
} from '@ff-promo/contracts';

export type ResolvedRolloutIds = {
	treatmentVariationId: string;
	controlVariationId: string;
	ruleId?: string;
};

export function buildRolloutWeights(
	treatmentThousandths: number,
	treatmentVariationId: string,
	controlVariationId: string,
): Record<string, number> {
	if (treatmentThousandths < 0 || treatmentThousandths > 100_000) {
		throw new Error('treatmentThousandths must be between 0 and 100000');
	}
	const controlThousandths = 100_000 - treatmentThousandths;
	const weights = {
		[treatmentVariationId]: treatmentThousandths,
		[controlVariationId]: controlThousandths,
	};
	const sum = Object.values(weights).reduce((acc, value) => acc + value, 0);
	if (sum !== 100_000) {
		throw new Error(`rollout weights must sum to 100000, got ${sum}`);
	}
	return weights;
}

function rolloutInstruction(
	rollout: RolloutIntent,
	resolved: ResolvedRolloutIds,
): SemanticPatchInstruction {
	const rolloutWeights = buildRolloutWeights(
		rollout.treatmentPercentThousandths,
		resolved.treatmentVariationId,
		resolved.controlVariationId,
	);

	if (rollout.mode === 'rule') {
		if (!resolved.ruleId) {
			throw new Error('ruleId required when rollout.mode is rule');
		}
		return SemanticPatchInstructionSchema.parse({
			kind: 'updateRuleVariationOrRollout',
			ruleId: resolved.ruleId,
			rolloutWeights,
			rolloutBucketBy: rollout.rolloutBucketBy,
			rolloutContextKind: rollout.rolloutContextKind,
		});
	}

	return SemanticPatchInstructionSchema.parse({
		kind: 'updateFallthroughVariationOrRollout',
		rolloutWeights,
		rolloutBucketBy: rollout.rolloutBucketBy,
		rolloutContextKind: rollout.rolloutContextKind,
	});
}

export function buildTargetingPatchBody(
	intent: TargetingIntent,
	resolved?: ResolvedRolloutIds,
): {
	environmentKey: string;
	comment?: string;
	instructions: Array<Record<string, unknown>>;
} {
	const instructions: Array<Record<string, unknown>> = [];

	if (intent.turnOn === false) {
		instructions.push({ kind: 'turnFlagOff' });
	} else if (intent.turnOn ?? true) {
		instructions.push({ kind: 'turnFlagOn' });
	}

	if (intent.rollout) {
		if (!resolved) {
			throw new Error('resolved variation IDs required when rollout is present');
		}
		const instruction = rolloutInstruction(intent.rollout, resolved);
		const { kind, ...rest } = instruction;
		instructions.push({ kind, ...rest });
	}

	for (const instruction of instructions) {
		if (instruction.kind === 'updatePercentageRollout') {
			throw new Error('updatePercentageRollout is not a valid LD instruction');
		}
	}

	return {
		environmentKey: intent.environmentKey,
		comment: intent.comment,
		instructions,
	};
}
