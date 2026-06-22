import type { GatePolicyInput, GateRunContext } from '@ff-promo/contracts';
import { UnsupportedMetricTypeError } from '../errors/telemetry-adapter-error.js';

export type Cohort = 'treatment' | 'control';

export function escapePromqlLabelValue(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function windowSuffix(policy: GatePolicyInput): string {
	const windowSeconds = policy.windowSeconds ?? 300;
	return `[${windowSeconds}s]`;
}

function cohortVariationId(
	runContext: GateRunContext,
	cohort: Cohort,
): string {
	return cohort === 'treatment'
		? runContext.treatmentVariationId
		: runContext.controlVariationId;
}

function labelSelector(
	policy: GatePolicyInput,
	runContext: GateRunContext,
	cohort: Cohort,
	extraLabels = '',
): string {
	const service = escapePromqlLabelValue(policy.serviceName);
	const flagKey = escapePromqlLabelValue(runContext.flagKey);
	const variationId = escapePromqlLabelValue(
		cohortVariationId(runContext, cohort),
	);
	const base = `service="${service}",ld_flag_key="${flagKey}",ld_variation_id="${variationId}",ld_context_kind="user"`;
	if (extraLabels) {
		return `{${base},${extraLabels}}`;
	}
	return `{${base}}`;
}

export function buildErrorRateQuery(
	policy: GatePolicyInput,
	runContext: GateRunContext,
	cohort: Cohort,
): string {
	const labels = labelSelector(policy, runContext, cohort);
	const errorLabels = labelSelector(
		policy,
		runContext,
		cohort,
		'status=~"5.."',
	);
	const window = windowSuffix(policy);
	return `sum(rate(http_requests_total${errorLabels}${window})) / sum(rate(http_requests_total${labels}${window}))`;
}

export function buildLatencyP95Query(
	policy: GatePolicyInput,
	runContext: GateRunContext,
	cohort: Cohort,
): string {
	const labels = labelSelector(policy, runContext, cohort);
	const window = windowSuffix(policy);
	return `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket${labels}${window})) by (le)) * 1000`;
}

export function buildSampleCountQuery(
	policy: GatePolicyInput,
	runContext: GateRunContext,
	cohort: Cohort,
): string {
	const labels = labelSelector(policy, runContext, cohort);
	const window = windowSuffix(policy);
	return `sum(increase(http_requests_total${labels}${window}))`;
}

export function buildMetricQuery(
	metricType: string,
	policy: GatePolicyInput,
	runContext: GateRunContext,
	cohort: Cohort,
): string {
	switch (metricType) {
		case 'error_rate':
			return buildErrorRateQuery(policy, runContext, cohort);
		case 'latency_p95':
			return buildLatencyP95Query(policy, runContext, cohort);
		default:
			throw new UnsupportedMetricTypeError(
				`Unsupported metric type: ${metricType}`,
				metricType,
			);
	}
}
