import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api-client';
import { ApiClientError } from '@/lib/api-errors';

describe('api-client', () => {
	it('calls listPromotionRuns with correct path', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ runs: [] }),
		});
		vi.stubGlobal('fetch', fetchMock);

		const client = createApiClient({ baseUrl: '/api/ff-promo' });
		await client.listPromotionRuns();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/ff-promo/v1/promotion-runs',
			expect.objectContaining({
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
				}),
			}),
		);
	});

	it('throws ApiClientError on 401', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				json: async () => ({ error: 'unauthorized', message: 'Invalid API key' }),
			}),
		);

		const client = createApiClient({ baseUrl: '/api/ff-promo' });
		await expect(client.listPromotionRuns()).rejects.toBeInstanceOf(ApiClientError);
	});
});
