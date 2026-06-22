import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { RunControlBar } from '@/components/runs/run-control-bar';
import { server } from '@/__tests__/setup';
import { mockActiveRun } from '@/__tests__/mocks/handlers';
import { renderWithProviders } from '@/__tests__/helpers/render';

describe('control actions integration', () => {
	it('calls pause when Pause is clicked on active run', async () => {
		let pauseCalled = false;
		server.use(
			http.post('/api/ff-promo/v1/promotion-runs/:id/pause', () => {
				pauseCalled = true;
				return HttpResponse.json({
					promotionRunId: mockActiveRun.id,
					action: 'pause',
				});
			}),
		);

		renderWithProviders(
			<RunControlBar runId={mockActiveRun.id} status="active" />,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

		await waitFor(() => {
			expect(pauseCalled).toBe(true);
		});
	});

	it('opens abort dialog and posts abort on confirm', async () => {
		let abortCalled = false;
		server.use(
			http.post('/api/ff-promo/v1/promotion-runs/:id/abort', () => {
				abortCalled = true;
				return HttpResponse.json({
					promotionRunId: mockActiveRun.id,
					action: 'abort',
				});
			}),
		);

		renderWithProviders(
			<RunControlBar runId={mockActiveRun.id} status="active" />,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Abort' }));

		await waitFor(() => {
			expect(
				screen.getByRole('heading', { name: 'Abort promotion?' }),
			).toBeInTheDocument();
		});

		fireEvent.click(
			screen.getByRole('button', { name: 'Abort promotion' }),
		);

		await waitFor(() => {
			expect(abortCalled).toBe(true);
		});
	});

	it('displays 409 message when pause conflicts', async () => {
		server.use(
			http.post('/api/ff-promo/v1/promotion-runs/:id/pause', () =>
				HttpResponse.json(
					{ error: 'conflict', message: 'Run must be active to pause' },
					{ status: 409 },
				),
			),
		);

		renderWithProviders(
			<RunControlBar runId="run-active" status="active" />,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent(
				'Run must be active to pause',
			);
		});
	});
});
