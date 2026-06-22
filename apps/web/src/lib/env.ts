import { z } from 'zod';

const WebEnvSchema = z.object({
	API_URL: z.string().url().default('http://localhost:3000'),
	NEXT_PUBLIC_API_URL: z.string().default('/api/ff-promo'),
	API_KEY: z.string().optional(),
	NEXT_PUBLIC_DASHBOARD_ACTOR_ID: z.string().default('dashboard'),
});

export type WebEnv = z.infer<typeof WebEnvSchema>;

export function loadWebEnv(env: NodeJS.ProcessEnv = process.env): WebEnv {
	return WebEnvSchema.parse(env);
}
