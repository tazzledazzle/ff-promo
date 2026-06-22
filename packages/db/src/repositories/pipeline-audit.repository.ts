import type { ActorType, Prisma, PrismaClient } from '../../generated/client/index.js';

export type PipelineConfigAction =
	| 'pipeline_created'
	| 'pipeline_deactivated'
	| 'pipeline_updated';

export class PipelineAuditRepository {
	constructor(private readonly db: PrismaClient) {}

	async append(input: {
		pipelineId: string;
		action: PipelineConfigAction;
		actorType: ActorType;
		actorId: string;
		displayName?: string;
		metadata?: Prisma.InputJsonValue;
	}) {
		return this.db.pipelineConfigAudit.create({
			data: {
				pipelineId: input.pipelineId,
				action: input.action,
				actorType: input.actorType,
				actorId: input.actorId,
				displayName: input.displayName,
				metadata: input.metadata ?? {},
			},
		});
	}

	async findByPipelineId(pipelineId: string) {
		return this.db.pipelineConfigAudit.findMany({
			where: { pipelineId },
			orderBy: { occurredAt: 'asc' },
		});
	}
}
