import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RunControlBar } from '@/components/runs/run-control-bar';
import { renderWithProviders } from '@/__tests__/helpers/render';

vi.mock('@/hooks/use-run-mutations', () => ({
	useRunMutations: () => ({
		start: { mutate: vi.fn(), isPending: false },
		pause: { mutate: vi.fn(), isPending: false },
		resume: { mutate: vi.fn(), isPending: false },
		abort: { mutate: vi.fn(), isPending: false },
		errorMessage: null,
		isPending: false,
	}),
}));

describe('RunControlBar', () => {
	it('shows Start only when status pending', () => {
		renderWithProviders(<RunControlBar runId="run-pending" status="pending" />);
		expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument();
	});

	it('shows Pause+Abort when active', () => {
		renderWithProviders(<RunControlBar runId="run-active" status="active" />);
		expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Abort' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
	});

	it('shows Resume+Abort when paused', () => {
		renderWithProviders(<RunControlBar runId="run-1" status="paused" />);
		expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Abort' })).toBeInTheDocument();
	});

	it('shows no buttons when completed/aborted', () => {
		const { rerender } = renderWithProviders(
			<RunControlBar runId="run-1" status="completed" />,
		);
		expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
		expect(screen.getByText(/completed/)).toBeInTheDocument();

		rerender(<RunControlBar runId="run-1" status="aborted" />);
		expect(screen.getByText(/aborted/)).toBeInTheDocument();
	});

	it('does not show Abort when status pending', () => {
		renderWithProviders(<RunControlBar runId="run-pending" status="pending" />);
		expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument();
	});
});
