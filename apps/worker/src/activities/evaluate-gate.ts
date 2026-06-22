import {
	EvaluateGateActivityInputSchema,
	type GateVerdict,
} from '@ff-promo/contracts';
import { evaluateStageGates } from '@ff-promo/telemetry';
import { createPrismaClient, GateResultRepository } from '@ff-promo/db';
import { createWorkerLdProvider, createWorkerPrometheusClient } from '../lib/clients.js';
import { loadRunStageContext } from '../lib/load-run-context.js';
import {
	buildGateRunContext,
	resolveStageVariationIds,
} from '../lib/stage-targeting.js';
import { recordAuditEvent } from './record-audit-event.js';

export async function evaluateGate(input: {
	promotionRunId: string;
	stageIndex: number;
	treatmentVariationId?: string;
	controlVariationId?: string;
}) {
	const parsed = EvaluateGateActivityInputSchema.parse(input);
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is required for evaluateGate activity');
	}

	const { run, stage, gatePolicies, projectKey, flagKey } =
		await loadRunStageContext(parsed.promotionRunId, parsed.stageIndex);

	let treatmentVariationId = parsed.treatmentVariationId;
	let controlVariationId = parsed.controlVariationId;

	if (!treatmentVariationId || !controlVariationId) {
		const provider = createWorkerLdProvider();
		const flagState = await provider.getFlagState({
			projectKey,
			flagKey,
			environmentKey: stage.environment,
		});
		const resolved = resolveStageVariationIds(flagState);
		treatmentVariationId = treatmentVariationId ?? resolved.treatmentVariationId;
		controlVariationId = controlVariationId ?? resolved.controlVariationId;
	}

	const runContext = buildGateRunContext(
		flagKey,
		treatmentVariationId,
		controlVariationId,
	);

	const evaluation = await evaluateStageGates(
		createWorkerPrometheusClient(),
		gatePolicies,
		runContext,
	);

	const db = createPrismaClient(databaseUrl);
	const gateResultIds: string[] = [];
	let pauseReason: string | undefined;

	try {
		const gateResultRepo = new GateResultRepository(db);

		for (const result of evaluation.results) {
			const verdict: GateVerdict = result.verdict;
			const gateResult = await gateResultRepo.create({
				promotionRunId: run.id,
				stageId: stage.id,
				verdict,
				metricType: result.metricType,
				observedValue: result.observedDelta ?? result.treatmentValue,
				threshold: result.threshold,
				metadata: {
					...result.metadata,
					treatmentValue: result.treatmentValue,
					controlValue: result.controlValue,
					observedDelta: result.observedDelta,
				},
			});
			gateResultIds.push(gateResult.id);

			await recordAuditEvent({
				promotionRunId: run.id,
				action: 'gate_evaluated',
				actorType: 'system',
				actorId: 'telemetry',
				gateResultId: gateResult.id,
				metadata: {
					stageIndex: parsed.stageIndex,
					metricType: result.metricType,
					verdict: result.verdict,
					reason: result.metadata.reason,
				},
			});

			if (result.verdict === 'fail' && !pauseReason) {
				pauseReason =
					typeof result.metadata.reason === 'string'
						? result.metadata.reason
						: 'gate_failed';
			}
		}
	} finally {
		await db.$disconnect();
	}

	return {
		verdict: evaluation.verdict,
		gateResultIds,
		pauseReason,
	};
}
