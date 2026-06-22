import type { Actor, PromotionRunListQuery, PromotionStatus } from '@ff-promo/contracts';
import type { Client } from '@temporalio/client';
import {
	queryPromotionStatus,
	signalPromotionRun,
	startPromotionRun,
} from '@ff-promo/promotion-control';
import { conflict, notFound } from '../errors/api-error.js';
import { createRequestDb } from '../lib/db.js';
import {
	buildGateForensics,
	mapAuditEvent,
	mapGateResult,
	mapPromotionRun,
	mapPromotionRunListItem,
} from '../lib/forensics.js';

export type PromotionRunServiceDeps = {
	databaseUrl: string;
	temporalAddress: string;
	taskQueue: string;
	temporalClient?: Client;
};

function assertControlAllowed(status: PromotionStatus, action: string) {
	if (status === 'completed' || status === 'aborted') {
		throw conflict(`Cannot ${action} promotion run in status ${status}`);
	}
}

export function createPromotionRunService(deps: PromotionRunServiceDeps) {
	const resolveActor = (
		requestActor: Actor | undefined,
		fallback?: Actor,
	): Actor => {
		return requestActor ?? fallback ?? { actorType: 'system', actorId: 'api' };
	};

	return {
		async createRun(input: {
			pipelineId: string;
			flagKey: string;
			actor: Actor;
		}) {
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const pipeline = await repos.pipeline.findById(input.pipelineId);
				if (!pipeline) {
					throw notFound(`Pipeline ${input.pipelineId} not found`);
				}
				const run = await repos.promotionRun.create({
					pipelineId: input.pipelineId,
					flagKey: input.flagKey,
				});
				return mapPromotionRun(run);
			} finally {
				await dispose();
			}
		},

		async startRun(input: {
			promotionRunId: string;
			actor: Actor;
		}) {
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const existing = await repos.promotionRun.findById(input.promotionRunId);
				if (!existing) {
					throw notFound(`Promotion run ${input.promotionRunId} not found`);
				}
				if (existing.status !== 'pending') {
					throw conflict(
						`Promotion run must be pending to start (current: ${existing.status})`,
					);
				}

				await repos.audit.append({
					promotionRunId: input.promotionRunId,
					action: 'run_started',
					actorType: input.actor.actorType,
					actorId: input.actor.actorId,
					displayName: input.actor.displayName,
				});
			} finally {
				await dispose();
			}

			await startPromotionRun({
				promotionRunId: input.promotionRunId,
				actor: input.actor,
				taskQueue: deps.taskQueue,
				temporalAddress: deps.temporalAddress,
				temporalClient: deps.temporalClient,
				databaseUrl: deps.databaseUrl,
			});

			const refreshed = createRequestDb(deps.databaseUrl);
			try {
				const run = await refreshed.repos.promotionRun.findById(input.promotionRunId);
				if (!run) {
					throw notFound(`Promotion run ${input.promotionRunId} not found`);
				}
				return mapPromotionRun(run);
			} finally {
				await refreshed.dispose();
			}
		},

		async pauseRun(input: {
			promotionRunId: string;
			actor?: Actor;
			fallbackActor?: Actor;
		}) {
			const actor = resolveActor(input.actor, input.fallbackActor);
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const run = await repos.promotionRun.findById(input.promotionRunId);
				if (!run) {
					throw notFound(`Promotion run ${input.promotionRunId} not found`);
				}
				if (run.status !== 'active') {
					throw conflict(`Promotion run must be active to pause (current: ${run.status})`);
				}
			} finally {
				await dispose();
			}

			await signalPromotionRun({
				promotionRunId: input.promotionRunId,
				action: 'pause',
				temporalClient: deps.temporalClient,
				temporalAddress: deps.temporalAddress,
				databaseUrl: deps.databaseUrl,
			});

			return { promotionRunId: input.promotionRunId, action: 'pause' as const, actor };
		},

		async resumeRun(input: {
			promotionRunId: string;
			actor?: Actor;
			fallbackActor?: Actor;
		}) {
			const actor = resolveActor(input.actor, input.fallbackActor);
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const run = await repos.promotionRun.findById(input.promotionRunId);
				if (!run) {
					throw notFound(`Promotion run ${input.promotionRunId} not found`);
				}
				if (run.status !== 'paused') {
					throw conflict(
						`Promotion run must be paused to resume (current: ${run.status})`,
					);
				}
			} finally {
				await dispose();
			}

			await signalPromotionRun({
				promotionRunId: input.promotionRunId,
				action: 'resume',
				temporalClient: deps.temporalClient,
				temporalAddress: deps.temporalAddress,
				databaseUrl: deps.databaseUrl,
			});

			return { promotionRunId: input.promotionRunId, action: 'resume' as const, actor };
		},

		async abortRun(input: {
			promotionRunId: string;
			actor?: Actor;
			fallbackActor?: Actor;
		}) {
			const actor = resolveActor(input.actor, input.fallbackActor);
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const run = await repos.promotionRun.findById(input.promotionRunId);
				if (!run) {
					throw notFound(`Promotion run ${input.promotionRunId} not found`);
				}
				assertControlAllowed(run.status, 'abort');
				if (run.status === 'pending') {
					throw conflict('Promotion run must be started before abort');
				}
			} finally {
				await dispose();
			}

			await signalPromotionRun({
				promotionRunId: input.promotionRunId,
				action: 'abort',
				temporalClient: deps.temporalClient,
				temporalAddress: deps.temporalAddress,
				databaseUrl: deps.databaseUrl,
			});

			return { promotionRunId: input.promotionRunId, action: 'abort' as const, actor };
		},

		async getStatus(promotionRunId: string) {
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const run = await repos.promotionRun.findById(promotionRunId);
				if (!run) {
					throw notFound(`Promotion run ${promotionRunId} not found`);
				}

				const pipeline = await repos.pipeline.findById(run.pipelineId);
				const gateResults = await repos.gateResult.findByRunId(promotionRunId);
				const gateForensics = buildGateForensics(
					run,
					gateResults,
					pipeline?.stages ?? [],
				);

				let liveWorkflowStatus;
				if (run.temporalWorkflowId) {
					try {
						liveWorkflowStatus = await queryPromotionStatus({
							promotionRunId,
							temporalClient: deps.temporalClient,
							temporalAddress: deps.temporalAddress,
							databaseUrl: deps.databaseUrl,
						});
					} catch {
						liveWorkflowStatus = undefined;
					}
				}

				return {
					run: mapPromotionRun(run),
					gateForensics,
					liveWorkflowStatus,
				};
			} finally {
				await dispose();
			}
		},

		async listGateResults(promotionRunId: string) {
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const run = await repos.promotionRun.findById(promotionRunId);
				if (!run) {
					throw notFound(`Promotion run ${promotionRunId} not found`);
				}
				const results = await repos.gateResult.findByRunId(promotionRunId);
				return results.map(mapGateResult);
			} finally {
				await dispose();
			}
		},

		async listAuditEvents(promotionRunId: string) {
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const run = await repos.promotionRun.findById(promotionRunId);
				if (!run) {
					throw notFound(`Promotion run ${promotionRunId} not found`);
				}
				const events = await repos.audit.findByRunId(promotionRunId);
				return events.map(mapAuditEvent);
			} finally {
				await dispose();
			}
		},

		async listRuns(query: PromotionRunListQuery) {
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const runs = await repos.promotionRun.findRecent({
					status: query.status as PromotionStatus | undefined,
					limit: query.limit,
				});
				return {
					runs: runs.map(mapPromotionRunListItem),
				};
			} finally {
				await dispose();
			}
		},
	};
}

export type PromotionRunService = ReturnType<typeof createPromotionRunService>;
