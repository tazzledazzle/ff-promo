'use client';

import type { PipelineCreateInput } from '@ff-promo/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PipelineForm } from '@/components/pipelines/pipeline-form';
import { createApiClient } from '@/lib/api-client';
import { isGuardrailError } from '@/lib/api-errors';
import { dashboardActor } from '@/lib/actor';

const api = createApiClient({
	baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/ff-promo',
});

export default function NewPipelinePage() {
	const router = useRouter();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (input: PipelineCreateInput) => {
		setSubmitError(null);
		setIsSubmitting(true);
		try {
			const pipeline = await api.createPipeline({
				...input,
				actor: dashboardActor('platform'),
			});
			router.push(`/pipelines/${pipeline.id}`);
		} catch (err) {
			if (isGuardrailError(err)) {
				setSubmitError(err.message);
			} else {
				setSubmitError(
					err instanceof Error ? err.message : 'Failed to create pipeline',
				);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<main className="container mx-auto max-w-3xl px-4 py-8">
			<div className="mb-6">
				<Link
					href="/pipelines"
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					← Back to pipelines
				</Link>
				<h1 className="mt-2 text-2xl font-semibold">New pipeline</h1>
				<p className="text-sm text-muted-foreground">
					Configure dev → staging → prod stages with error rate and latency SLO
					thresholds.
				</p>
			</div>
			<PipelineForm
				onSubmit={handleSubmit}
				isSubmitting={isSubmitting}
				submitError={submitError}
			/>
		</main>
	);
}
