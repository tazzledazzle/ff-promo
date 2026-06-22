import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapLdFlagToFlagState } from '../read/mappers.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('mapLdFlagToFlagState', () => {
	it('maps boolean flag fixture with variations, rules, and environment state', () => {
		const raw = JSON.parse(
			readFileSync(join(fixturesDir, 'flag-boolean.json'), 'utf8'),
		);
		const flagState = mapLdFlagToFlagState(raw, 'default', 'sample-feature');

		expect(flagState.variations).toHaveLength(2);
		expect(flagState.variations[0]).toMatchObject({
			id: 'var-off',
			value: false,
			name: 'Off',
		});
		expect(flagState.environments.production?.on).toBe(true);
		expect(flagState.environments.production?.rules[0]?.id).toBe('rule-prod-1');
		expect(flagState.environments.staging?.on).toBe(false);
	});

	it('maps multivariate flag fixture with named variations', () => {
		const raw = JSON.parse(
			readFileSync(join(fixturesDir, 'flag-multivariate.json'), 'utf8'),
		);
		const flagState = mapLdFlagToFlagState(
			raw,
			'default',
			'multivariate-flag',
		);

		expect(flagState.variations.map((v) => v.name)).toEqual([
			'Control',
			'Treatment',
			'Variant C',
		]);
	});
});
