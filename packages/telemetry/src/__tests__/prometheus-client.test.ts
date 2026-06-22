import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrometheusClient } from '../client/prometheus-client.js';
import { TelemetryApiError } from '../errors/telemetry-adapter-error.js';

describe('createPrometheusClient', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('normalizes trailing slashes from baseUrl', async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					status: 'success',
					data: { resultType: 'vector', result: [] },
				}),
				{ status: 200 },
			),
		);

		const client = createPrometheusClient({
			baseUrl: 'http://localhost:9090/',
		});
		await client.queryInstant('up');

		expect(client.config.baseUrl).toBe('http://localhost:9090');
		const calledUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
		expect(calledUrl.pathname).toBe('/api/v1/query');
		expect(calledUrl.searchParams.get('query')).toBe('up');
	});

	it('sends Authorization bearer header when token provided', async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					status: 'success',
					data: { resultType: 'vector', result: [] },
				}),
				{ status: 200 },
			),
		);

		const client = createPrometheusClient({
			baseUrl: 'http://localhost:9090',
			bearerToken: 'secret-token',
		});
		await client.queryInstant('up');

		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		expect(init.headers).toMatchObject({
			Authorization: 'Bearer secret-token',
		});
	});

	it('falls back to PROMETHEUS_BASE_URL env when baseUrl omitted', async () => {
		vi.stubEnv('PROMETHEUS_BASE_URL', 'http://prometheus:9090');
		const fetchMock = vi.mocked(fetch);
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					status: 'success',
					data: { resultType: 'vector', result: [] },
				}),
				{ status: 200 },
			),
		);

		const client = createPrometheusClient({});
		expect(client.config.baseUrl).toBe('http://prometheus:9090');
	});

	it('throws TelemetryApiError on status:error envelope', async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					status: 'error',
					errorType: 'bad_data',
					error: 'invalid query',
				}),
				{ status: 200 },
			),
		);

		const client = createPrometheusClient({
			baseUrl: 'http://localhost:9090',
		});

		await expect(client.queryInstant('bad{')).rejects.toMatchObject({
			message: 'invalid query',
		});
	});

	it('does not include bearer token in error context', async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock.mockResolvedValueOnce(
			new Response('unauthorized', { status: 401 }),
		);

		const client = createPrometheusClient({
			baseUrl: 'http://localhost:9090',
			bearerToken: 'secret-token',
		});

		try {
			await client.queryInstant('up');
		} catch (error) {
			expect(error).toBeInstanceOf(TelemetryApiError);
			expect(JSON.stringify(error)).not.toContain('secret-token');
		}
	});
});
