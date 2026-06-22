'use client';

import { useQuery } from '@tanstack/react-query';
import type { PipelineDetailResponse } from '@ff-promo/contracts';
import { createApiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

const api = createApiClient({
	baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

export function usePipeline(pipelineId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.pipelines.detail(pipelineId ?? ''),
		queryFn: () => api.getPipeline(pipelineId!),
		enabled: Boolean(pipelineId),
		staleTime: 60_000,
		select: (data): PipelineDetailResponse => data,
	});
}
