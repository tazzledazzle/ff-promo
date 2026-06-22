import type { PromotionStatus } from '@ff-promo/contracts';

const POLL_INTERVAL_MS = 8_000;

export function runPollIntervalMs(
	status: PromotionStatus | undefined,
): number | false {
	if (!status) {
		return false;
	}
	if (status === 'active' || status === 'paused') {
		return POLL_INTERVAL_MS;
	}
	return false;
}
