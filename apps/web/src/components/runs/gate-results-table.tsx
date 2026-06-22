import type { GateResultResponse } from '@ff-promo/contracts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

type GateResultsTableProps = {
	results: GateResultResponse[];
};

function verdictVariant(verdict: string): 'default' | 'destructive' | 'outline' {
	if (verdict === 'pass') {
		return 'default';
	}
	if (verdict === 'fail') {
		return 'destructive';
	}
	return 'outline';
}

export function GateResultsTable({ results }: GateResultsTableProps) {
	if (results.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Gate results</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">No gate evaluations yet.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Gate results</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>ID</TableHead>
							<TableHead>Metric</TableHead>
							<TableHead>Verdict</TableHead>
							<TableHead>Threshold</TableHead>
							<TableHead>Observed</TableHead>
							<TableHead>Evaluated</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{results.map((result) => (
							<TableRow key={result.id}>
								<TableCell className="font-mono text-xs">{result.id}</TableCell>
								<TableCell>{result.metricType}</TableCell>
								<TableCell>
									<Badge variant={verdictVariant(result.verdict)}>
										{result.verdict}
									</Badge>
								</TableCell>
								<TableCell>{result.threshold}</TableCell>
								<TableCell>{result.observedValue ?? '—'}</TableCell>
								<TableCell>
									{new Date(result.evaluatedAt).toLocaleString()}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
