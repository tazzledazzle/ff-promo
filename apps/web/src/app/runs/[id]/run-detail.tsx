'use client';

import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { AuditEventsList } from '@/components/runs/audit-events-list';
import { GateForensicsPanel } from '@/components/runs/gate-forensics-panel';
import { GateResultsTable } from '@/components/runs/gate-results-table';
import { RunControlBar } from '@/components/runs/run-control-bar';
import { RunStageTimeline } from '@/components/runs/run-stage-timeline';
import { RunStatusBadge } from '@/components/runs/run-status-badge';
import { usePipeline } from '@/hooks/use-pipeline';
import { usePromotionRun } from '@/hooks/use-promotion-run';

type RunDetailProps = {
	runId: string;
};

export function RunDetail({ runId }: RunDetailProps) {
	const {
		run,
		gateForensics,
		gateResults,
		auditEvents,
		isLoading,
		isError,
		error,
	} = usePromotionRun(runId);
	const { data: pipeline, isLoading: pipelineLoading } = usePipeline(
		run?.pipelineId,
	);

	if (isLoading) {
		return (
			<main className="container mx-auto max-w-6xl space-y-4 px-4 py-8">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-24 w-full" />
			</main>
		);
	}

	if (isError || !run) {
		return (
			<main className="container mx-auto max-w-6xl px-4 py-8">
				<div
					role="alert"
					className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{error instanceof Error ? error.message : 'Failed to load run'}
				</div>
			</main>
		);
	}

	const currentStage = pipeline?.stages[run.currentStageIndex];

	return (
		<main className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
			<div>
				<Link
					href="/runs"
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					← Back to runs
				</Link>
			</div>

			<header className="space-y-2">
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-mono text-2xl font-semibold">{run.flagKey}</h1>
					<RunStatusBadge status={run.status} />
				</div>
				<p className="text-sm text-muted-foreground">
					Pipeline: {pipeline?.name ?? run.pipelineId}
				</p>
				<p className="text-sm">
					Current stage:{' '}
					{currentStage
						? `${currentStage.displayName} (${currentStage.environment})`
						: `Stage ${run.currentStageIndex}`}
				</p>
			</header>

			<RunControlBar runId={run.id} status={run.status} />

			<section className="space-y-2">
				<h2 className="text-lg font-medium">Stage timeline</h2>
				{pipelineLoading ? (
					<Skeleton className="h-16 w-full" />
				) : (
					<RunStageTimeline
						pipeline={pipeline}
						currentStageIndex={run.currentStageIndex}
					/>
				)}
			</section>

			{gateForensics ? <GateForensicsPanel forensics={gateForensics} /> : null}

			<GateResultsTable results={gateResults} />
			<AuditEventsList events={auditEvents} />
		</main>
	);
}
