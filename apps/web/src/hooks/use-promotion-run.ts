'use client';

import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '@/lib/api-client';
import { runPollIntervalMs } from '@/lib/polling';
import { queryKeys } from '@/lib/query-keys';

const api = createApiClient({
	baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

export function usePromotionRun(runId: string) {
	const runQuery = useQuery({
		queryKey: queryKeys.promotionRun.detail(runId),
		queryFn: () => api.getPromotionRun(runId),
		enabled: Boolean(runId),
		refetchInterval: (query) =>
			runPollIntervalMs(query.state.data?.run.status),
	});

	const status = runQuery.data?.run.status;
	const pollInterval = runPollIntervalMs(status);

	const gateResultsQuery = useQuery({
		queryKey: queryKeys.promotionRun.gateResults(runId),
		queryFn: () => api.listGateResults(runId),
		enabled: Boolean(runId) && Boolean(runQuery.data),
		refetchInterval: pollInterval,
	});

	const auditEventsQuery = useQuery({
		queryKey: queryKeys.promotionRun.auditEvents(runId),
		queryFn: () => api.listAuditEvents(runId),
		enabled: Boolean(runId) && Boolean(runQuery.data),
		refetchInterval: pollInterval,
	});

	return {
		run: runQuery.data?.run,
		gateForensics: runQuery.data?.gateForensics,
		liveWorkflowStatus: runQuery.data?.liveWorkflowStatus,
		gateResults: gateResultsQuery.data ?? [],
		auditEvents: auditEventsQuery.data ?? [],
		isLoading: runQuery.isLoading,
		isError: runQuery.isError,
		error: runQuery.error,
		refetch: runQuery.refetch,
	};
}
