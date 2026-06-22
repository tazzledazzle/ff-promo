import type { PipelineDetailResponse } from '@ff-promo/contracts';
import { cn } from '@/lib/utils';

type RunStageTimelineProps = {
	pipeline: PipelineDetailResponse | undefined;
	currentStageIndex: number;
};

export function RunStageTimeline({
	pipeline,
	currentStageIndex,
}: RunStageTimelineProps) {
	if (!pipeline || pipeline.stages.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
				Pipeline stages unavailable.
			</div>
		);
	}

	const stages = [...pipeline.stages].sort(
		(a, b) => a.orderIndex - b.orderIndex,
	);

	return (
		<ol className="flex flex-wrap gap-2">
			{stages.map((stage, index) => {
				const isCurrent = index === currentStageIndex;
				const isPast = index < currentStageIndex;

				return (
					<li
						key={stage.id}
						className={cn(
							'flex min-w-[8rem] flex-col rounded-md border px-3 py-2 text-sm',
							isCurrent && 'border-primary bg-primary/5 font-medium',
							isPast && 'opacity-70',
						)}
					>
						<span>{stage.displayName}</span>
						<span className="text-xs text-muted-foreground">
							{stage.environment}
						</span>
					</li>
				);
			})}
		</ol>
	);
}
