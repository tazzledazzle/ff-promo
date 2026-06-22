import type { FastifyInstance } from 'fastify';
import type { Env } from '../lib/env.js';
import { unauthorized } from '../errors/api-error.js';

export async function registerAuth(app: FastifyInstance, env: Env) {
	app.addHook('onRequest', async (request) => {
		if (!env.API_KEY) {
			return;
		}
		const apiKey = request.headers['x-api-key'];
		if (apiKey !== env.API_KEY) {
			throw unauthorized();
		}
		request.actor = {
			actorType: 'api_key',
			actorId: String(apiKey),
		};
	});
}
