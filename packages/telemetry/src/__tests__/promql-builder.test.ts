import { describe, expect, it } from 'vitest';
import {
	buildErrorRateQuery,
	buildLatencyP95Query,
	buildMetricQuery,
	buildSampleCountQuery,
	escapePromqlLabelValue,
} from '../query/build-promql.js';
import { UnsupportedMetricTypeError } from '../errors/telemetry-adapter-error.js';

const policy = {
	metricType: 'error_rate',
	threshold: 0.01,
	serviceName: 'demo-service',
	windowSeconds: 300,
};

const runContext = {
	flagKey: 'demo-feature-flag',
	treatmentVariationId: 'treatment-var',
	controlVariationId: 'control-var',
};

describe('build-promql', () => {
	it('escapes quotes and backslashes in label values', () => {
		expect(escapePromqlLabelValue('a"b\\c')).toBe('a\\"b\\\\c');
	});

	it('builds error rate query with user context and window', () => {
		const query = buildErrorRateQuery(policy, runContext, 'treatment');
		expect(query).toContain('ld_context_kind="user"');
		expect(query).toContain('ld_variation_id="treatment-var"');
		expect(query).toContain('[300s]');
		expect(query).toContain('status=~"5.."');
	});

	it('builds latency p95 query in milliseconds', () => {
		const latencyPolicy = { ...policy, metricType: 'latency_p95' };
		const query = buildLatencyP95Query(latencyPolicy, runContext, 'control');
		expect(query).toContain('histogram_quantile(0.95');
		expect(query).toContain('ld_variation_id="control-var"');
		expect(query).toContain('* 1000');
	});

	it('builds sample count query for cohorts', () => {
		const query = buildSampleCountQuery(policy, runContext, 'treatment');
		expect(query).toContain('sum(increase(http_requests_total');
		expect(query).toContain('ld_variation_id="treatment-var"');
	});

	it('supports canonical metric types only', () => {
		expect(buildMetricQuery('error_rate', policy, runContext, 'treatment')).toContain(
			'rate(http_requests_total',
		);
		expect(
			buildMetricQuery('latency_p95', { ...policy, metricType: 'latency_p95' }, runContext, 'treatment'),
		).toContain('histogram_quantile');
		expect(() =>
			buildMetricQuery('p95_latency_ms', policy, runContext, 'treatment'),
		).toThrow(UnsupportedMetricTypeError);
	});
});
