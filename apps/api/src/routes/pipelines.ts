import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { PipelineListResponseSchema } from '@ff-promo/contracts';
import { z } from 'zod';
import { createRequestDb } from '../lib/db.js';
import { notFound } from '../errors/api-error.js';

export const pipelineRoutes: FastifyPluginAsyncZod = async (app) => {
	const env = app.env;

	app.get(
		'/',
		{
			schema: {
				response: { 200: PipelineListResponseSchema },
			},
		},
		async () => {
			const { repos, dispose } = createRequestDb(env.DATABASE_URL);
			try {
				const pipelines = await repos.pipeline.listActive();
				return {
					pipelines: pipelines.map((pipeline) => ({
						id: pipeline.id,
						name: pipeline.name,
						flagKey: pipeline.flagKey,
						stageCount: pipeline.stages.length,
					})),
				};
			} finally {
				await dispose();
			}
		},
	);

	app.get(
		'/:id',
		{
			schema: {
				params: z.object({ id: z.string() }),
				response: {
					200: z.object({
						id: z.string(),
						name: z.string(),
						flagKey: z.string(),
						projectKey: z.string(),
						stages: z.array(
							z.object({
								id: z.string(),
								orderIndex: z.number().int(),
								environment: z.string(),
								displayName: z.string(),
							}),
						),
					}),
				},
			},
		},
		async (request) => {
			const { repos, dispose } = createRequestDb(env.DATABASE_URL);
			try {
				const pipeline = await repos.pipeline.findById(request.params.id);
				if (!pipeline) {
					throw notFound(`Pipeline ${request.params.id} not found`);
				}
				return {
					id: pipeline.id,
					name: pipeline.name,
					flagKey: pipeline.flagKey,
					projectKey: pipeline.projectKey,
					stages: pipeline.stages.map((stage) => ({
						id: stage.id,
						orderIndex: stage.orderIndex,
						environment: stage.environment,
						displayName: stage.displayName,
					})),
				};
			} finally {
				await dispose();
			}
		},
	);
};
