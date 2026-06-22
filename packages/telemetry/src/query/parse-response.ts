export type ParseResult =
	| { ok: true; value: number }
	| { ok: false; reason: 'no_data' | 'non_finite_value' };

type InstantQueryData = {
	resultType: string;
	result: unknown;
};

function parseSampleValue(valueString: string): ParseResult {
	if (valueString === 'NaN' || valueString === '+Inf' || valueString === '-Inf') {
		return { ok: false, reason: 'non_finite_value' };
	}
	const value = Number.parseFloat(valueString);
	if (!Number.isFinite(value)) {
		return { ok: false, reason: 'non_finite_value' };
	}
	return { ok: true, value };
}

function parseVectorResult(result: unknown): ParseResult {
	if (!Array.isArray(result) || result.length === 0) {
		return { ok: false, reason: 'no_data' };
	}
	const first = result[0] as { value?: [number, string] };
	if (!first?.value || first.value.length < 2) {
		return { ok: false, reason: 'no_data' };
	}
	return parseSampleValue(first.value[1]);
}

function parseScalarResult(result: unknown): ParseResult {
	if (!Array.isArray(result) || result.length < 2) {
		return { ok: false, reason: 'no_data' };
	}
	const valueString = result[1];
	if (typeof valueString !== 'string') {
		return { ok: false, reason: 'no_data' };
	}
	return parseSampleValue(valueString);
}

export function parseInstantQueryResult(data: InstantQueryData): ParseResult {
	if (data.resultType === 'vector') {
		return parseVectorResult(data.result);
	}
	if (data.resultType === 'scalar') {
		return parseScalarResult(data.result);
	}
	return { ok: false, reason: 'no_data' };
}
