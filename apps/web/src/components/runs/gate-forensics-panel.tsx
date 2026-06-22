import type { GateForensics } from '@ff-promo/contracts';
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

type GateForensicsPanelProps = {
	forensics: GateForensics;
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

export function GateForensicsPanel({ forensics }: GateForensicsPanelProps) {
	const hasResults = forensics.results.length > 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Gate forensics</CardTitle>
				{forensics.pauseReason ? (
					<p className="text-sm text-muted-foreground">
						Pause reason: {forensics.pauseReason}
					</p>
				) : null}
				{forensics.displayName || forensics.environment ? (
					<p className="text-sm">
						Stage {forensics.stageIndex ?? '—'}: {forensics.displayName ?? '—'} (
						{forensics.environment ?? '—'})
					</p>
				) : null}
			</CardHeader>
			<CardContent>
				{!hasResults ? (
					<p className="text-sm text-muted-foreground">
						No gate failures recorded
						{forensics.pauseReason ? ` (pause reason: ${forensics.pauseReason})` : ''}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Metric</TableHead>
								<TableHead>Verdict</TableHead>
								<TableHead>Threshold</TableHead>
								<TableHead>Observed</TableHead>
								<TableHead>Treatment</TableHead>
								<TableHead>Control</TableHead>
								<TableHead>Delta</TableHead>
								<TableHead>Reason</TableHead>
								<TableHead>Evaluated</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{forensics.results.map((result) => (
								<TableRow key={result.gateResultId}>
									<TableCell>{result.metricType}</TableCell>
									<TableCell>
										<Badge variant={verdictVariant(result.verdict)}>
											{result.verdict}
										</Badge>
									</TableCell>
									<TableCell>{result.threshold}</TableCell>
									<TableCell>{result.observedValue ?? '—'}</TableCell>
									<TableCell>{result.treatmentValue ?? '—'}</TableCell>
									<TableCell>{result.controlValue ?? '—'}</TableCell>
									<TableCell>{result.observedDelta ?? '—'}</TableCell>
									<TableCell>{result.reason ?? '—'}</TableCell>
									<TableCell>
										{new Date(result.evaluatedAt).toLocaleString()}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
