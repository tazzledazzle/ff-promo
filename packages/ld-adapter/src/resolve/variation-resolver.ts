import type { FlagState, VariationRef } from '@ff-promo/contracts';
import { UnresolvedVariationError } from '../errors/ld-adapter-error.js';

function valuesEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function resolveVariationId(
	flagState: FlagState,
	ref: VariationRef,
): string {
	const matches = flagState.variations.filter((variation) => {
		switch (ref.by) {
			case 'id':
				return variation.id === ref.id;
			case 'name':
				return variation.name === ref.name;
			case 'value':
				return valuesEqual(variation.value, ref.value);
			default:
				return false;
		}
	});

	if (matches.length !== 1) {
		throw new UnresolvedVariationError(
			`Expected exactly one variation match, found ${matches.length}`,
			{ ref, flagKey: flagState.flagKey, projectKey: flagState.projectKey },
		);
	}

	const match = matches[0];
	if (!match?.id) {
		throw new UnresolvedVariationError('Matched variation is missing id', {
			ref,
			flagKey: flagState.flagKey,
		});
	}

	return match.id;
}
