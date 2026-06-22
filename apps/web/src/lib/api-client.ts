import type {
	Actor,
	ControlActionRequest,
	CreatePromotionRunRequest,
	GateResultResponse,
	PipelineDetailResponse,
	PipelineListResponse,
	PromotionRunListResponse,
	PromotionRunResponse,
	PromotionRunStatusResponse,
	PromotionStatus,
	AuditEventResponse,
} from '@ff-promo/contracts';
import { ApiClientError } from '@/lib/api-errors';

type ApiClientOptions = {
	baseUrl?: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		let message = response.statusText;
		let code: string | undefined;
		try {
			const body = (await response.json()) as { message?: string; error?: string };
			message = body.message ?? message;
			code = body.error;
		} catch {
			// ignore parse errors
		}
		throw new ApiClientError(message, response.status, code);
	}
	return (await response.json()) as T;
}

export function createApiClient(options: ApiClientOptions = {}) {
	const baseUrl =
		options.baseUrl ??
		(typeof process !== 'undefined'
			? process.env.NEXT_PUBLIC_API_URL
			: undefined) ??
		'/api/ff-promo';

	async function request<T>(
		path: string,
		init?: RequestInit,
	): Promise<T> {
		const response = await fetch(`${baseUrl}${path}`, {
			...init,
			headers: {
				'Content-Type': 'application/json',
				...init?.headers,
			},
		});
		return parseResponse<T>(response);
	}

	return {
		listPromotionRuns(status?: PromotionStatus) {
			const query = status ? `?status=${status}` : '';
			return request<PromotionRunListResponse>(`/v1/promotion-runs${query}`);
		},

		listPipelines() {
			return request<PipelineListResponse>('/v1/pipelines');
		},

		getPipeline(pipelineId: string) {
			return request<PipelineDetailResponse>(`/v1/pipelines/${pipelineId}`);
		},

		getPromotionRun(promotionRunId: string) {
			return request<PromotionRunStatusResponse>(
				`/v1/promotion-runs/${promotionRunId}`,
			);
		},

		listGateResults(promotionRunId: string) {
			return request<GateResultResponse[]>(
				`/v1/promotion-runs/${promotionRunId}/gate-results`,
			);
		},

		listAuditEvents(promotionRunId: string) {
			return request<AuditEventResponse[]>(
				`/v1/promotion-runs/${promotionRunId}/audit-events`,
			);
		},

		createPromotionRun(body: CreatePromotionRunRequest) {
			return request<PromotionRunResponse>('/v1/promotion-runs', {
				method: 'POST',
				body: JSON.stringify(body),
			});
		},

		startRun(promotionRunId: string, actor: Actor) {
			return request<PromotionRunResponse>(
				`/v1/promotion-runs/${promotionRunId}/start`,
				{
					method: 'POST',
					body: JSON.stringify({ actor }),
				},
			);
		},

		pauseRun(promotionRunId: string, body: ControlActionRequest = {}) {
			return request<{ promotionRunId: string; action: 'pause' }>(
				`/v1/promotion-runs/${promotionRunId}/pause`,
				{
					method: 'POST',
					body: JSON.stringify(body),
				},
			);
		},

		resumeRun(promotionRunId: string, body: ControlActionRequest = {}) {
			return request<{ promotionRunId: string; action: 'resume' }>(
				`/v1/promotion-runs/${promotionRunId}/resume`,
				{
					method: 'POST',
					body: JSON.stringify(body),
				},
			);
		},

		abortRun(promotionRunId: string, body: ControlActionRequest = {}) {
			return request<{ promotionRunId: string; action: 'abort' }>(
				`/v1/promotion-runs/${promotionRunId}/abort`,
				{
					method: 'POST',
					body: JSON.stringify(body),
				},
			);
		},
	};
}

export type ApiClient = ReturnType<typeof createApiClient>;
