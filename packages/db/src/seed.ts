import { createPrismaClient } from './client.js';

const PIPELINE_NAME = 'default-promotion';
const PIPELINE_VERSION = 1;
const FLAG_KEY = 'demo-feature-flag';
const PROJECT_KEY = 'default';

const STAGES = [
  { orderIndex: 0, environment: 'dev', displayName: 'Development' },
  { orderIndex: 1, environment: 'staging', displayName: 'Staging' },
  { orderIndex: 2, environment: 'prod', displayName: 'Production' },
] as const;

const GATE_POLICIES = [
  {
    metricType: 'error_rate',
    threshold: 0.01,
    serviceName: 'demo-service',
    windowSeconds: 300,
  },
  {
    metricType: 'latency_p95',
    threshold: 500,
    serviceName: 'demo-service',
    windowSeconds: 300,
  },
] as const;

export async function seed(connectionString?: string): Promise<void> {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is required. Set it in .env or pass a connection string to seed().',
    );
  }

  const db = createPrismaClient(url);

  try {
    let pipeline = await db.pipeline.findUnique({
      where: {
        name_version: { name: PIPELINE_NAME, version: PIPELINE_VERSION },
      },
    });

    if (!pipeline) {
      pipeline = await db.pipeline.create({
        data: {
          name: PIPELINE_NAME,
          version: PIPELINE_VERSION,
          flagKey: FLAG_KEY,
          projectKey: PROJECT_KEY,
          stages: {
            create: STAGES.map((stage) => ({
              orderIndex: stage.orderIndex,
              environment: stage.environment,
              displayName: stage.displayName,
              gatePolicies: {
                create: GATE_POLICIES.map((policy) => ({
                  metricType: policy.metricType,
                  threshold: policy.threshold,
                  serviceName: policy.serviceName,
                  windowSeconds: policy.windowSeconds,
                })),
              },
            })),
          },
        },
      });
    }

    const pendingRun = await db.promotionRun.findFirst({
      where: { pipelineId: pipeline.id, status: 'pending' },
    });

    if (!pendingRun) {
      await db.promotionRun.create({
        data: {
          pipelineId: pipeline.id,
          flagKey: pipeline.flagKey,
          pipelineVersion: pipeline.version,
          status: 'pending',
        },
      });
    }
  } finally {
    await db.$disconnect();
  }
}
