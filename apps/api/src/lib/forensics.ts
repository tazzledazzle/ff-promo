import type {
	AuditEvent,
	GateResult,
	PromotionRun,
	Stage,
} from '@ff-promo/db';
import type {
	AuditEventResponse,
	GateForensics,
	GateResultResponse,
	PromotionRunResponse,
} from '@ff-promo/contracts';

type StageLike = Pick<Stage, 'id' | 'orderIndex' | 'environment' | 'displayName'>;

function metadataNumber(
	metadata: Record<string, unknown>,
	key: string,
): number | undefined {
	const value = metadata[key];
	return typeof value === 'number' ? value : undefined;
}

function metadataString(
	metadata: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = metadata[key];
	return typeof value === 'string' ? value : undefined;
}

export function buildGateForensics(
	run: Pick<PromotionRun, 'status' | 'pauseReason' | 'currentStageIndex'>,
	gateResults: GateResult[],
	stages: StageLike[],
): GateForensics | undefined {
	if (run.status !== 'paused') {
		return undefined;
	}

	const stageById = new Map(stages.map((stage) => [stage.id, stage]));
	const failing = gateResults.filter((result) => result.verdict === 'fail');
	const currentStage = stages.find(
		(stage) => stage.orderIndex === run.currentStageIndex,
	);

	return {
		pauseReason: run.pauseReason ?? undefined,
		stageIndex: currentStage?.orderIndex ?? run.currentStageIndex,
		environment: currentStage?.environment,
		displayName: currentStage?.displayName,
		results: failing.map((result) => {
			const stage = stageById.get(result.stageId);
			const metadata = result.metadata as Record<string, unknown>;
			return {
				gateResultId: result.id,
				stageId: result.stageId,
				stageIndex: stage?.orderIndex ?? run.currentStageIndex,
				environment: stage?.environment ?? 'unknown',
				displayName: stage?.displayName ?? 'unknown',
				metricType: result.metricType,
				verdict: result.verdict,
				threshold: result.threshold,
				observedValue: result.observedValue ?? undefined,
				treatmentValue: metadataNumber(metadata, 'treatmentValue'),
				controlValue: metadataNumber(metadata, 'controlValue'),
				observedDelta: metadataNumber(metadata, 'observedDelta'),
				reason: metadataString(metadata, 'reason'),
				evaluatedAt: result.evaluatedAt.toISOString(),
			};
		}),
	};
}

export function mapAuditEvent(event: AuditEvent): AuditEventResponse {
	return {
		id: event.id,
		promotionRunId: event.promotionRunId,
		action: event.action,
		actorType: event.actorType,
		actorId: event.actorId,
		displayName: event.displayName ?? undefined,
		gateResultId: event.gateResultId ?? undefined,
		metadata: (event.metadata as Record<string, unknown>) ?? undefined,
		occurredAt: event.occurredAt.toISOString(),
	};
}

export function mapGateResult(result: GateResult): GateResultResponse {
	return {
		id: result.id,
		promotionRunId: result.promotionRunId,
		stageId: result.stageId,
		verdict: result.verdict,
		metricType: result.metricType,
		observedValue: result.observedValue,
		threshold: result.threshold,
		metadata: result.metadata as Record<string, unknown>,
		evaluatedAt: result.evaluatedAt.toISOString(),
	};
}

export function mapPromotionRun(run: PromotionRun): PromotionRunResponse {
	return {
		id: run.id,
		status: run.status,
		flagKey: run.flagKey,
		pipelineId: run.pipelineId,
		currentStageIndex: run.currentStageIndex,
		pauseReason: run.pauseReason,
		temporalWorkflowId: run.temporalWorkflowId,
		createdAt: run.createdAt.toISOString(),
		updatedAt: run.updatedAt.toISOString(),
	};
}
