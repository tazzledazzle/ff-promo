import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapLdFlagToFlagState } from '../read/mappers.js';
import { resolveVariationId } from '../resolve/variation-resolver.js';
import { UnresolvedVariationError } from '../errors/ld-adapter-error.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const flagState = mapLdFlagToFlagState(
	JSON.parse(readFileSync(join(fixturesDir, 'flag-boolean.json'), 'utf8')),
	'default',
	'sample-feature',
);

describe('resolveVariationId', () => {
	it('resolves by value when exactly one match', () => {
		expect(resolveVariationId(flagState, { by: 'value', value: true })).toBe(
			'var-on',
		);
	});

	it('resolves by name and by id', () => {
		expect(resolveVariationId(flagState, { by: 'name', name: 'Off' })).toBe(
			'var-off',
		);
		expect(resolveVariationId(flagState, { by: 'id', id: 'var-on' })).toBe(
			'var-on',
		);
	});

	it('throws UnresolvedVariationError when zero matches', () => {
		expect(() =>
			resolveVariationId(flagState, { by: 'value', value: 'missing' }),
		).toThrow(UnresolvedVariationError);
	});

	it('throws UnresolvedVariationError when ambiguous value match', () => {
		const ambiguous = {
			...flagState,
			variations: [
				{ id: 'a', value: true },
				{ id: 'b', value: true },
			],
		};
		expect(() =>
			resolveVariationId(ambiguous, { by: 'value', value: true }),
		).toThrow(UnresolvedVariationError);
	});
});
