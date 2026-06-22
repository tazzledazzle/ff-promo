import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as activities from '../activities/index.js';
import { promotionWorkflow } from '../workflows/promotion.workflow.js';
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
  const environments = ['dev', 'staging', 'prod'];

  const pipeline = await pipelineRepo.create({
    name: `workflow-test-${randomUUID()}`,
    flagKey: 'workflow-test-flag',
    projectKey: 'default',
    stages: Array.from({ length: stageCount }, (_, orderIndex) => ({
      orderIndex,
      environment: environments[orderIndex] ?? `env-${orderIndex}`,
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

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath,
      activities,
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
});
