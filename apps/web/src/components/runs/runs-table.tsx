import Link from 'next/link';
import type { PromotionRunListItem } from '@ff-promo/contracts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { RunStatusBadge } from '@/components/runs/run-status-badge';

type RunsTableProps = {
	runs: PromotionRunListItem[];
	isLoading?: boolean;
};

function formatStage(run: PromotionRunListItem): string {
	const parts = [
		run.currentStageDisplayName,
		run.currentEnvironment,
	].filter(Boolean);
	return parts.length > 0 ? parts.join(' · ') : `Stage ${run.currentStageIndex}`;
}

function formatUpdatedAt(updatedAt: string): string {
	return new Date(updatedAt).toLocaleString();
}

export function RunsTable({ runs, isLoading = false }: RunsTableProps) {
	if (isLoading) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 3 }).map((_, index) => (
					<Skeleton key={index} className="h-10 w-full" />
				))}
			</div>
		);
	}

	if (runs.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
				<p>No promotion runs yet.</p>
				<Button asChild variant="outline" className="mt-4">
					<Link href="/runs/new">Create your first run</Link>
				</Button>
			</div>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Status</TableHead>
					<TableHead>Flag Key</TableHead>
					<TableHead>Pipeline</TableHead>
					<TableHead>Stage</TableHead>
					<TableHead>Updated</TableHead>
					<TableHead className="text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{runs.map((run) => (
					<TableRow key={run.id}>
						<TableCell>
							<RunStatusBadge status={run.status} />
						</TableCell>
						<TableCell className="font-mono text-sm">{run.flagKey}</TableCell>
						<TableCell>{run.pipelineName ?? run.pipelineId}</TableCell>
						<TableCell>{formatStage(run)}</TableCell>
						<TableCell>{formatUpdatedAt(run.updatedAt)}</TableCell>
						<TableCell className="text-right">
							<Button asChild variant="outline" size="sm">
								<Link href={`/runs/${run.id}`}>View</Link>
							</Button>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
