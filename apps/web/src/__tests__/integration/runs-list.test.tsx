import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RunsPage from '@/app/runs/page';
import { mockPausedListItem } from '@/__tests__/mocks/handlers';
import { renderWithProviders } from '@/__tests__/helpers/render';

describe('runs list integration', () => {
	it('renders flagKey and environment with link to detail', async () => {
		renderWithProviders(<RunsPage />);

		await waitFor(() => {
			expect(screen.getByText(mockPausedListItem.flagKey)).toBeInTheDocument();
		});

		expect(screen.getByText(/dev/)).toBeInTheDocument();
		const link = screen.getByRole('link', { name: 'View' });
		expect(link).toHaveAttribute('href', `/runs/${mockPausedListItem.id}`);
	});
});
