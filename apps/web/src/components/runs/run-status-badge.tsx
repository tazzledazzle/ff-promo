import {
	PromotionStatusSchema,
	type PromotionStatus,
} from '@ff-promo/contracts';
import { Badge } from '@/components/ui/badge';

const STATUS_VARIANT: Record<
	PromotionStatus,
	'default' | 'secondary' | 'destructive' | 'outline'
> = {
	pending: 'outline',
	active: 'default',
	paused: 'secondary',
	completed: 'outline',
	aborted: 'destructive',
};

export function RunStatusBadge({ status }: { status: PromotionStatus }) {
	return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}

export const ALL_PROMOTION_STATUSES = PromotionStatusSchema.options;
