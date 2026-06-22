import { createPrismaClient, type GatePolicy, type Pipeline, type PromotionRun, type Stage } from '@ff-promo/db';
import type { GatePolicyInput } from '@ff-promo/contracts';
import { mapGatePolicies } from './stage-targeting.js';

type StageWithPolicies = Stage & { gatePolicies: GatePolicy[] };
type PipelineWithStages = Pipeline & { stages: StageWithPolicies[] };
type RunWithPipeline = PromotionRun & { pipeline: PipelineWithStages };

export type LoadedRunStageContext = {
	run: RunWithPipeline;
	pipeline: PipelineWithStages;
	stages: StageWithPolicies[];
	stage: StageWithPolicies;
	gatePolicies: GatePolicyInput[];
	projectKey: string;
	flagKey: string;
};

export type LoadedAllGatePoliciesContext = {
	run: RunWithPipeline;
	pipeline: PipelineWithStages;
	stages: StageWithPolicies[];
	gatePolicies: GatePolicyInput[];
	projectKey: string;
	flagKey: string;
};

export async function loadRunStageContext(
	promotionRunId: string,
	stageIndex: number,
	databaseUrl = process.env.DATABASE_URL,
): Promise<LoadedRunStageContext> {
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is required for loadRunStageContext');
	}

	const db = createPrismaClient(databaseUrl);
	try {
		const run = await db.promotionRun.findUniqueOrThrow({
			where: { id: promotionRunId },
			include: {
				pipeline: {
					include: {
						stages: {
							orderBy: { orderIndex: 'asc' },
							include: { gatePolicies: true },
						},
					},
				},
			},
		});

		const stage = run.pipeline.stages.find((s) => s.orderIndex === stageIndex);
		if (!stage) {
			throw new Error(
				`Stage orderIndex ${stageIndex} not found for run ${promotionRunId}`,
			);
		}

		return {
			run,
			pipeline: run.pipeline,
			stages: run.pipeline.stages,
			stage,
			gatePolicies: mapGatePolicies(stage.gatePolicies),
			projectKey: run.pipeline.projectKey,
			flagKey: run.flagKey,
		};
	} finally {
		await db.$disconnect();
	}
}

export async function loadAllGatePolicies(
	promotionRunId: string,
	databaseUrl = process.env.DATABASE_URL,
): Promise<LoadedAllGatePoliciesContext> {
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is required for loadAllGatePolicies');
	}

	const db = createPrismaClient(databaseUrl);
	try {
		const run = await db.promotionRun.findUniqueOrThrow({
			where: { id: promotionRunId },
			include: {
				pipeline: {
					include: {
						stages: {
							orderBy: { orderIndex: 'asc' },
							include: { gatePolicies: true },
						},
					},
				},
			},
		});

		const policies = run.pipeline.stages.flatMap((stage) =>
			mapGatePolicies(stage.gatePolicies),
		);

		return {
			run,
			pipeline: run.pipeline,
			stages: run.pipeline.stages,
			gatePolicies: policies,
			projectKey: run.pipeline.projectKey,
			flagKey: run.flagKey,
		};
	} finally {
		await db.$disconnect();
	}
}
