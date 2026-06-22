import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
	ALL_PROMOTION_STATUSES,
	RunStatusBadge,
} from '@/components/runs/run-status-badge';
import { renderWithProviders } from '@/__tests__/helpers/render';

describe('RunStatusBadge', () => {
	it("renders 'paused' text with secondary variant", () => {
		renderWithProviders(<RunStatusBadge status="paused" />);
		const badge = screen.getByText('paused');
		expect(badge).toBeInTheDocument();
		expect(badge.className).toContain('bg-secondary');
	});

	it('maps all PromotionStatus values from contracts without local enum duplication', () => {
		expect(ALL_PROMOTION_STATUSES).toEqual([
			'pending',
			'active',
			'paused',
			'completed',
			'aborted',
		]);

		for (const status of ALL_PROMOTION_STATUSES) {
			const { unmount } = renderWithProviders(
				<RunStatusBadge status={status} />,
			);
			expect(screen.getByText(status)).toBeInTheDocument();
			unmount();
		}
	});
});
