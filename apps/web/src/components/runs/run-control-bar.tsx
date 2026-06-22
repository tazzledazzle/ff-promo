'use client';

import { useState } from 'react';
import type { PromotionStatus } from '@ff-promo/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmAbortDialog } from '@/components/runs/confirm-abort-dialog';
import { useRunMutations } from '@/hooks/use-run-mutations';

type RunControlBarProps = {
	runId: string;
	status: PromotionStatus;
};

export function RunControlBar({ runId, status }: RunControlBarProps) {
	const { start, pause, resume, abort, errorMessage, isPending } =
		useRunMutations(runId);
	const [abortDialogOpen, setAbortDialogOpen] = useState(false);

	const handleAbortConfirm = () => {
		abort.mutate(undefined, {
			onSuccess: () => setAbortDialogOpen(false),
		});
	};

	return (
		<div className="space-y-3 rounded-lg border p-4">
			<h2 className="text-sm font-medium">Controls</h2>

			{errorMessage ? (
				<div
					role="alert"
					className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{errorMessage}
				</div>
			) : null}

			<div className="flex flex-wrap gap-2">
				{status === 'pending' ? (
					<Button disabled={isPending} onClick={() => start.mutate()}>
						Start
					</Button>
				) : null}

				{status === 'active' ? (
					<>
						<Button
							variant="secondary"
							disabled={isPending}
							onClick={() => pause.mutate()}
						>
							Pause
						</Button>
						<Button
							variant="destructive"
							disabled={isPending}
							onClick={() => setAbortDialogOpen(true)}
						>
							Abort
						</Button>
					</>
				) : null}

				{status === 'paused' ? (
					<>
						<Button disabled={isPending} onClick={() => resume.mutate()}>
							Resume
						</Button>
						<Button
							variant="destructive"
							disabled={isPending}
							onClick={() => setAbortDialogOpen(true)}
						>
							Abort
						</Button>
					</>
				) : null}

				{status === 'completed' || status === 'aborted' ? (
					<p className="text-sm text-muted-foreground">
						This run is {status}. No control actions available.
					</p>
				) : null}
			</div>

			<ConfirmAbortDialog
				open={abortDialogOpen}
				onOpenChange={setAbortDialogOpen}
				onConfirm={handleAbortConfirm}
				isPending={abort.isPending}
			/>
		</div>
	);
}
