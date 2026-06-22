import type { GatePolicyInput, StageInput } from '@ff-promo/contracts';

export const defaultGatePolicies: GatePolicyInput[] = [
	{
		metricType: 'error_rate',
		threshold: 0.01,
		serviceName: 'demo-service',
	},
	{
		metricType: 'latency_p95',
		threshold: 500,
		serviceName: 'demo-service',
	},
];

export function standardStages(
	serviceName = 'demo-service',
): StageInput[] {
	return [
		{
			orderIndex: 0,
			environment: 'dev',
			displayName: 'Development',
			gatePolicies: defaultGatePolicies.map((p) => ({
				...p,
				serviceName,
			})),
		},
		{
			orderIndex: 1,
			environment: 'staging',
			displayName: 'Staging',
			gatePolicies: defaultGatePolicies.map((p) => ({
				...p,
				serviceName,
			})),
		},
		{
			orderIndex: 2,
			environment: 'prod',
			displayName: 'Production',
			gatePolicies: defaultGatePolicies.map((p) => ({
				...p,
				serviceName,
			})),
		},
	];
}
