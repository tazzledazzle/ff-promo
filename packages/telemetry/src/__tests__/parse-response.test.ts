import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseInstantQueryResult } from '../query/parse-response.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(name: string) {
	return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
}

describe('parseInstantQueryResult', () => {
	it('parses vector with sample value', () => {
		const result = parseInstantQueryResult(loadFixture('prometheus-vector-pass.json'));
		expect(result).toEqual({ ok: true, value: 0.02 });
	});

	it('parses scalar result type', () => {
		const result = parseInstantQueryResult(loadFixture('prometheus-scalar-pass.json'));
		expect(result).toEqual({ ok: true, value: 0.015 });
	});

	it('fails closed on empty vector', () => {
		const result = parseInstantQueryResult(loadFixture('prometheus-vector-empty.json'));
		expect(result).toEqual({ ok: false, reason: 'no_data' });
	});

	it('fails closed on NaN sample', () => {
		const result = parseInstantQueryResult(loadFixture('prometheus-nan-value.json'));
		expect(result).toEqual({ ok: false, reason: 'non_finite_value' });
	});
});
