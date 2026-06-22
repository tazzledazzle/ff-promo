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

const {
  persistRunState,
  recordAuditEvent,
  evaluateGate,
  runPreflight,
  applyStageTargeting,
} = wf.proxyActivities<typeof activities>({
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
  type RunStatus = 'active' | 'paused' | 'aborted' | 'completed';
  let currentStageIndex = 0;
  let status: RunStatus = 'active';
  let isPaused = false;
  let gateAwaiting = false;

  const hasAborted = (): boolean => status === 'aborted';

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

  const preflight = await runPreflight({
    promotionRunId: input.promotionRunId,
  });
  if (preflight.status === 'fail') {
    status = 'aborted';
    await persistRunState({
      promotionRunId: input.promotionRunId,
      status: 'aborted',
    });
    return;
  }

  while (currentStageIndex < input.stageCount) {
    if (hasAborted()) {
      break;
    }

    await wf.condition(() => !isPaused || hasAborted());
    if (hasAborted()) {
      break;
    }

    await recordAuditEvent({
      promotionRunId: input.promotionRunId,
      action: 'stage_entered',
      actorType: 'system',
      actorId: 'workflow',
      metadata: { stageIndex: currentStageIndex },
    });

    if (hasAborted()) {
      break;
    }

    const targeting = await applyStageTargeting({
      promotionRunId: input.promotionRunId,
      stageIndex: currentStageIndex,
    });

    if (hasAborted()) {
      break;
    }

    const gateResult = await evaluateGate({
      promotionRunId: input.promotionRunId,
      stageIndex: currentStageIndex,
      treatmentVariationId: targeting.treatmentVariationId,
      controlVariationId: targeting.controlVariationId,
    });

    if (gateResult.verdict === 'fail') {
      isPaused = true;
      status = 'paused';
      await persistRunState({
        promotionRunId: input.promotionRunId,
        status: 'paused',
        pauseReason: gateResult.pauseReason,
      });
      await wf.condition(() => !isPaused || hasAborted());
      if (hasAborted()) {
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
      gateResultId: gateResult.gateResultIds[0],
    });
  }

  if (!hasAborted()) {
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
