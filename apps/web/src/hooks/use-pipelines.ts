'use client';

import { useQuery } from '@tanstack/react-query';
import type { PipelineListItem } from '@ff-promo/contracts';
import { createApiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

const api = createApiClient({
	baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

type UsePipelinesOptions = {
	activeOnly?: boolean;
};

export function usePipelines(options: UsePipelinesOptions = {}) {
	const { activeOnly = false } = options;

	const query = useQuery({
		queryKey: queryKeys.pipelines.list,
		queryFn: () => api.listPipelines(),
		staleTime: 60_000,
	});

	const pipelines = (query.data?.pipelines ?? []) as PipelineListItem[];
	const filtered = activeOnly
		? pipelines.filter((pipeline) => pipeline.isActive)
		: pipelines;

	return {
		pipelines: filtered,
		isLoading: query.isLoading,
		isError: query.isError,
		error: query.error,
	};
}
