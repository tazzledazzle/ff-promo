'use client';

import type { PipelineDetailResponse } from '@ff-promo/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

type PipelineDetailProps = {
	pipeline: PipelineDetailResponse;
	onDeactivate: () => Promise<void>;
	isDeactivating?: boolean;
};

export function PipelineDetail({
	pipeline,
	onDeactivate,
	isDeactivating = false,
}: PipelineDetailProps) {
	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-semibold">{pipeline.name}</h1>
						<Badge variant={pipeline.isActive ? 'default' : 'secondary'}>
							{pipeline.isActive ? 'Active' : 'Inactive'}
						</Badge>
					</div>
					<p className="mt-1 text-sm text-muted-foreground">
						Flag <span className="font-mono">{pipeline.flagKey}</span> · Project{' '}
						{pipeline.projectKey} · Version {pipeline.version}
					</p>
					<p className="mt-2 text-sm text-muted-foreground">
						Structural changes require creating a new pipeline. Deactivate this
						pipeline to stop new promotion runs.
					</p>
				</div>
				{pipeline.isActive ? (
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="destructive" disabled={isDeactivating}>
								Deactivate pipeline
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Deactivate pipeline?</AlertDialogTitle>
								<AlertDialogDescription>
									New promotion runs will be rejected until a new active pipeline
									is configured. Existing pending runs cannot be started.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={() => onDeactivate()}>
									Deactivate
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				) : null}
			</div>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Stage</TableHead>
						<TableHead>Environment</TableHead>
						<TableHead>Error rate</TableHead>
						<TableHead>Latency P95 (ms)</TableHead>
						<TableHead>Service</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{pipeline.stages.map((stage) => {
						const errorRate = stage.gatePolicies.find(
							(p) => p.metricType === 'error_rate',
						);
						const latencyP95 = stage.gatePolicies.find(
							(p) => p.metricType === 'latency_p95',
						);
						return (
							<TableRow key={stage.id}>
								<TableCell>{stage.displayName}</TableCell>
								<TableCell className="capitalize">{stage.environment}</TableCell>
								<TableCell>{errorRate?.threshold ?? '—'}</TableCell>
								<TableCell>{latencyP95?.threshold ?? '—'}</TableCell>
								<TableCell>{errorRate?.serviceName ?? '—'}</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
