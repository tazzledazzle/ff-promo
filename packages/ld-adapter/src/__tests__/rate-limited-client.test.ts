import { describe, expect, it, vi } from 'vitest';
import {
	ApprovalRequiredError,
	LdRateLimitError,
} from '../errors/ld-adapter-error.js';
import {
	computeRetryDelayMs,
	createRateLimitedLdClient,
} from '../client/rate-limited-client.js';
import type { LaunchDarklyRawClient } from '../client/ld-api-client.js';

const rawClient = {
	flagsApi: {},
	config: {
		accessToken: 'test',
		baseUrl: 'https://app.launchdarkly.com',
		apiVersion: '20240415',
	},
} as LaunchDarklyRawClient;

describe('createRateLimitedLdClient', () => {
	it('passes successful calls through without retry', async () => {
		const client = createRateLimitedLdClient(rawClient);
		const fn = vi.fn().mockResolvedValue('ok');
		await expect(client.schedule(fn)).resolves.toBe('ok');
		expect(fn).toHaveBeenCalledOnce();
	});

	it('retries 429 honoring Retry-After header', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		const client = createRateLimitedLdClient(rawClient, {
			sleep,
			retries: 2,
			jitterMs: 0,
		});
		const fn = vi
			.fn()
			.mockRejectedValueOnce({
				status: 429,
				response: { header: { 'retry-after': '1' } },
			})
			.mockResolvedValueOnce('ok');

		await expect(client.schedule(fn)).resolves.toBe('ok');
		expect(fn).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalled();
		expect(computeRetryDelayMs({ status: 429, response: { header: { 'retry-after': '1' } } }, 0)).toBe(1000);
	});

	it('does not retry 422 fail-fast errors', async () => {
		const client = createRateLimitedLdClient(rawClient);
		const fn = vi.fn().mockRejectedValue({ status: 422, message: 'invalid' });
		await expect(client.schedule(fn)).rejects.toMatchObject({ status: 422 });
		expect(fn).toHaveBeenCalledOnce();
	});

	it('maps 405 to ApprovalRequiredError', async () => {
		const client = createRateLimitedLdClient(rawClient);
		const fn = vi.fn().mockRejectedValue({ status: 405 });
		await expect(client.schedule(fn)).rejects.toBeInstanceOf(
			ApprovalRequiredError,
		);
	});

	it('throws LdRateLimitError after retries exhausted on 429', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		const client = createRateLimitedLdClient(rawClient, {
			sleep,
			retries: 1,
			jitterMs: 0,
		});
		const fn = vi.fn().mockRejectedValue({
			status: 429,
			response: { header: { 'retry-after': '1' } },
		});
		await expect(client.schedule(fn)).rejects.toBeInstanceOf(LdRateLimitError);
	});
});
