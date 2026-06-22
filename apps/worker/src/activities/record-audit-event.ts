import { AuditEventInputSchema } from '@ff-promo/contracts';
import {
  AuditRepository,
  createPrismaClient,
  type AuditEvent,
} from '@ff-promo/db';

/**
 * Appends a milestone audit event (D-01). Requires DATABASE_URL.
 */
export async function recordAuditEvent(
  input: Parameters<AuditRepository['append']>[0],
): Promise<AuditEvent> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for recordAuditEvent activity');
  }

  const parsed = AuditEventInputSchema.parse(input);

  if (parsed.action === 'gate_evaluated' && !parsed.gateResultId) {
    throw new Error('gateResultId is required when action is gate_evaluated');
  }

  const db = createPrismaClient(databaseUrl);
  try {
    const repo = new AuditRepository(db);
    return await repo.append(parsed);
  } finally {
    await db.$disconnect();
  }
}
