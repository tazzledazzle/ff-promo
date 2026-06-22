'use client';

import Link from 'next/link';
import { use } from 'react';
import { PipelineDetail } from '@/components/pipelines/pipeline-detail';
import { usePipelineDetail } from '@/hooks/use-pipeline-detail';
import { usePipelineMutations } from '@/hooks/use-pipeline-mutations';

type PipelineDetailPageProps = {
	params: Promise<{ id: string }>;
};

export default function PipelineDetailPage({ params }: PipelineDetailPageProps) {
	const { id } = use(params);
	const { data: pipeline, isLoading, isError, error, refetch } =
		usePipelineDetail(id);
	const { deactivate } = usePipelineMutations(id);

	if (isLoading) {
		return (
			<main className="container mx-auto max-w-4xl px-4 py-8">
				<p className="text-sm text-muted-foreground">Loading pipeline…</p>
			</main>
		);
	}

	if (isError || !pipeline) {
		return (
			<main className="container mx-auto max-w-4xl px-4 py-8">
				<div
					role="alert"
					className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{error instanceof Error ? error.message : 'Failed to load pipeline'}
				</div>
				<Link href="/pipelines" className="mt-4 inline-block text-sm">
					← Back to pipelines
				</Link>
			</main>
		);
	}

	return (
		<main className="container mx-auto max-w-4xl px-4 py-8">
			<Link
				href="/pipelines"
				className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
			>
				← Back to pipelines
			</Link>
			<PipelineDetail
				pipeline={pipeline}
				isDeactivating={deactivate.isPending}
				onDeactivate={async () => {
					await deactivate.mutateAsync();
					await refetch();
				}}
			/>
		</main>
	);
}
