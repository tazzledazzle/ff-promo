import type { Client } from '@temporalio/client';
import type { Mock } from 'vitest';
import { vi } from 'vitest';

export type MockTemporalClient = {
	client: Client;
	start: Mock;
	signal: Mock;
	query: Mock;
};

export function createMockTemporalClient(): MockTemporalClient {
	const start = vi.fn().mockResolvedValue(undefined);
	const signal = vi.fn().mockResolvedValue(undefined);
	const query = vi.fn().mockResolvedValue({
		status: 'active',
		currentStageIndex: 0,
		isPaused: false,
	});

	const client = {
		workflow: {
			start,
			getHandle: (_workflowId: string) => ({
				signal,
				query,
			}),
		},
	} as unknown as Client;

	return { client, start, signal, query };
}
