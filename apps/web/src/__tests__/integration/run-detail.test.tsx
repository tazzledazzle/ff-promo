import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunDetail } from '@/app/runs/[id]/run-detail';
import { mockGateForensics } from '@/__tests__/mocks/handlers';
import { renderWithProviders } from '@/__tests__/helpers/render';

describe('run detail integration', () => {
	it('displays forensics metric and audit action for paused run', async () => {
		renderWithProviders(<RunDetail runId="run-1" />);

		await waitFor(() => {
			expect(
				screen.getByText(mockGateForensics.results[0]!.metricType),
			).toBeInTheDocument();
		});

		expect(screen.getByText('promotion_paused')).toBeInTheDocument();
	});
});
