import { startPromotionRun } from '../lib/start-promotion-run.js';

const promotionRunId = process.argv[2];

if (!promotionRunId) {
	console.error('Usage: pnpm --filter @ff-promo/worker start-run <promotionRunId>');
	process.exit(1);
}

startPromotionRun({
	promotionRunId,
	actor: { actorType: 'user', actorId: process.env.USER ?? 'cli' },
})
	.then((result) => {
		console.log(JSON.stringify(result, null, 2));
	})
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
