import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunsTable } from '@/components/runs/runs-table';
import { mockPausedListItem } from '@/__tests__/mocks/handlers';
import { renderWithProviders } from '@/__tests__/helpers/render';

describe('RunsTable', () => {
	it('renders flagKey, pipelineName, currentEnvironment columns from fixture', () => {
		renderWithProviders(
			<RunsTable runs={[mockPausedListItem]} isLoading={false} />,
		);

		expect(screen.getByText('api-read-flag')).toBeInTheDocument();
		expect(screen.getByText('Dev Pipeline')).toBeInTheDocument();
		expect(screen.getByText(/dev/)).toBeInTheDocument();
	});
});
