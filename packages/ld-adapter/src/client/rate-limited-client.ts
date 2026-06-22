import pRetry from 'p-retry';
import Bottleneck from 'bottleneck';
import {
	ApprovalRequiredError,
	LdRateLimitError,
} from '../errors/ld-adapter-error.js';
import type { LaunchDarklyRawClient } from './ld-api-client.js';

type HttpLikeError = {
	status?: number;
	response?: {
		header?: Record<string, string | string[] | undefined>;
		body?: unknown;
	};
};

export type RateLimitedLdClient = {
	schedule<T>(fn: () => Promise<T>): Promise<T>;
	rawClient: LaunchDarklyRawClient;
};

export type RateLimitedLdClientOptions = {
	maxConcurrent?: number;
	minTime?: number;
	retries?: number;
	sleep?: (ms: number) => Promise<void>;
	jitterMs?: number;
};

function extractStatus(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') {
		return undefined;
	}
	const status = (error as HttpLikeError).status;
	return typeof status === 'number' ? status : undefined;
}

function headerValue(
	headers: Record<string, string | string[] | undefined> | undefined,
	name: string,
): string | undefined {
	if (!headers) {
		return undefined;
	}
	const value = headers[name] ?? headers[name.toLowerCase()];
	if (Array.isArray(value)) {
		return value[0];
	}
	return value;
}

export function computeRetryDelayMs(
	error: unknown,
	jitterMs = 500,
): number {
	const response = (error as HttpLikeError).response;
	const retryAfter = headerValue(response?.header, 'retry-after');
	if (retryAfter) {
		const seconds = Number.parseInt(retryAfter, 10);
		if (!Number.isNaN(seconds)) {
			return seconds * 1000 + Math.floor(Math.random() * jitterMs);
		}
	}

	const reset = headerValue(response?.header, 'x-ratelimit-reset');
	if (reset) {
		const resetMs = Number.parseInt(reset, 10);
		if (!Number.isNaN(resetMs)) {
			return Math.max(0, resetMs - Date.now()) + Math.floor(Math.random() * jitterMs);
		}
	}

	return 1000 + Math.floor(Math.random() * jitterMs);
}

export function mapHttpError(error: unknown, environmentKey?: string): Error {
	const status = extractStatus(error);
	if (status === 405) {
		return new ApprovalRequiredError(
			'LaunchDarkly environment requires approval before changes',
			environmentKey,
			{ status },
		);
	}
	if (status === 429) {
		return new LdRateLimitError(
			'LaunchDarkly rate limit exceeded',
			computeRetryDelayMs(error),
			{ status },
		);
	}
	return error instanceof Error ? error : new Error(String(error));
}

function normalizeThrownError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}
	if (error && typeof error === 'object' && 'status' in error) {
		const status = Number((error as HttpLikeError).status);
		const message =
			'message' in error && typeof (error as { message: unknown }).message === 'string'
				? (error as { message: string }).message
				: `HTTP ${status}`;
		const wrapped = new Error(message) as Error & HttpLikeError;
		wrapped.status = status;
		if ('response' in error) {
			wrapped.response = (error as HttpLikeError).response;
		}
		return wrapped;
	}
	return new Error(String(error));
}

function shouldRetry(error: unknown): boolean {
	const status = extractStatus(error);
	if (status === 405 || status === 422) {
		return false;
	}
	if (status === 429) {
		return true;
	}
	return status !== undefined && status >= 500;
}

export function createRateLimitedLdClient(
	rawClient: LaunchDarklyRawClient,
	opts: RateLimitedLdClientOptions = {},
): RateLimitedLdClient {
	const limiter = new Bottleneck({
		maxConcurrent: opts.maxConcurrent ?? 2,
		minTime: opts.minTime ?? 0,
	});
	const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
	const retries = opts.retries ?? 4;
	const jitterMs = opts.jitterMs ?? 500;

	async function schedule<T>(fn: () => Promise<T>): Promise<T> {
		return limiter.schedule(async () => {
			try {
				return await pRetry(
					async () => {
						try {
							return await fn();
						} catch (error) {
							throw normalizeThrownError(error);
						}
					},
					{
					retries,
					onFailedAttempt: async (failedAttempt) => {
						const error = failedAttempt.error;
						if (!shouldRetry(error)) {
							throw mapHttpError(error);
						}
						if (failedAttempt.attemptNumber <= retries) {
							const delay = computeRetryDelayMs(error, jitterMs);
							await sleep(delay);
						}
					},
					},
				);
			} catch (error) {
				if (extractStatus(error) === 429) {
					throw new LdRateLimitError(
						'LaunchDarkly rate limit retries exhausted',
						computeRetryDelayMs(error, jitterMs),
						{ status: 429 },
					);
				}
				throw error;
			}
		});
	}

	return { schedule, rawClient };
}
