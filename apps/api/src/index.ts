import { buildApp } from './app.js';
import { loadEnv } from './lib/env.js';

async function main() {
	const env = loadEnv();
	const app = await buildApp({ env });

	const shutdown = async () => {
		await app.close();
		process.exit(0);
	};

	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);

	await app.listen({ port: env.PORT, host: '0.0.0.0' });
	console.log(`ff-promo API listening on port ${env.PORT}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
