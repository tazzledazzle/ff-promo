import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promotionWorkflow } from '../workflows/promotion.workflow.js';
import { abortSignal } from '../workflows/signals.js';
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

const TASK_QUEUE = 'test-promotion-workflow';

async function seedPromotionRun(stageCount = 3) {
  const dbUrl = getTestDatabaseUrl();
  if (!dbUrl) {
    throw new Error('Test database not started');
  }

  const db = createPrismaClient(dbUrl);
  const pipelineRepo = new PipelineRepository(db);
  const environments = ['dev', 'staging', 'prod'] as const;

  const pipeline = await pipelineRepo.create({
    name: `workflow-test-${randomUUID()}`,
    flagKey: 'workflow-test-flag',
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
    flagKey: 'workflow-test-flag',
  });

  await db.$disconnect();
  return run;
}

describe('promotionWorkflow integration', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    await startTestDatabase();
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  }, 120_000);

  afterAll(async () => {
    await testEnv?.teardown();
    await stopTestDatabase();
  });

  it('completes all stages and persists completed run status', async () => {
    const run = await seedPromotionRun(3);
    const mockActivities = createMockActivities();

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath,
      activities: mockActivities,
    });

    await worker.runUntil(async () => {
      await testEnv.client.workflow.execute(promotionWorkflow, {
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
    });

    const db = createPrismaClient(getTestDatabaseUrl()!);
    const updated = await db.promotionRun.findUnique({ where: { id: run.id } });
    expect(updated?.status).toBe('completed');
    expect(updated?.currentStageIndex).toBe(3);
    expect(updated?.temporalWorkflowId).toBe(run.id);

    const audit = await db.auditEvent.findMany({
      where: { promotionRunId: run.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(audit.some((e) => e.action === 'run_started')).toBe(true);
    expect(audit.some((e) => e.action === 'run_completed')).toBe(true);
    expect(audit.filter((e) => e.action === 'stage_advanced')).toHaveLength(3);

    await db.$disconnect();
  });

  it('PIPE-04: gate fail pauses run with pauseReason', async () => {
    const run = await seedPromotionRun(1);
    const mockActivities = createMockActivities({
      evaluateGate: async () => ({
        verdict: 'fail' as const,
        gateResultIds: ['mock-fail-id'],
        pauseReason: 'threshold_exceeded',
      }),
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
            stageCount: 1,
            actor: { actorType: 'system', actorId: 'test' },
          },
        ],
      });

      await testEnv.sleep('1 second');

      const db = createPrismaClient(getTestDatabaseUrl()!);
      const paused = await db.promotionRun.findUnique({ where: { id: run.id } });
      expect(paused?.status).toBe('paused');
      expect(paused?.pauseReason).toBe('threshold_exceeded');
      expect(paused?.currentStageIndex).toBe(0);
      await db.$disconnect();

      await handle.signal(abortSignal);
      await handle.result();
    });
  });

  it('preflight fail aborts without advancing stage index', async () => {
    const run = await seedPromotionRun(3);
    const mockActivities = createMockActivities({
      runPreflight: async () => ({
        status: 'fail' as const,
        report: {
          status: 'fail' as const,
          checks: [],
          blockReason: 'preflight_failed',
        },
      }),
    });

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath,
      activities: mockActivities,
    });

    await worker.runUntil(async () => {
      await testEnv.client.workflow.execute(promotionWorkflow, {
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
    });

    const db = createPrismaClient(getTestDatabaseUrl()!);
    const updated = await db.promotionRun.findUnique({ where: { id: run.id } });
    expect(updated?.status).toBe('aborted');
    expect(updated?.currentStageIndex).toBe(0);
    await db.$disconnect();
  });

  it('D-17: abort before stage targeting prevents applyStageTargeting', async () => {
    const run = await seedPromotionRun(3);
    let applyStageTargetingCalls = 0;

    const mockActivities = createMockActivities({
      runPreflight: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return {
          status: 'pass' as const,
          report: { status: 'pass' as const, checks: [] },
        };
      },
      applyStageTargeting: async () => {
        applyStageTargetingCalls += 1;
        return {
          environmentKey: 'dev',
          treatmentVariationId: 'var-on',
          controlVariationId: 'var-off',
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

      await handle.signal(abortSignal);
      await handle.result();
    });

    expect(applyStageTargetingCalls).toBe(0);
  });
});
