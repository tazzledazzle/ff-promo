import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function RunsPageHeader() {
	return (
		<div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Promotion Runs</h1>
				<p className="text-sm text-muted-foreground">
					Monitor active and historical feature flag promotions across environments.
				</p>
			</div>
			<Button asChild>
				<Link href="/runs/new">New Run</Link>
			</Button>
		</div>
	);
}
