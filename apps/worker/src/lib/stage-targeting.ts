import type {
	FlagState,
	GatePolicyInput,
	GateRunContext,
	MetricType,
	TargetingIntent,
	VariationRef,
} from '@ff-promo/contracts';
import { resolveVariationId } from '@ff-promo/ld-adapter';

export const DEFAULT_TREATMENT_VARIATION_REF: VariationRef = {
	by: 'value',
	value: true,
};
export const DEFAULT_CONTROL_VARIATION_REF: VariationRef = {
	by: 'value',
	value: false,
};

type StageLike = {
	environment: string;
};

export function buildStageTargetingIntent(
	stage: StageLike,
	options?: {
		treatmentVariationRef?: VariationRef;
		controlVariationRef?: VariationRef;
		treatmentPercentThousandths?: number;
	},
): TargetingIntent {
	const treatmentVariationRef =
		options?.treatmentVariationRef ?? DEFAULT_TREATMENT_VARIATION_REF;
	const controlVariationRef =
		options?.controlVariationRef ?? DEFAULT_CONTROL_VARIATION_REF;

	return {
		environmentKey: stage.environment,
		turnOn: true,
		rollout: {
			mode: 'fallthrough',
			treatmentVariationRef,
			controlVariationRef,
			treatmentPercentThousandths:
				options?.treatmentPercentThousandths ?? 50_000,
			rolloutContextKind: 'user',
			rolloutBucketBy: 'key',
		},
	};
}

export function resolveStageVariationIds(
	flagState: FlagState,
	treatmentRef: VariationRef = DEFAULT_TREATMENT_VARIATION_REF,
	controlRef: VariationRef = DEFAULT_CONTROL_VARIATION_REF,
) {
	return {
		treatmentVariationId: resolveVariationId(flagState, treatmentRef),
		controlVariationId: resolveVariationId(flagState, controlRef),
	};
}

export function buildGateRunContext(
	flagKey: string,
	treatmentVariationId: string,
	controlVariationId: string,
): GateRunContext {
	return {
		flagKey,
		treatmentVariationId,
		controlVariationId,
	};
}

export function mapGatePolicies(
	policies: Array<{
		metricType: string;
		threshold: number;
		serviceName: string;
		comparisonMode?: string | null;
		windowSeconds?: number | null;
		minSampleSize?: number | null;
	}>,
): GatePolicyInput[] {
	return policies.map((policy) => ({
		metricType: policy.metricType as MetricType,
		threshold: policy.threshold,
		serviceName: policy.serviceName,
		comparisonMode: policy.comparisonMode ?? undefined,
		windowSeconds: policy.windowSeconds ?? undefined,
		minSampleSize: policy.minSampleSize ?? undefined,
	}));
}
