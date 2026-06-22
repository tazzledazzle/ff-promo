import { seed } from '../src/seed.js';

seed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
