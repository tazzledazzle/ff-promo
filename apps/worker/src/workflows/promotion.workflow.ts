import * as wf from '@temporalio/workflow';
import type * as activities from '../activities/index.js';
import {
  abortSignal,
  gateFailedSignal,
  gatePassedSignal,
  pauseSignal,
  resumeSignal,
  statusQuery,
} from './signals.js';

const { persistRunState, recordAuditEvent, evaluateGate } = wf.proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

export interface PromotionWorkflowInput {
  promotionRunId: string;
  stageCount: number;
  actor: {
    actorType: 'user' | 'system' | 'api_key';
    actorId: string;
    displayName?: string;
  };
}

export async function promotionWorkflow(
  input: PromotionWorkflowInput,
): Promise<void> {
  let currentStageIndex = 0;
  let status: 'active' | 'paused' | 'aborted' | 'completed' = 'active';
  let isPaused = false;
  let gateAwaiting = false;

  wf.setHandler(statusQuery, () => ({ status, currentStageIndex, isPaused }));

  wf.setHandler(pauseSignal, async () => {
    isPaused = true;
    status = 'paused';
    await persistRunState({
      promotionRunId: input.promotionRunId,
      status: 'paused',
    });
    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'run_paused',
      actorType: 'system',
      actorId: 'workflow',
    });
  });

  wf.setHandler(resumeSignal, async () => {
    isPaused = false;
    status = 'active';
    await persistRunState({
      promotionRunId: input.promotionRunId,
      status: 'active',
    });
    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'run_resumed',
      actorType: 'system',
      actorId: 'workflow',
    });
  });

  wf.setHandler(abortSignal, async () => {
    status = 'aborted';
    await persistRunState({
      promotionRunId: input.promotionRunId,
      status: 'aborted',
    });
    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'run_aborted',
      actorType: 'system',
      actorId: 'workflow',
    });
  });

  wf.setHandler(gatePassedSignal, () => {
    gateAwaiting = false;
  });

  wf.setHandler(gateFailedSignal, async ({ reason }) => {
    isPaused = true;
    status = 'paused';
    gateAwaiting = false;
    await persistRunState({
      promotionRunId: input.promotionRunId,
      status: 'paused',
      pauseReason: reason,
    });
  });

  await persistRunState({
    promotionRunId: input.promotionRunId,
    status: 'active',
  });
  await recordAuditEvent({
    promotionRunId: input.promotionRunId,
    action: 'run_started',
    actorType: input.actor.actorType,
    actorId: input.actor.actorId,
    displayName: input.actor.displayName,
  });

  while (currentStageIndex < input.stageCount && status !== 'aborted') {
    await wf.condition(() => !isPaused || status === 'aborted');
    if (status === 'aborted') {
      break;
    }

    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'stage_entered',
      actorType: 'system',
      actorId: 'workflow',
      metadata: { stageIndex: currentStageIndex },
    });

    const gateResult = await evaluateGate({
      promotionRunId: input.promotionRunId,
      stageIndex: currentStageIndex,
    });

    if (gateResult.verdict === 'fail') {
      isPaused = true;
      status = 'paused';
      await persistRunState({
        promotionRunId: input.promotionRunId,
        status: 'paused',
      });
      await wf.condition(() => !isPaused || status === 'aborted');
      if (status === 'aborted') {
        break;
      }
      continue;
    }

    const nextStageIndex = currentStageIndex + 1;
    await persistRunState({
      promotionRunId: input.promotionRunId,
      status: 'active',
      currentStageIndex: nextStageIndex,
    });
    currentStageIndex = nextStageIndex;

    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'stage_advanced',
      actorType: 'system',
      actorId: 'workflow',
      metadata: { stageIndex: currentStageIndex },
      gateResultId: gateResult.gateResultId,
    });
  }

  if (status !== 'aborted') {
    status = 'completed';
    await persistRunState({
      promotionRunId: input.promotionRunId,
      status: 'completed',
    });
    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'run_completed',
      actorType: 'system',
      actorId: 'workflow',
    });
  }
}
