import type { Client } from '@temporalio/client';
import Fastify from 'fastify';
import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import type { FastifyError } from 'fastify';
import { ApiError } from './errors/api-error.js';
import type { Env } from './lib/env.js';
import { loadEnv } from './lib/env.js';
import { healthRoutes } from './routes/health.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerAuth } from './plugins/auth.js';
import { promotionRunRoutes } from './routes/promotion-runs.js';
import { pipelineRoutes } from './routes/pipelines.js';
import type { PromotionRunService } from './services/promotion-run.service.js';
import { createPromotionRunService } from './services/promotion-run.service.js';

export type BuildAppOptions = {
	env?: Env;
	temporalClient?: Client;
	service?: PromotionRunService;
};

declare module 'fastify' {
	interface FastifyInstance {
		env: Env;
	}

	interface FastifyRequest {
		actor?: {
			actorType: 'user' | 'system' | 'api_key';
			actorId: string;
			displayName?: string;
		};
	}
}

export async function buildApp(options: BuildAppOptions = {}) {
	const env = options.env ?? loadEnv();
	const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	app.decorate('env', env);

	app.setErrorHandler((error: FastifyError, _request, reply) => {
		if (error instanceof ApiError) {
			return reply.status(error.statusCode).send({
				error: error.code ?? 'api_error',
				message: error.message,
			});
		}
		if (error.validation) {
			return reply.status(400).send({
				error: 'validation_error',
				message: error.message,
			});
		}
		return reply.status(500).send({
			error: 'internal_error',
			message: 'Internal server error',
		});
	});

	await registerAuth(app, env);
	await registerSwagger(app);
	await app.register(healthRoutes);

	const service =
		options.service ??
		createPromotionRunService({
			databaseUrl: env.DATABASE_URL,
			temporalClient: options.temporalClient,
			temporalAddress: env.TEMPORAL_ADDRESS,
			taskQueue: env.TEMPORAL_TASK_QUEUE,
		});

	await app.register(promotionRunRoutes(service));
	await app.register(pipelineRoutes, { prefix: '/v1/pipelines' });

	return app;
}
