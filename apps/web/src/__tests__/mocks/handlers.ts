import { http, HttpResponse } from 'msw';
import type {
	AuditEventResponse,
	GateForensics,
	GateResultResponse,
	PipelineDetailResponse,
	PipelineListResponse,
	PipelineResponse,
	PromotionRunListItem,
	PromotionRunResponse,
	PromotionRunStatusResponse,
} from '@ff-promo/contracts';

export const mockPipelineId = 'pipeline-1';
export const mockRunId = 'run-1';

export const mockPausedListItem: PromotionRunListItem = {
	id: mockRunId,
	status: 'paused',
	flagKey: 'api-read-flag',
	pipelineId: mockPipelineId,
	pipelineName: 'Dev Pipeline',
	currentStageIndex: 0,
	currentEnvironment: 'dev',
	currentStageDisplayName: 'Dev',
	pauseReason: 'threshold_exceeded',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
};

export const mockGateForensics: GateForensics = {
	pauseReason: 'threshold_exceeded',
	stageIndex: 0,
	environment: 'dev',
	displayName: 'Dev',
	results: [
		{
			gateResultId: 'gate-1',
			stageId: 'stage-1',
			stageIndex: 0,
			environment: 'dev',
			displayName: 'Dev',
			metricType: 'error_rate',
			verdict: 'fail',
			threshold: 0.01,
			observedValue: 0.05,
			treatmentValue: 0.05,
			controlValue: 0.01,
			observedDelta: 0.04,
			reason: 'threshold_exceeded',
			evaluatedAt: '2026-01-01T00:00:00.000Z',
		},
	],
};

export const mockPausedRun: PromotionRunResponse = {
	id: mockRunId,
	status: 'paused',
	flagKey: 'api-read-flag',
	pipelineId: mockPipelineId,
	currentStageIndex: 0,
	pauseReason: 'threshold_exceeded',
	temporalWorkflowId: mockRunId,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
};

export const mockActiveRun: PromotionRunResponse = {
	...mockPausedRun,
	id: 'run-active',
	status: 'active',
	pauseReason: null,
};

export const mockPendingRun: PromotionRunResponse = {
	...mockPausedRun,
	id: 'run-pending',
	status: 'pending',
	pauseReason: null,
	temporalWorkflowId: null,
};

export const mockGateResults: GateResultResponse[] = [
	{
		id: 'gate-1',
		promotionRunId: mockRunId,
		stageId: 'stage-1',
		verdict: 'fail',
		metricType: 'error_rate',
		observedValue: 0.05,
		threshold: 0.01,
		metadata: { reason: 'threshold_exceeded' },
		evaluatedAt: '2026-01-01T00:00:00.000Z',
	},
];

export const mockAuditEvents: AuditEventResponse[] = [
	{
		id: 'audit-1',
		promotionRunId: mockRunId,
		action: 'promotion_paused',
		actorType: 'system',
		actorId: 'gate-worker',
		displayName: 'Gate evaluation',
		gateResultId: 'gate-1',
		occurredAt: '2026-01-01T00:00:00.000Z',
	},
];

export const mockPipelineDetail: PipelineDetailResponse = {
	id: mockPipelineId,
	name: 'Dev Pipeline',
	flagKey: 'api-read-flag',
	projectKey: 'default',
	isActive: true,
	version: 1,
	stages: [
		{
			id: 'stage-1',
			orderIndex: 0,
			environment: 'dev',
			displayName: 'Dev',
			gatePolicies: [
				{
					id: 'gp-1',
					metricType: 'error_rate',
					threshold: 0.01,
					serviceName: 'demo-service',
				},
				{
					id: 'gp-2',
					metricType: 'latency_p95',
					threshold: 500,
					serviceName: 'demo-service',
				},
			],
		},
		{
			id: 'stage-2',
			orderIndex: 1,
			environment: 'staging',
			displayName: 'Staging',
			gatePolicies: [
				{
					id: 'gp-3',
					metricType: 'error_rate',
					threshold: 0.01,
					serviceName: 'demo-service',
				},
				{
					id: 'gp-4',
					metricType: 'latency_p95',
					threshold: 500,
					serviceName: 'demo-service',
				},
			],
		},
	],
};

export const mockPipelineList: PipelineListResponse = {
	pipelines: [
		{
			id: mockPipelineId,
			name: 'Dev Pipeline',
			flagKey: 'api-read-flag',
			projectKey: 'default',
			stageCount: 2,
			isActive: true,
			version: 1,
		},
	],
};

const pipelineStore = new Map<string, PipelineDetailResponse>([
	[mockPipelineId, mockPipelineDetail],
]);

const runStore = new Map<string, PromotionRunResponse>([
	[mockRunId, mockPausedRun],
	['run-active', mockActiveRun],
	['run-pending', mockPendingRun],
]);

export function handlers() {
	return [
		http.get('/api/ff-promo/v1/promotion-runs', () => {
			return HttpResponse.json({ runs: [mockPausedListItem] });
		}),

		http.get('/api/ff-promo/v1/promotion-runs/:id', ({ params }) => {
			const id = params.id as string;
			const run = runStore.get(id) ?? mockPausedRun;
			const body: PromotionRunStatusResponse = {
				run: { ...run, id },
				gateForensics:
					run.status === 'paused' ? mockGateForensics : undefined,
			};
			return HttpResponse.json(body);
		}),

		http.get('/api/ff-promo/v1/promotion-runs/:id/gate-results', () => {
			return HttpResponse.json(mockGateResults);
		}),

		http.get('/api/ff-promo/v1/promotion-runs/:id/audit-events', () => {
			return HttpResponse.json(mockAuditEvents);
		}),

		http.get('/api/ff-promo/v1/pipelines', () => {
			return HttpResponse.json(mockPipelineList);
		}),

		http.get('/api/ff-promo/v1/pipelines/:id', ({ params }) => {
			const id = params.id as string;
			const pipeline = pipelineStore.get(id) ?? mockPipelineDetail;
			return HttpResponse.json({ ...pipeline, id });
		}),

		http.post('/api/ff-promo/v1/pipelines', async ({ request }) => {
			const body = (await request.json()) as PipelineResponse & {
				stages: Array<{ gatePolicies: unknown[] }>;
			};
			const invalidStage = body.stages?.some(
				(stage) => (stage.gatePolicies?.length ?? 0) < 2,
			);
			if (invalidStage) {
				return HttpResponse.json(
					{
						error: 'unprocessable_entity',
						message: 'Each stage requires error_rate and latency_p95 policies',
					},
					{ status: 422 },
				);
			}
			const pipeline: PipelineDetailResponse = {
				id: 'pipeline-new',
				name: body.name,
				flagKey: body.flagKey,
				projectKey: body.projectKey,
				isActive: true,
				version: 1,
				stages: body.stages.map((stage, index) => ({
					...stage,
					id: `stage-new-${index}`,
					gatePolicies: stage.gatePolicies.map((policy, policyIndex) => ({
						...(policy as object),
						id: `gp-new-${index}-${policyIndex}`,
					})),
				})),
			};
			pipelineStore.set(pipeline.id, pipeline);
			return HttpResponse.json(pipeline, { status: 201 });
		}),

		http.patch('/api/ff-promo/v1/pipelines/:id', ({ params }) => {
			const id = params.id as string;
			const existing = pipelineStore.get(id) ?? mockPipelineDetail;
			const updated = { ...existing, id, isActive: false };
			pipelineStore.set(id, updated);
			return HttpResponse.json(updated);
		}),

		http.post('/api/ff-promo/v1/promotion-runs', async ({ request }) => {
			const body = (await request.json()) as {
				pipelineId: string;
				flagKey: string;
			};
			const run: PromotionRunResponse = {
				id: 'run-new',
				status: 'pending',
				flagKey: body.flagKey,
				pipelineId: body.pipelineId,
				currentStageIndex: 0,
				pauseReason: null,
				temporalWorkflowId: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			runStore.set(run.id, run);
			return HttpResponse.json(run, { status: 201 });
		}),

		http.post('/api/ff-promo/v1/promotion-runs/:id/start', ({ params }) => {
			const id = params.id as string;
			const existing = runStore.get(id) ?? mockPendingRun;
			const updated = { ...existing, id, status: 'active' as const };
			runStore.set(id, updated);
			return HttpResponse.json(updated);
		}),

		http.post('/api/ff-promo/v1/promotion-runs/:id/pause', ({ params }) => {
			const id = params.id as string;
			const existing = runStore.get(id);
			if (!existing || existing.status !== 'active') {
				return HttpResponse.json(
					{ error: 'conflict', message: 'Run must be active to pause' },
					{ status: 409 },
				);
			}
			const updated = {
				...existing,
				status: 'paused' as const,
				pauseReason: 'manual',
			};
			runStore.set(id, updated);
			return HttpResponse.json({ promotionRunId: id, action: 'pause' });
		}),

		http.post('/api/ff-promo/v1/promotion-runs/:id/resume', ({ params }) => {
			const id = params.id as string;
			return HttpResponse.json({ promotionRunId: id, action: 'resume' });
		}),

		http.post('/api/ff-promo/v1/promotion-runs/:id/abort', ({ params }) => {
			const id = params.id as string;
			const existing = runStore.get(id);
			if (!existing || (existing.status !== 'active' && existing.status !== 'paused')) {
				return HttpResponse.json(
					{ error: 'conflict', message: 'Run must be active or paused to abort' },
					{ status: 409 },
				);
			}
			runStore.set(id, { ...existing, status: 'aborted' });
			return HttpResponse.json({ promotionRunId: id, action: 'abort' });
		}),
	];
}
