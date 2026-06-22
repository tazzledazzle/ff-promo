import {
	GateRunContextSchema,
	type GateEvaluationResult,
	type GatePolicyInput,
	type GateRunContext,
} from '@ff-promo/contracts';
import type { PrometheusClient } from '../client/prometheus-client.js';
import { TelemetryApiError } from '../errors/telemetry-adapter-error.js';
import {
	buildMetricQuery,
	buildSampleCountQuery,
} from '../query/build-promql.js';
import { parseInstantQueryResult } from '../query/parse-response.js';

function failResult(
	policy: GatePolicyInput,
	reason: string,
	extra?: Partial<GateEvaluationResult>,
): GateEvaluationResult {
	return {
		verdict: 'fail',
		metricType: policy.metricType,
		threshold: policy.threshold,
		metadata: { reason, ...extra?.metadata },
		...extra,
	};
}

export async function evaluateGatePolicy(
	client: PrometheusClient,
	policy: GatePolicyInput,
	runContextInput: GateRunContext,
): Promise<GateEvaluationResult> {
	const runContext = GateRunContextSchema.parse(runContextInput);
	const minSampleSize = policy.minSampleSize ?? 0;

	try {
		const [treatmentData, controlData, treatmentSampleData, controlSampleData] =
			await Promise.all([
				client.queryInstant(
					buildMetricQuery(policy.metricType, policy, runContext, 'treatment'),
				),
				client.queryInstant(
					buildMetricQuery(policy.metricType, policy, runContext, 'control'),
				),
				client.queryInstant(
					buildSampleCountQuery(policy, runContext, 'treatment'),
				),
				client.queryInstant(
					buildSampleCountQuery(policy, runContext, 'control'),
				),
			]);

		const treatmentParsed = parseInstantQueryResult(treatmentData);
		if (!treatmentParsed.ok) {
			return failResult(policy, treatmentParsed.reason);
		}

		const controlParsed = parseInstantQueryResult(controlData);
		if (!controlParsed.ok) {
			return failResult(policy, controlParsed.reason);
		}

		const treatmentSampleParsed = parseInstantQueryResult(treatmentSampleData);
		if (!treatmentSampleParsed.ok) {
			return failResult(policy, 'insufficient_samples', {
				metadata: { reason: 'insufficient_samples', cohort: 'treatment' },
			});
		}
		if (treatmentSampleParsed.value < minSampleSize) {
			return failResult(policy, 'insufficient_samples', {
				metadata: {
					reason: 'insufficient_samples',
					cohort: 'treatment',
					observed: treatmentSampleParsed.value,
					required: minSampleSize,
				},
			});
		}

		const controlSampleParsed = parseInstantQueryResult(controlSampleData);
		if (!controlSampleParsed.ok) {
			return failResult(policy, 'insufficient_samples', {
				metadata: { reason: 'insufficient_samples', cohort: 'control' },
			});
		}
		if (controlSampleParsed.value < minSampleSize) {
			return failResult(policy, 'insufficient_samples', {
				metadata: {
					reason: 'insufficient_samples',
					cohort: 'control',
					observed: controlSampleParsed.value,
					required: minSampleSize,
				},
			});
		}

		const observedDelta = treatmentParsed.value - controlParsed.value;
		if (observedDelta > policy.threshold) {
			return {
				verdict: 'fail',
				metricType: policy.metricType,
				threshold: policy.threshold,
				observedDelta,
				treatmentValue: treatmentParsed.value,
				controlValue: controlParsed.value,
				metadata: { reason: 'threshold_exceeded' },
			};
		}

		return {
			verdict: 'pass',
			metricType: policy.metricType,
			threshold: policy.threshold,
			observedDelta,
			treatmentValue: treatmentParsed.value,
			controlValue: controlParsed.value,
			metadata: {},
		};
	} catch (error) {
		if (error instanceof TelemetryApiError) {
			return failResult(policy, 'prometheus_error', {
				metadata: {
					reason: 'prometheus_error',
					status: error.status,
					errorType: error.context?.errorType,
				},
			});
		}
		throw error;
	}
}
