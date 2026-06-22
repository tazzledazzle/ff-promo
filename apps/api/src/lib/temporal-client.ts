import { Connection, Client as TemporalClient, type Client } from '@temporalio/client';

export async function createTemporalClient(address: string): Promise<{
	client: Client;
	close: () => Promise<void>;
}> {
	const connection = await Connection.connect({ address });
	const client = new TemporalClient({ connection });
	return {
		client,
		close: async () => {
			await connection.close();
		},
	};
}
