import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import nock from 'nock';

export const PROMETHEUS_BASE_URL = 'http://localhost:9090';
const telemetryFixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../../packages/telemetry/src/__tests__/fixtures',
);

function loadTelemetryFixture(name: string) {
	return JSON.parse(readFileSync(join(telemetryFixturesDir, name), 'utf8'));
}

export function setupPrometheusNockEnv() {
	process.env.PROMETHEUS_BASE_URL = PROMETHEUS_BASE_URL;
}

function promqlFromUri(uri: string): string {
	const url = new URL(uri, PROMETHEUS_BASE_URL);
	return url.searchParams.get('query') ?? '';
}

export type GateRunContextIds = {
	treatmentVariationId: string;
	controlVariationId: string;
};

function replyForQuery(
	promql: string,
	ids: GateRunContextIds,
	scenario: 'pass' | 'fail_threshold' | 'fail_empty',
) {
	const { treatmentVariationId, controlVariationId } = ids;

	if (scenario === 'fail_empty') {
		return loadTelemetryFixture('prometheus-vector-empty.json');
	}

	if (promql.includes(treatmentVariationId) && promql.includes('increase(')) {
		return loadTelemetryFixture('prometheus-sample-count-high.json');
	}
	if (promql.includes(controlVariationId) && promql.includes('increase(')) {
		return loadTelemetryFixture('prometheus-sample-count-high.json');
	}
	if (
		promql.includes(treatmentVariationId) &&
		promql.includes('histogram_quantile')
	) {
		if (scenario === 'fail_threshold') {
			return {
				resultType: 'vector',
				result: [{ metric: {}, value: [0, '1000'] }],
			};
		}
		return loadTelemetryFixture('prometheus-treatment-latency.json');
	}
	if (
		promql.includes(controlVariationId) &&
		promql.includes('histogram_quantile')
	) {
		return loadTelemetryFixture('prometheus-control-latency.json');
	}
	if (
		promql.includes(treatmentVariationId) &&
		promql.includes('status=~"5.."')
	) {
		if (scenario === 'fail_threshold') {
			return loadTelemetryFixture('prometheus-treatment-error-rate-fail.json');
		}
		return loadTelemetryFixture('prometheus-treatment-error-rate.json');
	}
	if (
		promql.includes(controlVariationId) &&
		promql.includes('status=~"5.."')
	) {
		return loadTelemetryFixture('prometheus-control-error-rate.json');
	}
	if (promql.includes(treatmentVariationId)) {
		return loadTelemetryFixture('prometheus-treatment-error-rate.json');
	}
	if (promql.includes(controlVariationId)) {
		return loadTelemetryFixture('prometheus-control-error-rate.json');
	}
	return loadTelemetryFixture('prometheus-vector-empty.json');
}

export function nockPrometheusPass(
	times: number,
	ids: GateRunContextIds = {
		treatmentVariationId: 'var-on',
		controlVariationId: 'var-off',
	},
) {
	return nock(PROMETHEUS_BASE_URL)
		.get('/api/v1/query')
		.query(true)
		.times(times)
		.reply(200, (uri) => ({
			status: 'success',
			data: replyForQuery(promqlFromUri(uri), ids, 'pass'),
		}));
}

export function nockPrometheusPreflightPass(
	ids: GateRunContextIds = {
		treatmentVariationId: 'var-on',
		controlVariationId: 'var-off',
	},
) {
	return nock(PROMETHEUS_BASE_URL)
		.get('/api/v1/query')
		.query(true)
		.times(2)
		.reply(200, {
			status: 'success',
			data: loadTelemetryFixture('prometheus-sample-count-high.json'),
		});
}

export function nockPrometheusPreflightFail() {
	return nock(PROMETHEUS_BASE_URL)
		.get('/api/v1/query')
		.query(true)
		.times(2)
		.reply(200, {
			status: 'success',
			data: loadTelemetryFixture('prometheus-vector-empty.json'),
		});
}

export function nockPrometheusGateFail(
	times: number,
	ids: GateRunContextIds = {
		treatmentVariationId: 'var-on',
		controlVariationId: 'var-off',
	},
) {
	return nock(PROMETHEUS_BASE_URL)
		.get('/api/v1/query')
		.query(true)
		.times(times)
		.reply(200, (uri) => {
			const promql = promqlFromUri(uri);
			if (
				promql.includes(ids.treatmentVariationId) &&
				promql.includes('status=~"5.."')
			) {
				return {
					status: 'success',
					data: loadTelemetryFixture('prometheus-treatment-error-rate-fail.json'),
				};
			}
			return {
				status: 'success',
				data: replyForQuery(promql, ids, 'pass'),
			};
		});
}
