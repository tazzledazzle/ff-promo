import type { GatePolicyInput, GateRunContext } from '@ff-promo/contracts';
import {
	GateRunContextSchema,
	type PreflightCheck,
	type PreflightReport,
} from '@ff-promo/contracts';
import type { PrometheusClient } from '../client/prometheus-client.js';
import { TelemetryApiError } from '../errors/telemetry-adapter-error.js';
import { buildSampleCountQuery } from '../query/build-promql.js';
import { parseInstantQueryResult } from '../query/parse-response.js';

function check(
	id: PreflightCheck['id'],
	status: 'pass' | 'fail',
	extra?: Partial<PreflightCheck>,
): PreflightCheck {
	return { id, status, ...extra };
}

function requiredSampleSize(policies: GatePolicyInput[]): number {
	return policies.reduce(
		(max, policy) => Math.max(max, policy.minSampleSize ?? 0),
		0,
	);
}

function summarizeFailures(checks: PreflightCheck[]): string {
	const failed = checks.filter((item) => item.status === 'fail');
	return failed.map((item) => item.detail ?? item.id).join('; ');
}

function probePolicy(
	policies: GatePolicyInput[],
	runContext: GateRunContext,
): GatePolicyInput {
	return (
		policies[0] ?? {
			metricType: 'error_rate',
			threshold: 0,
			serviceName: runContext.flagKey,
		}
	);
}

export async function runPreflightChecks(
	client: PrometheusClient,
	policies: GatePolicyInput[],
	runContextInput: GateRunContext,
): Promise<PreflightReport> {
	const runContext = GateRunContextSchema.parse(runContextInput);
	const required = requiredSampleSize(policies);
	const policy = probePolicy(policies, runContext);
	const checks: PreflightCheck[] = [];

	try {
		const [treatmentSampleData, controlSampleData] = await Promise.all([
			client.queryInstant(
				buildSampleCountQuery(policy, runContext, 'treatment'),
			),
			client.queryInstant(
				buildSampleCountQuery(policy, runContext, 'control'),
			),
		]);

		const treatmentSample = parseInstantQueryResult(treatmentSampleData);
		const controlSample = parseInstantQueryResult(controlSampleData);

		checks.push(
			check(
				'metric_flow_treatment',
				treatmentSample.ok ? 'pass' : 'fail',
				treatmentSample.ok
					? undefined
					: { detail: 'No treatment user-scoped metrics found' },
			),
		);
		checks.push(
			check(
				'metric_flow_control',
				controlSample.ok ? 'pass' : 'fail',
				controlSample.ok
					? undefined
					: { detail: 'No control user-scoped metrics found' },
			),
		);
		checks.push(
			check(
				'min_sample_treatment',
				treatmentSample.ok && treatmentSample.value >= required ? 'pass' : 'fail',
				{
					observed: treatmentSample.ok ? treatmentSample.value : undefined,
					required,
					detail:
						treatmentSample.ok && treatmentSample.value >= required
							? undefined
							: 'Treatment sample count below required minimum',
				},
			),
		);
		checks.push(
			check(
				'min_sample_control',
				controlSample.ok && controlSample.value >= required ? 'pass' : 'fail',
				{
					observed: controlSample.ok ? controlSample.value : undefined,
					required,
					detail:
						controlSample.ok && controlSample.value >= required
							? undefined
							: 'Control sample count below required minimum',
				},
			),
		);
		checks.push(
			check(
				'context_kind_user',
				treatmentSample.ok ? 'pass' : 'fail',
				treatmentSample.ok
					? undefined
					: { detail: 'No user context kind series present' },
			),
		);
	} catch (error) {
		if (error instanceof TelemetryApiError) {
			checks.push(
				check('metric_flow_treatment', 'fail', {
					detail: 'Prometheus query failed',
				}),
				check('metric_flow_control', 'fail', {
					detail: 'Prometheus query failed',
				}),
				check('min_sample_treatment', 'fail', { required }),
				check('min_sample_control', 'fail', { required }),
				check('context_kind_user', 'fail', {
					detail: 'Prometheus query failed',
				}),
			);
		} else {
			throw error;
		}
	}

	const status = checks.every((item) => item.status === 'pass') ? 'pass' : 'fail';
	return {
		status,
		checks,
		blockReason: status === 'fail' ? summarizeFailures(checks) : undefined,
	};
}
