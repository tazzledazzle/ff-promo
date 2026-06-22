import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('health routes', () => {
	const env = {
		PORT: 3000,
		DATABASE_URL: 'postgresql://unused',
		TEMPORAL_ADDRESS: 'localhost:7233',
		TEMPORAL_TASK_QUEUE: 'promotion',
	};

	let app: Awaited<ReturnType<typeof buildApp>>;

	beforeAll(async () => {
		app = await buildApp({
			env,
			service: {
				createRun: async () => {
					throw new Error('not implemented');
				},
			} as never,
		});
	});

	afterAll(async () => {
		await app?.close();
	});

	it('GET /health returns ok', async () => {
		const response = await app.inject({ method: 'GET', url: '/health' });
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: 'ok' });
	});
});
