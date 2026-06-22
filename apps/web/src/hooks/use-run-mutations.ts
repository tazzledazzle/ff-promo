'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createApiClient } from '@/lib/api-client';
import { isConflictError } from '@/lib/api-errors';
import { dashboardActor } from '@/lib/actor';
import { queryKeys } from '@/lib/query-keys';

const api = createApiClient({
	baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

export function useRunMutations(runId: string) {
	const queryClient = useQueryClient();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const invalidate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: queryKeys.promotionRun.detail(runId),
			}),
			queryClient.invalidateQueries({
				queryKey: queryKeys.promotionRuns.all,
			}),
		]);
	};

	const onError = (error: unknown) => {
		if (isConflictError(error)) {
			setErrorMessage(error.message);
		} else if (error instanceof Error) {
			setErrorMessage(error.message);
		} else {
			setErrorMessage('Request failed');
		}
	};

	const start = useMutation({
		mutationFn: () => api.startRun(runId, dashboardActor()),
		onMutate: () => setErrorMessage(null),
		onSuccess: invalidate,
		onError,
	});

	const pause = useMutation({
		mutationFn: () => api.pauseRun(runId, { actor: dashboardActor() }),
		onMutate: () => setErrorMessage(null),
		onSuccess: invalidate,
		onError,
	});

	const resume = useMutation({
		mutationFn: () => api.resumeRun(runId, { actor: dashboardActor() }),
		onMutate: () => setErrorMessage(null),
		onSuccess: invalidate,
		onError,
	});

	const abort = useMutation({
		mutationFn: () => api.abortRun(runId, { actor: dashboardActor() }),
		onMutate: () => setErrorMessage(null),
		onSuccess: invalidate,
		onError,
	});

	const isPending =
		start.isPending ||
		pause.isPending ||
		resume.isPending ||
		abort.isPending;

	return {
		start,
		pause,
		resume,
		abort,
		errorMessage,
		isPending,
	};
}
