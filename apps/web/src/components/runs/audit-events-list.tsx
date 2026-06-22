import type { AuditEventResponse } from '@ff-promo/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AuditEventsListProps = {
	events: AuditEventResponse[];
};

export function AuditEventsList({ events }: AuditEventsListProps) {
	const sorted = [...events].sort(
		(a, b) =>
			new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Audit trail</CardTitle>
			</CardHeader>
			<CardContent>
				{sorted.length === 0 ? (
					<p className="text-sm text-muted-foreground">No audit events yet.</p>
				) : (
					<ul className="space-y-3">
						{sorted.map((event) => (
							<li
								key={event.id}
								className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0"
							>
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-medium">{event.action}</span>
									<span className="text-xs text-muted-foreground">
										{new Date(event.occurredAt).toLocaleString()}
									</span>
								</div>
								<p className="text-sm text-muted-foreground">
									{event.actorType}/{event.actorId}
									{event.displayName ? ` · ${event.displayName}` : ''}
								</p>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
