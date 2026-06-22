import type { Actor } from '@ff-promo/contracts';

export function dashboardActor(actorId?: string): Actor {
	return {
		actorType: 'user',
		actorId:
			actorId ??
			(typeof process !== 'undefined'
				? process.env.NEXT_PUBLIC_DASHBOARD_ACTOR_ID
				: undefined) ??
			'dashboard',
	};
}
