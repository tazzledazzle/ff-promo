import { z } from 'zod';

const EnvSchema = z.object({
	PORT: z.coerce.number().int().positive().default(3000),
	DATABASE_URL: z.string().min(1),
	TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
	TEMPORAL_TASK_QUEUE: z.string().default('promotion'),
	API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): Env {
	return EnvSchema.parse(env);
}
