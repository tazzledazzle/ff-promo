import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewPipelinePage from '@/app/pipelines/new/page';
import { renderWithProviders } from '@/__tests__/helpers/render';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: pushMock }),
}));

describe('pipeline form integration', () => {
	it('shows validation error when name is empty on submit', async () => {
		pushMock.mockClear();
		renderWithProviders(<NewPipelinePage />);

		fireEvent.click(screen.getByRole('button', { name: 'Create pipeline' }));

		await waitFor(() => {
			expect(
				screen.getByRole('alert'),
			).toHaveTextContent('Name, flag key, and project key are required.');
		});
		expect(pushMock).not.toHaveBeenCalled();
	});

	it('submits form and navigates to new pipeline detail', async () => {
		pushMock.mockClear();
		renderWithProviders(<NewPipelinePage />);

		fireEvent.change(screen.getByLabelText('Name'), {
			target: { value: 'Checkout Pipeline' },
		});
		fireEvent.change(screen.getByLabelText('Flag key'), {
			target: { value: 'checkout-v2' },
		});

		fireEvent.click(screen.getByRole('button', { name: 'Create pipeline' }));

		await waitFor(() => {
			expect(pushMock).toHaveBeenCalledWith('/pipelines/pipeline-new');
		});
	});
});
