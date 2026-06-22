import { afterEach, describe, expect, it } from 'vitest';
import LaunchDarklyApi from 'launchdarkly-api';
import {
	createLaunchDarklyClient,
	DEFAULT_LD_API_VERSION,
} from '../client/ld-api-client.js';

describe('createLaunchDarklyClient', () => {
	afterEach(() => {
		const apiClient = LaunchDarklyApi.ApiClient.instance;
		delete apiClient.defaultHeaders['LD-API-Version'];
		delete apiClient.defaultHeaders['Content-Type'];
	});

	it('sets LD-API-Version header and respects baseUrl override', () => {
		createLaunchDarklyClient({
			accessToken: 'test-token',
			baseUrl: 'https://app.eu.launchdarkly.com',
		});

		const apiClient = LaunchDarklyApi.ApiClient.instance;
		expect(apiClient.defaultHeaders['LD-API-Version']).toBe(
			DEFAULT_LD_API_VERSION,
		);
		expect(apiClient.basePath).toBe('https://app.eu.launchdarkly.com');
		expect(apiClient.authentications.ApiKey.apiKey).toBe('test-token');
	});
});
