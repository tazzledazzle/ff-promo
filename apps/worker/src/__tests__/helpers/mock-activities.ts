import type * as activities from '../../activities/index.js';
import * as realActivities from '../../activities/index.js';

type ActivityMocks = Partial<typeof activities>;

export function createMockActivities(
	overrides: ActivityMocks = {},
): typeof activities {
	return {
		...realActivities,
		runPreflight: async () => ({
			status: 'pass' as const,
			report: { status: 'pass' as const, checks: [] },
		}),
		applyStageTargeting: async () => ({
			environmentKey: 'dev',
			treatmentVariationId: 'var-on',
			controlVariationId: 'var-off',
		}),
		evaluateGate: async () => ({
			verdict: 'pass' as const,
			gateResultIds: ['mock-gate-result-id'],
		}),
		...overrides,
	};
}
