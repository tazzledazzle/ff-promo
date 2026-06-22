'use client';

import { useQuery } from '@tanstack/react-query';
import type { PromotionStatus } from '@ff-promo/contracts';
import { createApiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

const api = createApiClient({
	baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

export function usePromotionRuns(statusFilter?: PromotionStatus) {
	const query = useQuery({
		queryKey: queryKeys.promotionRuns.list(statusFilter),
		queryFn: () => api.listPromotionRuns(statusFilter),
		staleTime: 10_000,
		refetchInterval: 30_000,
	});

	return {
		runs: query.data?.runs ?? [],
		isLoading: query.isLoading,
		isError: query.isError,
		error: query.error,
		refetch: query.refetch,
	};
}
