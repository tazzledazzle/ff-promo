import { PrometheusClientConfigSchema } from '@ff-promo/contracts';
import type { PrometheusClientConfig } from '@ff-promo/contracts';
import pRetry from 'p-retry';
import { TelemetryApiError } from '../errors/telemetry-adapter-error.js';

export const DEFAULT_PROMETHEUS_BASE_URL = 'http://localhost:9090';

type PrometheusQueryEnvelope = {
	status: string;
	data?: {
		resultType: string;
		result: unknown;
	};
	error?: string;
	errorType?: string;
};

export type PrometheusInstantQueryData = {
	resultType: string;
	result: unknown;
};

export type PrometheusClient = {
	config: PrometheusClientConfig & { baseUrl: string };
	queryInstant: (
		query: string,
		opts?: { timeout?: string },
	) => Promise<PrometheusInstantQueryData>;
};

function assertHttpOrHttpsUrl(baseUrl: string): void {
	let parsed: URL;
	try {
		parsed = new URL(baseUrl);
	} catch {
		throw new TelemetryApiError('Invalid Prometheus baseUrl', 0, undefined, {
			baseUrl,
		});
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new TelemetryApiError(
			'Prometheus baseUrl must use http or https',
			0,
			undefined,
			{ baseUrl },
		);
	}
}

async function parseEnvelope(
	res: Response,
): Promise<PrometheusInstantQueryData> {
	let body: PrometheusQueryEnvelope;
	try {
		body = (await res.json()) as PrometheusQueryEnvelope;
	} catch {
		throw new TelemetryApiError(
			`Prometheus query failed (${res.status})`,
			res.status,
		);
	}
	if (!res.ok || body.status !== 'success' || !body.data) {
		throw new TelemetryApiError(
			body.error ?? `Prometheus query failed (${res.status})`,
			res.status,
			body,
			{ errorType: body.errorType },
		);
	}
	return body.data;
}

export function createPrometheusClient(
	configInput: PrometheusClientConfig,
): PrometheusClient {
	const config = PrometheusClientConfigSchema.parse(configInput);
	const baseUrl = (
		config.baseUrl ??
		process.env.PROMETHEUS_BASE_URL ??
		DEFAULT_PROMETHEUS_BASE_URL
	).replace(/\/+$/, '');
	const bearerToken = config.bearerToken ?? process.env.PROMETHEUS_BEARER_TOKEN;

	assertHttpOrHttpsUrl(baseUrl);

	return {
		config: { ...config, baseUrl },
		async queryInstant(query: string, opts?: { timeout?: string }) {
			const url = new URL('/api/v1/query', baseUrl);
			url.searchParams.set('query', query);
			if (opts?.timeout) {
				url.searchParams.set('timeout', opts.timeout);
			}
			if (config.timeout && !opts?.timeout) {
				url.searchParams.set('timeout', config.timeout);
			}

			const headers: Record<string, string> = {};
			if (bearerToken) {
				headers.Authorization = `Bearer ${bearerToken}`;
			}

			return pRetry(
				async () => {
					const res = await fetch(url, { headers });
					return parseEnvelope(res);
				},
				{
					retries: 2,
					shouldRetry: (error) => {
						if (error instanceof TelemetryApiError) {
							return error.status === 503;
						}
						return false;
					},
				},
			);
		},
	};
}
