import type {
	PipelineCreateRequest,
	PipelineResponse,
	PipelineUpdateRequest,
} from '@ff-promo/contracts';
import type { Pipeline, Stage, GatePolicy } from '@ff-promo/db';
import {
	conflict,
	forbidden,
	notFound,
	unprocessableEntity,
} from '../errors/api-error.js';
import { createRequestDb } from '../lib/db.js';
import {
	throwOnViolation,
	validatePipelineConfig,
} from './guardrail.service.js';

export type PipelineServiceDeps = {
	databaseUrl: string;
};

type PipelineWithStages = Pipeline & {
	stages: Array<Stage & { gatePolicies: GatePolicy[] }>;
};

function mapPipelineResponse(pipeline: PipelineWithStages): PipelineResponse {
	return {
		id: pipeline.id,
		name: pipeline.name,
		flagKey: pipeline.flagKey,
		projectKey: pipeline.projectKey,
		description: pipeline.description,
		isActive: pipeline.isActive,
		version: pipeline.version,
		createdAt: pipeline.createdAt.toISOString(),
		updatedAt: pipeline.updatedAt.toISOString(),
		stages: pipeline.stages.map((stage) => ({
			id: stage.id,
			orderIndex: stage.orderIndex,
			environment: stage.environment as 'dev' | 'staging' | 'prod',
			displayName: stage.displayName,
			gatePolicies: stage.gatePolicies.map((policy) => ({
				id: policy.id,
				metricType: policy.metricType as 'error_rate' | 'latency_p95',
				threshold: policy.threshold,
				serviceName: policy.serviceName,
				comparisonMode: policy.comparisonMode,
				windowSeconds: policy.windowSeconds,
				minSampleSize: policy.minSampleSize,
			})),
		})),
	};
}

function isUniqueConstraintError(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code: string }).code === 'P2002'
	);
}

export function createPipelineService(deps: PipelineServiceDeps) {
	return {
		async createPipeline(body: PipelineCreateRequest): Promise<PipelineResponse> {
			const violations = validatePipelineConfig(body);
			throwOnViolation(violations, {
				notFound,
				forbidden,
				unprocessableEntity,
			});

			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const { actor, ...input } = body;
				let pipeline: PipelineWithStages;
				try {
					pipeline = (await repos.pipeline.create(input)) as PipelineWithStages;
				} catch (error: unknown) {
					if (isUniqueConstraintError(error)) {
						throw conflict(
							`Pipeline name "${body.name}" already exists for this version`,
						);
					}
					throw error;
				}

				await repos.pipelineAudit.append({
					pipelineId: pipeline.id,
					action: 'pipeline_created',
					actorType: actor.actorType,
					actorId: actor.actorId,
					displayName: actor.displayName,
				});

				return mapPipelineResponse(pipeline);
			} finally {
				await dispose();
			}
		},

		async updatePipeline(
			id: string,
			body: PipelineUpdateRequest,
		): Promise<PipelineResponse> {
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const existing = await repos.pipeline.findById(id);
				if (!existing) {
					throw notFound(`Pipeline ${id} not found`);
				}

				let pipeline = existing as PipelineWithStages;

				if (body.isActive === false) {
					pipeline = (await repos.pipeline.deactivate(id)) as PipelineWithStages;
					await repos.pipelineAudit.append({
						pipelineId: id,
						action: 'pipeline_deactivated',
						actorType: body.actor.actorType,
						actorId: body.actor.actorId,
						displayName: body.actor.displayName,
					});
				}

				if (body.description !== undefined) {
					pipeline = (await repos.pipeline.updateDescription(
						id,
						body.description,
					)) as PipelineWithStages;
					await repos.pipelineAudit.append({
						pipelineId: id,
						action: 'pipeline_updated',
						actorType: body.actor.actorType,
						actorId: body.actor.actorId,
						displayName: body.actor.displayName,
						metadata: { description: body.description },
					});
				}

				return mapPipelineResponse(pipeline);
			} finally {
				await dispose();
			}
		},

		async getPipeline(id: string): Promise<PipelineResponse> {
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const pipeline = await repos.pipeline.findById(id);
				if (!pipeline) {
					throw notFound(`Pipeline ${id} not found`);
				}
				return mapPipelineResponse(pipeline as PipelineWithStages);
			} finally {
				await dispose();
			}
		},

		async listPipelines() {
			const { repos, dispose } = createRequestDb(deps.databaseUrl);
			try {
				const pipelines = await repos.pipeline.listAll();
				return {
					pipelines: pipelines.map((pipeline) => ({
						id: pipeline.id,
						name: pipeline.name,
						flagKey: pipeline.flagKey,
						projectKey: pipeline.projectKey,
						stageCount: pipeline.stages.length,
						isActive: pipeline.isActive,
						version: pipeline.version,
					})),
				};
			} finally {
				await dispose();
			}
		},
	};
}

export type PipelineService = ReturnType<typeof createPipelineService>;
