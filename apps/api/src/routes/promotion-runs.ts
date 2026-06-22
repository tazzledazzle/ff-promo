import {
	AuditEventResponseSchema,
	ActorSchema,
	CreatePromotionRunRequestSchema,
	ControlActionRequestSchema,
	GateResultResponseSchema,
	PromotionRunResponseSchema,
	PromotionRunStatusResponseSchema,
} from '@ff-promo/contracts';
import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { z } from 'zod';
import type { PromotionRunService } from '../services/promotion-run.service.js';

export const promotionRunRoutes = (
	service: PromotionRunService,
): FastifyPluginAsyncZod => {
	return async (app) => {
		app.post(
			'/v1/promotion-runs',
			{
				schema: {
					body: CreatePromotionRunRequestSchema,
					response: { 201: PromotionRunResponseSchema },
				},
			},
			async (request, reply) => {
				const run = await service.createRun(request.body);
				return reply.status(201).send(run);
			},
		);

		app.post(
			'/v1/promotion-runs/:id/start',
			{
				schema: {
					params: z.object({ id: z.string() }),
					body: z.object({ actor: ActorSchema }),
					response: { 200: PromotionRunResponseSchema },
				},
			},
			async (request) => {
				return service.startRun({
					promotionRunId: request.params.id,
					actor: request.body.actor,
				});
			},
		);

		const controlResponseSchema = {
			200: z.object({
				promotionRunId: z.string(),
				action: z.enum(['pause', 'resume', 'abort']),
			}),
		};

		app.post(
			'/v1/promotion-runs/:id/pause',
			{
				schema: {
					params: z.object({ id: z.string() }),
					body: ControlActionRequestSchema,
					response: controlResponseSchema,
				},
			},
			async (request) =>
				service.pauseRun({
					promotionRunId: request.params.id,
					actor: request.body.actor,
					fallbackActor: request.actor,
				}),
		);

		app.post(
			'/v1/promotion-runs/:id/resume',
			{
				schema: {
					params: z.object({ id: z.string() }),
					body: ControlActionRequestSchema,
					response: controlResponseSchema,
				},
			},
			async (request) =>
				service.resumeRun({
					promotionRunId: request.params.id,
					actor: request.body.actor,
					fallbackActor: request.actor,
				}),
		);

		app.post(
			'/v1/promotion-runs/:id/abort',
			{
				schema: {
					params: z.object({ id: z.string() }),
					body: ControlActionRequestSchema,
					response: controlResponseSchema,
				},
			},
			async (request) =>
				service.abortRun({
					promotionRunId: request.params.id,
					actor: request.body.actor,
					fallbackActor: request.actor,
				}),
		);

		app.get(
			'/v1/promotion-runs/:id',
			{
				schema: {
					params: z.object({ id: z.string() }),
					response: { 200: PromotionRunStatusResponseSchema },
				},
			},
			async (request) => service.getStatus(request.params.id),
		);

		app.get(
			'/v1/promotion-runs/:id/gate-results',
			{
				schema: {
					params: z.object({ id: z.string() }),
					response: { 200: z.array(GateResultResponseSchema) },
				},
			},
			async (request) => service.listGateResults(request.params.id),
		);

		app.get(
			'/v1/promotion-runs/:id/audit-events',
			{
				schema: {
					params: z.object({ id: z.string() }),
					response: { 200: z.array(AuditEventResponseSchema) },
				},
			},
			async (request) => service.listAuditEvents(request.params.id),
		);
	};
};
