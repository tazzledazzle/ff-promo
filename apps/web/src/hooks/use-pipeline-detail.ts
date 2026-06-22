'use client';

import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

const api = createApiClient({
	baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

export function usePipelineDetail(pipelineId: string) {
	return useQuery({
		queryKey: queryKeys.pipelines.detail(pipelineId),
		queryFn: () => api.getPipeline(pipelineId),
		staleTime: 60_000,
	});
}
