import { createLaunchDarklyProvider } from '@ff-promo/ld-adapter';
import { createPrometheusClient } from '@ff-promo/telemetry';

export function createWorkerLdProvider() {
	const accessToken = process.env.LD_ACCESS_TOKEN;
	if (!accessToken) {
		throw new Error('LD_ACCESS_TOKEN is required for LaunchDarkly activities');
	}
	return createLaunchDarklyProvider({
		accessToken,
		baseUrl: process.env.LD_BASE_URL,
		apiVersion: process.env.LD_API_VERSION,
	});
}

export function createWorkerPrometheusClient() {
	return createPrometheusClient({
		baseUrl: process.env.PROMETHEUS_BASE_URL,
		bearerToken: process.env.PROMETHEUS_BEARER_TOKEN,
	});
}
