import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GateForensicsPanel } from '@/components/runs/gate-forensics-panel';
import { mockGateForensics } from '@/__tests__/mocks/handlers';
import { renderWithProviders } from '@/__tests__/helpers/render';
import type { GateForensics } from '@ff-promo/contracts';

describe('GateForensicsPanel', () => {
	it('renders metricType, verdict fail, threshold, observedValue from fixture', () => {
		renderWithProviders(<GateForensicsPanel forensics={mockGateForensics} />);

		expect(screen.getByText('error_rate')).toBeInTheDocument();
		expect(screen.getByText('fail')).toBeInTheDocument();
		expect(screen.getAllByText('0.01').length).toBeGreaterThan(0);
		expect(screen.getAllByText('0.05').length).toBeGreaterThan(0);
	});

	it('shows pauseReason header and stage displayName/environment', () => {
		renderWithProviders(<GateForensicsPanel forensics={mockGateForensics} />);

		expect(screen.getByText(/Pause reason: threshold_exceeded/)).toBeInTheDocument();
		expect(screen.getByText(/Stage 0: Dev \(dev\)/)).toBeInTheDocument();
	});

	it('shows empty forensics message with pauseReason when manual pause', () => {
		const manualPause: GateForensics = {
			pauseReason: 'operator_pause',
			stageIndex: 0,
			environment: 'dev',
			displayName: 'Dev',
			results: [],
		};

		renderWithProviders(<GateForensicsPanel forensics={manualPause} />);

		expect(screen.getByText(/No gate failures recorded/)).toBeInTheDocument();
		expect(
			screen.getByText(/pause reason: operator_pause/),
		).toBeInTheDocument();
	});
});
