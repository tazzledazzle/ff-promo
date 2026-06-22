import type { PromotionStatus } from '@ff-promo/contracts';

export const queryKeys = {
	promotionRuns: {
		all: ['promotion-runs'] as const,
		list: (status?: PromotionStatus) =>
			status
				? (['promotion-runs', 'list', status] as const)
				: (['promotion-runs', 'list'] as const),
	},
	promotionRun: {
		detail: (id: string) => ['promotion-run', id] as const,
		gateResults: (id: string) => ['promotion-run', id, 'gate-results'] as const,
		auditEvents: (id: string) => ['promotion-run', id, 'audit-events'] as const,
	},
	pipelines: {
		list: ['pipelines', 'list'] as const,
		detail: (id: string) => ['pipelines', id] as const,
	},
};
