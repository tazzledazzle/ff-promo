import type {
	ApplyTargetingInput,
	FlagState,
	GetFlagStateInput,
} from '@ff-promo/contracts';

export interface FlagProvider {
	getFlagState(input: GetFlagStateInput): Promise<FlagState>;
	applyTargeting(input: ApplyTargetingInput): Promise<FlagState>;
}
