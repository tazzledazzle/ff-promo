import {
	PipelineCreateInputSchema,
	type PipelineCreateInput,
} from '@ff-promo/contracts';
import type { PrismaClient } from '../../generated/client/index.js';

export class PipelineRepository {
	constructor(private readonly db: PrismaClient) {}

	async resolveNextVersion(name: string): Promise<number> {
		const result = await this.db.pipeline.aggregate({
			where: { name },
			_max: { version: true },
		});
		return (result._max.version ?? 0) + 1;
	}

	async create(input: PipelineCreateInput) {
		const data = PipelineCreateInputSchema.parse(input);
		const version =
			data.version ?? (await this.resolveNextVersion(data.name));

		return this.db.pipeline.create({
			data: {
				name: data.name,
				flagKey: data.flagKey,
				projectKey: data.projectKey,
				description: data.description,
				version,
				stages: {
					create: data.stages.map((stage) => ({
						orderIndex: stage.orderIndex,
						environment: stage.environment,
						displayName: stage.displayName,
						gatePolicies: {
							create: stage.gatePolicies.map((policy) => ({
								metricType: policy.metricType,
								threshold: policy.threshold,
								serviceName: policy.serviceName,
								comparisonMode: policy.comparisonMode ?? 'absolute',
								windowSeconds: policy.windowSeconds ?? 300,
								minSampleSize: policy.minSampleSize ?? 0,
							})),
						},
					})),
				},
			},
			include: {
				stages: {
					orderBy: { orderIndex: 'asc' },
					include: { gatePolicies: true },
				},
			},
		});
	}

	async findById(id: string) {
		return this.db.pipeline.findUnique({
			where: { id },
			include: {
				stages: {
					orderBy: { orderIndex: 'asc' },
					include: { gatePolicies: true },
				},
			},
		});
	}

	async findByFlagKey(flagKey: string) {
		return this.db.pipeline.findMany({
			where: { flagKey, isActive: true },
			include: {
				stages: {
					orderBy: { orderIndex: 'asc' },
					include: { gatePolicies: true },
				},
			},
		});
	}

	async listActive() {
		return this.db.pipeline.findMany({
			where: { isActive: true },
			orderBy: { name: 'asc' },
			include: {
				stages: {
					select: { id: true },
				},
			},
		});
	}

	async listAll() {
		return this.db.pipeline.findMany({
			orderBy: { name: 'asc' },
			include: {
				stages: {
					select: { id: true },
				},
			},
		});
	}

	async deactivate(id: string) {
		return this.db.pipeline.update({
			where: { id },
			data: { isActive: false },
			include: {
				stages: {
					orderBy: { orderIndex: 'asc' },
					include: { gatePolicies: true },
				},
			},
		});
	}

	async updateDescription(id: string, description: string) {
		return this.db.pipeline.update({
			where: { id },
			data: { description },
			include: {
				stages: {
					orderBy: { orderIndex: 'asc' },
					include: { gatePolicies: true },
				},
			},
		});
	}
}
