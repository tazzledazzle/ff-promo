import { createRequire } from 'node:module';
import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities/index.js';

const require = createRequire(import.meta.url);
const workflowsPath = require.resolve('./workflows/promotion.workflow.ts');

async function run(): Promise<void> {
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'promotion';
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    taskQueue,
    workflowsPath,
    activities,
  });

  console.log(`ff-promo worker started on task queue "${taskQueue}" (${address})`);

  const shutdown = async () => {
    console.log('Shutting down worker...');
    worker.shutdown();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
