'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { dashboardActor } from '@/lib/actor';
import { createApiClient } from '@/lib/api-client';
import { usePipelines } from '@/hooks/use-pipelines';

const api = createApiClient({
	baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

export default function NewRunPage() {
	const router = useRouter();
	const { pipelines, isLoading, isError, error } = usePipelines();
	const [pipelineId, setPipelineId] = useState('');
	const [flagKey, setFlagKey] = useState('');
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const selectedPipeline = pipelines.find((p) => p.id === pipelineId);

	useEffect(() => {
		if (selectedPipeline) {
			setFlagKey(selectedPipeline.flagKey);
		}
	}, [selectedPipeline]);

	const handlePipelineChange = (value: string) => {
		setPipelineId(value);
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setSubmitError(null);

		if (!pipelineId || !flagKey.trim()) {
			setSubmitError('Pipeline and flag key are required.');
			return;
		}

		setIsSubmitting(true);
		try {
			const run = await api.createPromotionRun({
				pipelineId,
				flagKey: flagKey.trim(),
				actor: dashboardActor(),
			});
			router.push(`/runs/${run.id}`);
		} catch (err) {
			setSubmitError(
				err instanceof Error ? err.message : 'Failed to create promotion run',
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<main className="container mx-auto max-w-lg px-4 py-8">
			<div className="mb-6">
				<Link
					href="/runs"
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					← Back to runs
				</Link>
				<h1 className="mt-2 text-2xl font-semibold">New promotion run</h1>
				<p className="text-sm text-muted-foreground">
					Create a pending run, then start it from the detail page.
				</p>
			</div>

			{isError ? (
				<div
					role="alert"
					className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{error instanceof Error ? error.message : 'Failed to load pipelines'}
				</div>
			) : null}

			{submitError ? (
				<div
					role="alert"
					className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{submitError}
				</div>
			) : null}

			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<label htmlFor="pipeline" className="text-sm font-medium">
						Pipeline
					</label>
					<select
						id="pipeline"
						required
						disabled={isLoading || isSubmitting}
						value={pipelineId}
						onChange={(event) => handlePipelineChange(event.target.value)}
						className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
					>
						<option value="">Select a pipeline</option>
						{pipelines.map((pipeline) => (
							<option key={pipeline.id} value={pipeline.id}>
								{pipeline.name} ({pipeline.flagKey})
							</option>
						))}
					</select>
				</div>

				<div className="space-y-2">
					<label htmlFor="flagKey" className="text-sm font-medium">
						Flag key
					</label>
					<input
						id="flagKey"
						required
						disabled={isSubmitting}
						value={flagKey}
						onChange={(event) => setFlagKey(event.target.value)}
						placeholder={selectedPipeline?.flagKey ?? 'feature-flag-key'}
						className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 font-mono text-sm"
					/>
				</div>

				<Button type="submit" disabled={isSubmitting || isLoading}>
					{isSubmitting ? 'Creating…' : 'Create run'}
				</Button>
			</form>
		</main>
	);
}
