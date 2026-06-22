import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewRunPage from '@/app/runs/new/page';
import { renderWithProviders } from '@/__tests__/helpers/render';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: pushMock }),
}));

describe('create run integration', () => {
	it('submits form and navigates to new run detail', async () => {
		pushMock.mockClear();
		renderWithProviders(<NewRunPage />);

		const pipelineSelect = await screen.findByLabelText('Pipeline');
		await screen.findByRole('option', { name: /Dev Pipeline/ });
		fireEvent.change(pipelineSelect, { target: { value: 'pipeline-1' } });

		await waitFor(() => {
			expect(screen.getByLabelText('Flag key')).toHaveValue('api-read-flag');
		});

		fireEvent.click(screen.getByRole('button', { name: 'Create run' }));

		await waitFor(() => {
			expect(pushMock).toHaveBeenCalledWith('/runs/run-new');
		});
	});
});
