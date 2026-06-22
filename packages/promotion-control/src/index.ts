export { startPromotionRun } from './start-promotion-run.js';
export type { StartPromotionRunInput } from './start-promotion-run.js';
export {
	signalPromotionRun,
	queryPromotionStatus,
	resolveWorkflowId,
} from './signal-promotion-run.js';
export type { PromotionControlAction } from './signal-promotion-run.js';
export {
	pauseSignal,
	resumeSignal,
	abortSignal,
	gatePassedSignal,
	gateFailedSignal,
	statusQuery,
	PROMOTION_WORKFLOW_TYPE,
} from './signals.js';
