import { LaunchDarklyClientConfigSchema } from '@ff-promo/contracts';
import type { LaunchDarklyClientConfig } from '@ff-promo/contracts';
import LaunchDarklyApi from 'launchdarkly-api';

export const SEMANTIC_PATCH_CONTENT_TYPE =
	'application/json; domain-model=launchdarkly.semanticpatch';

export const DEFAULT_LD_BASE_URL = 'https://app.launchdarkly.com';
export const DEFAULT_LD_API_VERSION = '20240415';

export type LaunchDarklyRawClient = {
	flagsApi: InstanceType<typeof LaunchDarklyApi.FeatureFlagsApi>;
	config: LaunchDarklyClientConfig & {
		baseUrl: string;
		apiVersion: string;
	};
};

export function createLaunchDarklyClient(
	configInput: LaunchDarklyClientConfig,
): LaunchDarklyRawClient {
	const config = LaunchDarklyClientConfigSchema.parse(configInput);
	const baseUrl = config.baseUrl ?? process.env.LD_BASE_URL ?? DEFAULT_LD_BASE_URL;
	const apiVersion = config.apiVersion ?? DEFAULT_LD_API_VERSION;

	const apiClient = LaunchDarklyApi.ApiClient.instance;
	apiClient.basePath = baseUrl.replace(/\/+$/, '');
	apiClient.authentications.ApiKey!.apiKey = config.accessToken;
	apiClient.defaultHeaders['LD-API-Version'] = apiVersion;

	const flagsApi = new LaunchDarklyApi.FeatureFlagsApi(apiClient);

	return {
		flagsApi,
		config: { ...config, baseUrl: apiClient.basePath, apiVersion },
	};
}
