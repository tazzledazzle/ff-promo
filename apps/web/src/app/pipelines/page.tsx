'use client';

import { PipelinesPageHeader } from '@/components/pipelines/pipelines-page-header';
import { PipelinesTable } from '@/components/pipelines/pipelines-table';
import { usePipelines } from '@/hooks/use-pipelines';

export default function PipelinesPage() {
	const { pipelines, isLoading, isError, error } = usePipelines();

	return (
		<main className="container mx-auto max-w-6xl px-4 py-8">
			<PipelinesPageHeader />
			{isError ? (
				<div
					role="alert"
					className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{error instanceof Error ? error.message : 'Failed to load pipelines'}
				</div>
			) : null}
			<PipelinesTable pipelines={pipelines} isLoading={isLoading} />
		</main>
	);
}
