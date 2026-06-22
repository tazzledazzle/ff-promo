import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('swagger routes', () => {
	let app: Awaited<ReturnType<typeof buildApp>>;

	beforeAll(async () => {
		app = await buildApp({
			env: {
				PORT: 3000,
				DATABASE_URL: 'postgresql://unused',
				TEMPORAL_ADDRESS: 'localhost:7233',
				TEMPORAL_TASK_QUEUE: 'promotion',
			},
			service: {} as never,
		});
	});

	afterAll(async () => {
		await app?.close();
	});

	it('serves OpenAPI JSON', async () => {
		const response = await app.inject({
			method: 'GET',
			url: '/documentation/json',
		});
		expect(response.statusCode).toBe(200);
		expect(response.json().openapi).toBeTruthy();
	});
});
