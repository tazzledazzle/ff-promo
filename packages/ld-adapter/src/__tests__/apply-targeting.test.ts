import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTargeting } from '../write/apply-targeting.js';
import { SEMANTIC_PATCH_CONTENT_TYPE } from '../client/ld-api-client.js';
import { UnresolvedVariationError } from '../errors/ld-adapter-error.js';
import type { LaunchDarklyRawClient } from '../client/ld-api-client.js';
import LaunchDarklyApi from 'launchdarkly-api';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const flagFixture = JSON.parse(
	readFileSync(join(fixturesDir, 'flag-boolean.json'), 'utf8'),
);

function createMockStack() {
	const getFeatureFlag = vi.fn((_project, _flag, _opts, callback) => {
		callback(null, flagFixture);
	});
	const fetchMock = vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		json: async () => flagFixture,
		headers: { entries: () => [][Symbol.iterator]() },
	});

	const rawClient = {
		flagsApi: {
			getFeatureFlag,
			apiClient: LaunchDarklyApi.ApiClient.instance,
		},
		config: {
			accessToken: 'test-token',
			baseUrl: 'https://app.launchdarkly.com',
			apiVersion: '20240415',
		},
	} as unknown as LaunchDarklyRawClient;

	const scheduleSpy = vi.fn(async <T>(fn: () => Promise<T>) => fn());
	const rateLimitedClient = {
		schedule: scheduleSpy,
		rawClient,
	};

	vi.stubGlobal('fetch', fetchMock);

	return { rawClient, rateLimitedClient, getFeatureFlag, fetchMock, scheduleSpy };
}

describe('applyTargeting', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('GET-before-write: getFeatureFlag before fetch PATCH', async () => {
		const { rateLimitedClient, getFeatureFlag, fetchMock } = createMockStack();
		const callOrder: string[] = [];
		getFeatureFlag.mockImplementation((_p, _f, _o, cb) => {
			callOrder.push('get');
			cb(null, flagFixture);
		});
		fetchMock.mockImplementation(async () => {
			callOrder.push('patch');
			return {
				ok: true,
				status: 200,
				json: async () => flagFixture,
				headers: { entries: () => [][Symbol.iterator]() },
			};
		});

		await applyTargeting(
			{ rateLimitedClient },
			{
				projectKey: 'default',
				flagKey: 'sample-feature',
				intent: {
					environmentKey: 'production',
					rollout: {
						mode: 'fallthrough',
						treatmentVariationRef: { by: 'value', value: true },
						controlVariationRef: { by: 'value', value: false },
						treatmentPercentThousandths: 10_000,
						rolloutContextKind: 'user',
						rolloutBucketBy: 'user',
					},
				},
			},
		);

		expect(callOrder[0]).toBe('get');
		expect(callOrder).toContain('patch');
		expect(getFeatureFlag.mock.invocationCallOrder[0]).toBeLessThan(
			fetchMock.mock.invocationCallOrder[0],
		);
	});

	it('routes GET and PATCH through rateLimitedClient.schedule', async () => {
		const { rateLimitedClient, scheduleSpy } = createMockStack();
		await applyTargeting(
			{ rateLimitedClient },
			{
				projectKey: 'default',
				flagKey: 'sample-feature',
				intent: { environmentKey: 'production', turnOn: true },
			},
		);
		expect(scheduleSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	it('sets semantic patch Content-Type on fetch PATCH', async () => {
		const { rateLimitedClient, fetchMock } = createMockStack();
		await applyTargeting(
			{ rateLimitedClient },
			{
				projectKey: 'default',
				flagKey: 'sample-feature',
				intent: { environmentKey: 'production', turnOn: true },
			},
		);
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		expect(init.headers).toMatchObject({
			'Content-Type': SEMANTIC_PATCH_CONTENT_TYPE,
		});
	});

	it('throws UnresolvedVariationError before patch when ref cannot resolve', async () => {
		const { rateLimitedClient, fetchMock } = createMockStack();
		await expect(
			applyTargeting(
				{ rateLimitedClient },
				{
					projectKey: 'default',
					flagKey: 'sample-feature',
					intent: {
						environmentKey: 'production',
						rollout: {
							mode: 'fallthrough',
							treatmentVariationRef: { by: 'value', value: 'missing' },
							controlVariationRef: { by: 'value', value: false },
							treatmentPercentThousandths: 10_000,
							rolloutContextKind: 'user',
							rolloutBucketBy: 'user',
						},
					},
				},
			),
		).rejects.toBeInstanceOf(UnresolvedVariationError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('uses resolveRuleId when rollout.mode is rule', async () => {
		const { rateLimitedClient, fetchMock } = createMockStack();
		await applyTargeting(
			{ rateLimitedClient },
			{
				projectKey: 'default',
				flagKey: 'sample-feature',
				intent: {
					environmentKey: 'production',
					rollout: {
						mode: 'rule',
						ruleRef: { by: 'id', id: 'rule-prod-1' },
						treatmentVariationRef: { by: 'value', value: true },
						controlVariationRef: { by: 'value', value: false },
						treatmentPercentThousandths: 10_000,
						rolloutContextKind: 'user',
						rolloutBucketBy: 'user',
					},
				},
			},
		);

		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const patchBody = JSON.parse(String(init.body)) as {
			instructions: Array<{ kind: string; ruleId?: string }>;
		};
		const ruleInstruction = patchBody.instructions.find(
			(i) => i.kind === 'updateRuleVariationOrRollout',
		);
		expect(ruleInstruction?.ruleId).toBe('rule-prod-1');
	});
});
