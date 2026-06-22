'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PipelineCreateInput } from '@ff-promo/contracts';
import { createApiClient } from '@/lib/api-client';
import { dashboardActor } from '@/lib/actor';
import { queryKeys } from '@/lib/query-keys';

const api = createApiClient({
	baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

export function usePipelineMutations(pipelineId?: string) {
	const queryClient = useQueryClient();

	const invalidate = async () => {
		await queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.list });
		if (pipelineId) {
			await queryClient.invalidateQueries({
				queryKey: queryKeys.pipelines.detail(pipelineId),
			});
		}
	};

	const create = useMutation({
		mutationFn: (input: PipelineCreateInput) =>
			api.createPipeline({ ...input, actor: dashboardActor('platform') }),
		onSuccess: invalidate,
	});

	const deactivate = useMutation({
		mutationFn: () =>
			api.deactivatePipeline(pipelineId!, dashboardActor('platform')),
		onSuccess: invalidate,
	});

	return { create, deactivate };
}
