import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmAbortDialog } from '@/components/runs/confirm-abort-dialog';
import { renderWithProviders } from '@/__tests__/helpers/render';

describe('ConfirmAbortDialog', () => {
	it('requires explicit confirm click before onConfirm fires', () => {
		const onConfirm = vi.fn();

		renderWithProviders(
			<ConfirmAbortDialog
				open
				onOpenChange={vi.fn()}
				onConfirm={onConfirm}
			/>,
		);

		expect(onConfirm).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(onConfirm).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', { name: 'Abort promotion' }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});
});
