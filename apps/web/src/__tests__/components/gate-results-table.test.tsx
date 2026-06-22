import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GateResultsTable } from '@/components/runs/gate-results-table';
import { mockGateResults } from '@/__tests__/mocks/handlers';
import { renderWithProviders } from '@/__tests__/helpers/render';

describe('GateResultsTable', () => {
	it('renders verdict and metricType columns for GateResultResponse[]', () => {
		renderWithProviders(<GateResultsTable results={mockGateResults} />);

		expect(screen.getByText('error_rate')).toBeInTheDocument();
		expect(screen.getByText('fail')).toBeInTheDocument();
	});
});
