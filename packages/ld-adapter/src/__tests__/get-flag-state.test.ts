import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { getFlagState } from '../read/get-flag-state.js';
import { LdApiError } from '../errors/ld-adapter-error.js';
import type { LaunchDarklyRawClient } from '../client/ld-api-client.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function mockClient(fixtureName: string): LaunchDarklyRawClient {
	const fixture = JSON.parse(
		readFileSync(join(fixturesDir, fixtureName), 'utf8'),
	);
	return {
		flagsApi: {
			getFeatureFlag: vi.fn((_project, _flag, _opts, callback) => {
				callback(null, fixture);
			}),
		},
		config: {
			accessToken: 'test',
			baseUrl: 'https://app.launchdarkly.com',
			apiVersion: '20240415',
		},
	} as unknown as LaunchDarklyRawClient;
}

describe('getFlagState', () => {
	it('calls getFeatureFlag and returns FlagState-valid object', async () => {
		const client = mockClient('flag-boolean.json');
		const flagState = await getFlagState(
			{ client },
			{
				projectKey: 'default',
				flagKey: 'sample-feature',
				environmentKey: 'production',
			},
		);

		expect(flagState.flagKey).toBe('sample-feature');
		expect(flagState.environments.production?.on).toBe(true);
		expect(client.flagsApi.getFeatureFlag).toHaveBeenCalledOnce();
	});

	it('throws when environment key is missing from LD response', async () => {
		const client = mockClient('flag-boolean.json');
		await expect(
			getFlagState(
				{ client },
				{
					projectKey: 'default',
					flagKey: 'sample-feature',
					environmentKey: 'missing-env',
				},
			),
		).rejects.toBeInstanceOf(LdApiError);
	});
});
