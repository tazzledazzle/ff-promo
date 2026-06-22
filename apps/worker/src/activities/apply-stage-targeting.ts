import { RunStageInputSchema } from '@ff-promo/contracts';
import { createWorkerLdProvider } from '../lib/clients.js';
import { loadRunStageContext } from '../lib/load-run-context.js';
import {
	buildGateRunContext,
	buildStageTargetingIntent,
	resolveStageVariationIds,
} from '../lib/stage-targeting.js';

export async function applyStageTargeting(input: {
	promotionRunId: string;
	stageIndex: number;
}) {
	const { promotionRunId, stageIndex } = RunStageInputSchema.parse(input);
	const { projectKey, flagKey, stage } = await loadRunStageContext(
		promotionRunId,
		stageIndex,
	);

	const provider = createWorkerLdProvider();
	const intent = buildStageTargetingIntent(stage);

	const flagStateBefore = await provider.getFlagState({
		projectKey,
		flagKey,
		environmentKey: stage.environment,
	});

	await provider.applyTargeting({
		projectKey,
		flagKey,
		intent,
	});

	const flagStateAfter = await provider.getFlagState({
		projectKey,
		flagKey,
		environmentKey: stage.environment,
	});

	const { treatmentVariationId, controlVariationId } = resolveStageVariationIds(
		flagStateAfter.variations.length ? flagStateAfter : flagStateBefore,
	);

	return {
		environmentKey: stage.environment,
		treatmentVariationId,
		controlVariationId,
		gateRunContext: buildGateRunContext(
			flagKey,
			treatmentVariationId,
			controlVariationId,
		),
	};
}
