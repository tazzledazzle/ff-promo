import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import {
	PipelineCreateRequestSchema,
	PipelineDetailResponseSchema,
	PipelineListResponseSchema,
	PipelineResponseSchema,
	PipelineUpdateRequestSchema,
} from '@ff-promo/contracts';
import { z } from 'zod';
import type { PipelineService } from '../services/pipeline.service.js';

export function pipelineRoutes(service: PipelineService): FastifyPluginAsyncZod {
	return async (app) => {
		app.get(
			'/',
			{
				schema: {
					response: { 200: PipelineListResponseSchema },
				},
			},
			async () => service.listPipelines(),
		);

		app.post(
			'/',
			{
				schema: {
					body: PipelineCreateRequestSchema,
					response: { 201: PipelineResponseSchema },
				},
			},
			async (request, reply) => {
				const pipeline = await service.createPipeline(request.body);
				return reply.status(201).send(pipeline);
			},
		);

		app.get(
			'/:id',
			{
				schema: {
					params: z.object({ id: z.string() }),
					response: { 200: PipelineDetailResponseSchema },
				},
			},
			async (request) => {
				const pipeline = await service.getPipeline(request.params.id);
				return {
					id: pipeline.id,
					name: pipeline.name,
					flagKey: pipeline.flagKey,
					projectKey: pipeline.projectKey,
					description: pipeline.description,
					isActive: pipeline.isActive,
					version: pipeline.version,
					stages: pipeline.stages.map((stage) => ({
						id: stage.id,
						orderIndex: stage.orderIndex,
						environment: stage.environment,
						displayName: stage.displayName,
						gatePolicies: stage.gatePolicies,
					})),
				};
			},
		);

		app.patch(
			'/:id',
			{
				schema: {
					params: z.object({ id: z.string() }),
					body: PipelineUpdateRequestSchema,
					response: { 200: PipelineResponseSchema },
				},
			},
			async (request) =>
				service.updatePipeline(request.params.id, request.body),
		);
	};
}
