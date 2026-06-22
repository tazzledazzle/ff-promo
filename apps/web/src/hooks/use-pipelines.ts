'use client';

import { useQuery } from '@tanstack/react-query';
import type { PipelineListItem } from '@ff-promo/contracts';
import { createApiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

const api = createApiClient({
	baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

export function usePipelines() {
	const query = useQuery({
		queryKey: queryKeys.pipelines.list,
		queryFn: () => api.listPipelines(),
		staleTime: 60_000,
	});

	return {
		pipelines: query.data?.pipelines ?? [],
		isLoading: query.isLoading,
		isError: query.isError,
		error: query.error,
	};
}
