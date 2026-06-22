import {
  AuditEventInputSchema,
  type AuditEventInput,
} from '@ff-promo/contracts';
import { Prisma, type PrismaClient } from '../../generated/client/index.js';

export class AuditRepository {
  constructor(private readonly db: PrismaClient) {}

  async append(input: AuditEventInput) {
    const data = AuditEventInputSchema.parse(input);

    return this.db.auditEvent.create({
      data: {
        promotionRunId: data.promotionRunId,
        action: data.action,
        actorType: data.actorType,
        actorId: data.actorId,
        displayName: data.displayName,
        gateResultId: data.gateResultId,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async findByRunId(
    promotionRunId: string,
    opts?: { limit?: number; cursor?: string },
  ) {
    return this.db.auditEvent.findMany({
      where: { promotionRunId },
      orderBy: { occurredAt: 'asc' },
      take: opts?.limit ?? 100,
      ...(opts?.cursor && {
        cursor: { id: opts.cursor },
        skip: 1,
      }),
      include: { gateResult: true },
    });
  }
}
