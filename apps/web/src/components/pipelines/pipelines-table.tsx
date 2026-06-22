import Link from 'next/link';
import type { PipelineListItem } from '@ff-promo/contracts';
import { Badge } from '@/components/ui/badge';
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

type PipelinesTableProps = {
	pipelines: PipelineListItem[];
	isLoading?: boolean;
};

export function PipelinesTable({ pipelines, isLoading = false }: PipelinesTableProps) {
	if (isLoading) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 3 }).map((_, index) => (
					<Skeleton key={index} className="h-10 w-full" />
				))}
			</div>
		);
	}

	if (pipelines.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
				<p>No pipelines configured yet.</p>
				<Button asChild variant="outline" className="mt-4">
					<Link href="/pipelines/new">Create your first pipeline</Link>
				</Button>
			</div>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Flag Key</TableHead>
					<TableHead>Stages</TableHead>
					<TableHead>Status</TableHead>
					<TableHead className="text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{pipelines.map((pipeline) => (
					<TableRow key={pipeline.id}>
						<TableCell>{pipeline.name}</TableCell>
						<TableCell className="font-mono text-sm">{pipeline.flagKey}</TableCell>
						<TableCell>{pipeline.stageCount}</TableCell>
						<TableCell>
							<Badge variant={pipeline.isActive ? 'default' : 'secondary'}>
								{pipeline.isActive ? 'Active' : 'Inactive'}
							</Badge>
						</TableCell>
						<TableCell className="text-right">
							<Button asChild variant="outline" size="sm">
								<Link href={`/pipelines/${pipeline.id}`}>View</Link>
							</Button>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
