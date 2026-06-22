import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promotionWorkflow } from '../workflows/promotion.workflow.js';
import {
  abortSignal,
  pauseSignal,
  resumeSignal,
  statusQuery,
} from '../workflows/signals.js';
import {
  createPrismaClient,
  PipelineRepository,
  PromotionRunRepository,
} from '@ff-promo/db';
import {
  getTestDatabaseUrl,
  startTestDatabase,
  stopTestDatabase,
} from '../../../../packages/db/src/__tests__/setup.js';
import { createMockActivities } from './helpers/mock-activities.js';

const require = createRequire(import.meta.url);
const workflowsPath = require.resolve('../workflows/promotion.workflow.ts');

const TASK_QUEUE = 'test-promotion-signals';

async function seedPromotionRun(stageCount = 3) {
  const dbUrl = getTestDatabaseUrl();
  if (!dbUrl) {
    throw new Error('Test database not started');
  }

  const db = createPrismaClient(dbUrl);
  const pipelineRepo = new PipelineRepository(db);
  const environments = ['dev', 'staging', 'prod'] as const;

  const pipeline = await pipelineRepo.create({
    name: `signals-test-${randomUUID()}`,
    flagKey: 'signals-test-flag',
    projectKey: 'default',
    stages: Array.from({ length: stageCount }, (_, orderIndex) => ({
      orderIndex,
      environment: environments[orderIndex] ?? 'dev',
      displayName: environments[orderIndex] ?? `Stage ${orderIndex}`,
      gatePolicies: [
        {
          metricType: 'error_rate',
          threshold: 0.01,
          serviceName: 'api',
        },
      ],
    })),
  });

  const runRepo = new PromotionRunRepository(db);
  const run = await runRepo.create({
    pipelineId: pipeline.id,
    flagKey: 'signals-test-flag',
  });

  await db.$disconnect();
  return run;
}

describe('promotionWorkflow signals', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    await startTestDatabase();
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  }, 120_000);

  afterAll(async () => {
    await testEnv?.teardown();
    await stopTestDatabase();
  });

  it('pause blocks until resume; statusQuery reflects isPaused', async () => {
    const run = await seedPromotionRun(3);
    const mockActivities = createMockActivities();

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath,
      activities: mockActivities,
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(promotionWorkflow, {
        workflowId: run.id,
        taskQueue: TASK_QUEUE,
        args: [
          {
            promotionRunId: run.id,
            stageCount: 3,
            actor: { actorType: 'system', actorId: 'test' },
          },
        ],
      });

      await handle.signal(pauseSignal);
      const pausedStatus = await handle.query(statusQuery);
      expect(pausedStatus.isPaused).toBe(true);
      expect(pausedStatus.status).toBe('paused');

      await handle.signal(resumeSignal);
      await handle.result();
    });

    const db = createPrismaClient(getTestDatabaseUrl()!);
    const updated = await db.promotionRun.findUnique({ where: { id: run.id } });
    expect(updated?.status).toBe('completed');

    const audit = await db.auditEvent.findMany({
      where: { promotionRunId: run.id },
    });
    expect(audit.some((e) => e.action === 'run_paused')).toBe(true);
    expect(audit.some((e) => e.action === 'run_resumed')).toBe(true);

    await db.$disconnect();
  });

  it('abort terminates workflow and persists aborted status with workflowId equal to run id', async () => {
    const run = await seedPromotionRun(3);
    const mockActivities = createMockActivities();

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath,
      activities: mockActivities,
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(promotionWorkflow, {
        workflowId: run.id,
        taskQueue: TASK_QUEUE,
        args: [
          {
            promotionRunId: run.id,
            stageCount: 50,
            actor: { actorType: 'system', actorId: 'test' },
          },
        ],
      });

      await handle.signal(abortSignal);
      await handle.result();
    });

    const db = createPrismaClient(getTestDatabaseUrl()!);
    const updated = await db.promotionRun.findUnique({ where: { id: run.id } });
    expect(updated?.status).toBe('aborted');
    expect(updated?.temporalWorkflowId).toBe(run.id);

    const audit = await db.auditEvent.findMany({
      where: { promotionRunId: run.id },
    });
    expect(audit.some((e) => e.action === 'run_aborted')).toBe(true);

    await db.$disconnect();
  });

  it('SAFE-02: abort during active stage processing stops without further advancement', async () => {
    const run = await seedPromotionRun(3);
    let applyStageTargetingCalls = 0;
    let currentStageAtAbort = 0;

    const mockActivities = createMockActivities({
      applyStageTargeting: async () => {
        applyStageTargetingCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 300));
        return {
          environmentKey: 'dev',
          treatmentVariationId: 'var-on',
          controlVariationId: 'var-off',
        };
      },
      evaluateGate: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return {
          verdict: 'pass' as const,
          gateResultIds: ['mock-gate-result-id'],
        };
      },
    });

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath,
      activities: mockActivities,
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(promotionWorkflow, {
        workflowId: run.id,
        taskQueue: TASK_QUEUE,
        args: [
          {
            promotionRunId: run.id,
            stageCount: 3,
            actor: { actorType: 'system', actorId: 'test' },
          },
        ],
      });

      await testEnv.sleep('400ms');
      const statusBeforeAbort = await handle.query(statusQuery);
      currentStageAtAbort = statusBeforeAbort.currentStageIndex;

      await handle.signal(abortSignal);
      await handle.result();
    });

    const db = createPrismaClient(getTestDatabaseUrl()!);
    const updated = await db.promotionRun.findUnique({ where: { id: run.id } });
    expect(updated?.status).toBe('aborted');
    expect(updated?.currentStageIndex).toBeLessThanOrEqual(currentStageAtAbort + 1);
    expect(applyStageTargetingCalls).toBeLessThanOrEqual(3);
    await db.$disconnect();
  });
});
