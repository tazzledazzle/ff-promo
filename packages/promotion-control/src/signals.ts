import * as wf from '@temporalio/workflow';

export const pauseSignal = wf.defineSignal('pause');
export const resumeSignal = wf.defineSignal('resume');
export const abortSignal = wf.defineSignal('abort');
export const gatePassedSignal = wf.defineSignal<
	[{ stageIndex: number }]
>('gatePassed');
export const gateFailedSignal = wf.defineSignal<
	[{ stageIndex: number; reason: string }]
>('gateFailed');

export const statusQuery = wf.defineQuery<{
	status: string;
	currentStageIndex: number;
	isPaused: boolean;
}>('status');

export const PROMOTION_WORKFLOW_TYPE = 'promotionWorkflow';
