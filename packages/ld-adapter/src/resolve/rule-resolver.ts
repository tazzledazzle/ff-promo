import type { FlagState, RuleRef } from '@ff-promo/contracts';
import { UnresolvedRuleError } from '../errors/ld-adapter-error.js';

export function resolveRuleId(
	flagState: FlagState,
	environmentKey: string,
	ref: RuleRef,
): string {
	const env = flagState.environments[environmentKey];
	if (!env) {
		throw new UnresolvedRuleError(
			`Environment not found for rule resolution: ${environmentKey}`,
			{ environmentKey, flagKey: flagState.flagKey, ref },
		);
	}

	const matches = env.rules.filter((rule) => {
		switch (ref.by) {
			case 'id':
				return rule.id === ref.id;
			case 'description':
				return rule.description === ref.description;
			default:
				return false;
		}
	});

	if (matches.length !== 1) {
		throw new UnresolvedRuleError(
			`Expected exactly one rule match in ${environmentKey}, found ${matches.length}`,
			{ environmentKey, ref, flagKey: flagState.flagKey },
		);
	}

	const match = matches[0];
	if (!match?.id) {
		throw new UnresolvedRuleError('Matched rule is missing id', {
			environmentKey,
			ref,
		});
	}

	return match.id;
}
