import {
	createPrismaClient,
	createRepositories,
} from '@ff-promo/db';

export function createRequestDb(databaseUrl: string): RequestDb {
	const db = createPrismaClient(databaseUrl);
	return {
		db,
		repos: createRepositories(db),
		async dispose() {
			await db.$disconnect();
		},
	};
}

export type RequestDb = {
	db: ReturnType<typeof createPrismaClient>;
	repos: ReturnType<typeof createRepositories>;
	dispose: () => Promise<void>;
};
