import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapLdFlagToFlagState } from '../read/mappers.js';
import { resolveRuleId } from '../resolve/rule-resolver.js';
import { UnresolvedRuleError } from '../errors/ld-adapter-error.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const flagState = mapLdFlagToFlagState(
	JSON.parse(readFileSync(join(fixturesDir, 'flag-boolean.json'), 'utf8')),
	'default',
	'sample-feature',
);

describe('resolveRuleId', () => {
	it('resolves rule by id from staging environment', () => {
		expect(
			resolveRuleId(flagState, 'staging', {
				by: 'id',
				id: 'rule-staging-1',
			}),
		).toBe('rule-staging-1');
	});

	it('throws when staging rule id used with production environmentKey', () => {
		expect(() =>
			resolveRuleId(flagState, 'production', {
				by: 'id',
				id: 'rule-staging-1',
			}),
		).toThrow(UnresolvedRuleError);
	});
});
