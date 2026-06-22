import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import nock from 'nock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import LaunchDarklyApi from 'launchdarkly-api';
import { createLaunchDarklyProvider } from '../provider/launch-darkly-provider.js';
import { ApprovalRequiredError } from '../errors/ld-adapter-error.js';
import { SEMANTIC_PATCH_CONTENT_TYPE } from '../client/ld-api-client.js';

const baseUrl = 'https://app.launchdarkly.com';
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const flagFixture = JSON.parse(
	readFileSync(join(fixturesDir, 'flag-boolean.json'), 'utf8'),
);
const patchSuccessFixture = JSON.parse(
	readFileSync(join(fixturesDir, 'patch-canary-success.json'), 'utf8'),
);
const patch422Fixture = JSON.parse(
	readFileSync(join(fixturesDir, 'patch-422-invalid.json'), 'utf8'),
);
const patch429Fixture = JSON.parse(
	readFileSync(join(fixturesDir, 'patch-429-retry.json'), 'utf8'),
);

describe('LaunchDarklyProvider nock integration', () => {
	beforeEach(() => {
		nock.cleanAll();
		const apiClient = LaunchDarklyApi.ApiClient.instance;
		apiClient.basePath = baseUrl;
		apiClient.authentications.ApiKey.apiKey = 'test-token';
		apiClient.defaultHeaders['LD-API-Version'] = '20240415';
	});

	afterEach(() => {
		nock.cleanAll();
	});

	it('PROV-01: reads flag state from GET fixture', async () => {
		nock(baseUrl)
			.get('/api/v2/flags/default/sample-feature')
			.reply(200, flagFixture);

		const provider = createLaunchDarklyProvider({
			accessToken: 'test-token',
			baseUrl,
		});
		const state = await provider.getFlagState({
			projectKey: 'default',
			flagKey: 'sample-feature',
			environmentKey: 'production',
		});

		expect(state.variations).toHaveLength(2);
		expect(state.environments.production?.on).toBe(true);
		expect(nock.isDone()).toBe(true);
	});

	it('PROV-02/03: semantic patch with resolved variation ids', async () => {
		let patchBody: Record<string, unknown> | undefined;

		nock(baseUrl)
			.get('/api/v2/flags/default/sample-feature')
			.times(2)
			.reply(200, flagFixture);

		nock(baseUrl)
			.patch('/api/v2/flags/default/sample-feature', (body) => {
				patchBody = body as Record<string, unknown>;
				return true;
			})
			.reply(200, patchSuccessFixture);

		const provider = createLaunchDarklyProvider({
			accessToken: 'test-token',
			baseUrl,
		});

		await provider.applyTargeting({
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
		});

		const instructions = (patchBody?.instructions ?? []) as Array<{
			kind: string;
			rolloutWeights?: Record<string, number>;
		}>;
		expect(instructions.some((i) => i.kind === 'turnFlagOn')).toBe(true);
		const rollout = instructions.find(
			(i) => i.kind === 'updateFallthroughVariationOrRollout',
		);
		expect(rollout?.rolloutWeights).toEqual({
			'var-on': 10_000,
			'var-off': 90_000,
		});
		expect(
			Object.values(rollout?.rolloutWeights ?? {}).reduce((a, b) => a + b, 0),
		).toBe(100_000);
	});

	it('422 returns error with single PATCH attempt', async () => {
		nock(baseUrl)
			.get('/api/v2/flags/default/sample-feature')
			.reply(200, flagFixture);
		const patchScope = nock(baseUrl)
			.patch('/api/v2/flags/default/sample-feature')
			.once()
			.reply(422, patch422Fixture);

		const provider = createLaunchDarklyProvider({
			accessToken: 'test-token',
			baseUrl,
		});

		await expect(
			provider.applyTargeting({
				projectKey: 'default',
				flagKey: 'sample-feature',
				intent: {
					environmentKey: 'production',
					turnOn: true,
				},
			}),
		).rejects.toBeTruthy();
		expect(patchScope.isDone()).toBe(true);
	});

	it('429 then 200 retries successfully', async () => {
		nock(baseUrl)
			.get('/api/v2/flags/default/sample-feature')
			.times(2)
			.reply(200, flagFixture);

		nock(baseUrl)
			.patch('/api/v2/flags/default/sample-feature')
			.reply(429, patch429Fixture, { 'Retry-After': '0' })
			.patch('/api/v2/flags/default/sample-feature')
			.reply(200, patchSuccessFixture);

		const provider = createLaunchDarklyProvider({
			accessToken: 'test-token',
			baseUrl,
		});

		await expect(
			provider.applyTargeting({
				projectKey: 'default',
				flagKey: 'sample-feature',
				intent: { environmentKey: 'production', turnOn: true },
			}),
		).resolves.toBeDefined();
	});

	it('405 maps to ApprovalRequiredError', async () => {
		nock(baseUrl)
			.get('/api/v2/flags/default/sample-feature')
			.reply(200, flagFixture);
		nock(baseUrl)
			.patch('/api/v2/flags/default/sample-feature')
			.reply(405, { message: 'approval required' });

		const provider = createLaunchDarklyProvider({
			accessToken: 'test-token',
			baseUrl,
		});

		await expect(
			provider.applyTargeting({
				projectKey: 'default',
				flagKey: 'sample-feature',
				intent: { environmentKey: 'production', turnOn: true },
			}),
		).rejects.toBeInstanceOf(ApprovalRequiredError);
	});

	it('uses semantic patch content type on PATCH requests', async () => {
		nock(baseUrl)
			.get('/api/v2/flags/default/sample-feature')
			.times(2)
			.reply(200, flagFixture);

		nock(baseUrl)
			.patch('/api/v2/flags/default/sample-feature')
			.reply(function (_uri, _body) {
				expect(this.req.headers['content-type']).toContain(
					SEMANTIC_PATCH_CONTENT_TYPE.split(';')[0],
				);
				expect(this.req.headers['content-type']).toContain(
					'launchdarkly.semanticpatch',
				);
				return [200, patchSuccessFixture];
			});

		const provider = createLaunchDarklyProvider({
			accessToken: 'test-token',
			baseUrl,
		});
		await provider.applyTargeting({
			projectKey: 'default',
			flagKey: 'sample-feature',
			intent: { environmentKey: 'production', turnOn: true },
		});
	});
});
