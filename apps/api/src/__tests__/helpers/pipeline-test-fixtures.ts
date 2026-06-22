import { randomUUID } from 'node:crypto';
import type { PipelineCreateRequest, StageInput } from '@ff-promo/contracts';

const defaultGatePolicies = [
	{ metricType: 'error_rate' as const, threshold: 0.01, serviceName: 'demo-service' },
	{ metricType: 'latency_p95' as const, threshold: 500, serviceName: 'demo-service' },
];

export function standardStages(serviceName = 'demo-service'): StageInput[] {
	return [
		{
			orderIndex: 0,
			environment: 'dev',
			displayName: 'Development',
			gatePolicies: defaultGatePolicies.map((p) => ({ ...p, serviceName })),
		},
		{
			orderIndex: 1,
			environment: 'staging',
			displayName: 'Staging',
			gatePolicies: defaultGatePolicies.map((p) => ({ ...p, serviceName })),
		},
		{
			orderIndex: 2,
			environment: 'prod',
			displayName: 'Production',
			gatePolicies: defaultGatePolicies.map((p) => ({ ...p, serviceName })),
		},
	];
}

export function createValidPipelinePayload(
	overrides: Partial<PipelineCreateRequest> = {},
): PipelineCreateRequest {
	return {
		name: `pipeline-${randomUUID()}`,
		flagKey: `flag-${randomUUID()}`,
		projectKey: 'default',
		stages: standardStages(),
		actor: { actorType: 'user', actorId: 'platform' },
		...overrides,
	};
}
