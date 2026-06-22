import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function PipelinesPageHeader() {
	return (
		<div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Pipelines</h1>
				<p className="text-sm text-muted-foreground">
					Configure multi-environment promotion pipelines with SLO gate policies.
				</p>
			</div>
			<Button asChild>
				<Link href="/pipelines/new">New Pipeline</Link>
			</Button>
		</div>
	);
}
