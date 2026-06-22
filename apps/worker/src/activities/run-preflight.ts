import { PreflightActivityInputSchema } from '@ff-promo/contracts';
import { runPreflightChecks } from '@ff-promo/telemetry';
import { recordAuditEvent } from './record-audit-event.js';
import { createWorkerLdProvider, createWorkerPrometheusClient } from '../lib/clients.js';
import { loadAllGatePolicies, loadRunStageContext } from '../lib/load-run-context.js';
import {
	buildGateRunContext,
	resolveStageVariationIds,
} from '../lib/stage-targeting.js';

export async function runPreflight(input: { promotionRunId: string }) {
	const { promotionRunId } = PreflightActivityInputSchema.parse(input);
	const { gatePolicies, flagKey, stages, projectKey } =
		await loadAllGatePolicies(promotionRunId);

	const firstStage = stages[0];
	if (!firstStage) {
		throw new Error(`Pipeline for run ${promotionRunId} has no stages`);
	}

	const provider = createWorkerLdProvider();
	const flagState = await provider.getFlagState({
		projectKey,
		flagKey,
		environmentKey: firstStage.environment,
	});

	const { treatmentVariationId, controlVariationId } =
		resolveStageVariationIds(flagState);
	const runContext = buildGateRunContext(
		flagKey,
		treatmentVariationId,
		controlVariationId,
	);

	const report = await runPreflightChecks(
		createWorkerPrometheusClient(),
		gatePolicies,
		runContext,
	);

	if (report.status === 'fail') {
		await recordAuditEvent({
			promotionRunId,
			action: 'run_aborted',
			actorType: 'system',
			actorId: 'preflight',
			metadata: { cause: 'preflight_failed', report },
		});
	}

	return { status: report.status, report };
}
