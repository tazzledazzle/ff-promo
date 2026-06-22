declare module 'launchdarkly-api' {
	const LaunchDarklyApi: {
		ApiClient: {
			instance: {
				basePath: string;
				authentications: Record<string, { apiKey: string }>;
				defaultHeaders: Record<string, string>;
			};
		};
		FeatureFlagsApi: new (
			apiClient?: unknown,
		) => {
			getFeatureFlag: (
				projectKey: string,
				featureFlagKey: string,
				opts: Record<string, unknown>,
				callback: (error: unknown, data: unknown) => void,
			) => void;
			patchFeatureFlag: (
				projectKey: string,
				featureFlagKey: string,
				patchWithComment: Record<string, unknown>,
				opts: Record<string, unknown>,
				callback: (error: unknown, data: unknown) => void,
			) => void;
			apiClient: {
				defaultHeaders: Record<string, string>;
			};
		};
	};
	export default LaunchDarklyApi;
}
