'use client';

import { RunsPageHeader } from '@/components/runs/runs-page-header';
import { RunsTable } from '@/components/runs/runs-table';
import { usePromotionRuns } from '@/hooks/use-promotion-runs';

export default function RunsPage() {
	const { runs, isLoading, isError, error } = usePromotionRuns();

	return (
		<main className="container mx-auto max-w-6xl px-4 py-8">
			<RunsPageHeader />
			{isError ? (
				<div
					role="alert"
					className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{error instanceof Error ? error.message : 'Failed to load runs'}
				</div>
			) : null}
			<RunsTable runs={runs} isLoading={isLoading} />
		</main>
	);
}
