import type { GatePolicyInput, GateRunContext } from '@ff-promo/contracts';
import type { StageGateEvaluation } from '@ff-promo/contracts';
import type { PrometheusClient } from '../client/prometheus-client.js';
import { evaluateGatePolicy } from './evaluate-gate-policy.js';

export async function evaluateStageGates(
	client: PrometheusClient,
	policies: GatePolicyInput[],
	runContext: GateRunContext,
): Promise<StageGateEvaluation> {
	const results = [];
	for (const policy of policies) {
		results.push(await evaluateGatePolicy(client, policy, runContext));
	}

	const verdict = results.every((result) => result.verdict === 'pass')
		? 'pass'
		: 'fail';

	return { verdict, results };
}
