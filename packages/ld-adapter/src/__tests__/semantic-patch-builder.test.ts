import { describe, expect, it } from 'vitest';
import { buildRolloutWeights, buildTargetingPatchBody } from '../write/semantic-patch.js';

describe('semantic patch builders', () => {
	it('buildRolloutWeights returns weights summing to 100000', () => {
		const weights = buildRolloutWeights(10_000, 'var-on', 'var-off');
		expect(weights).toEqual({ 'var-on': 10_000, 'var-off': 90_000 });
		expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBe(100_000);
	});

	it('buildTargetingPatchBody for fallthrough emits turnFlagOn + updateFallthroughVariationOrRollout', () => {
		const body = buildTargetingPatchBody(
			{
				environmentKey: 'production',
				rollout: {
					mode: 'fallthrough',
					treatmentVariationRef: { by: 'id', id: 'var-on' },
					controlVariationRef: { by: 'id', id: 'var-off' },
					treatmentPercentThousandths: 10_000,
					rolloutContextKind: 'user',
					rolloutBucketBy: 'user',
				},
			},
			{
				treatmentVariationId: 'var-on',
				controlVariationId: 'var-off',
			},
		);

		expect(body.instructions.map((i) => i.kind)).toEqual([
			'turnFlagOn',
			'updateFallthroughVariationOrRollout',
		]);
		expect(body.instructions[1]).toMatchObject({
			rolloutBucketBy: 'user',
			rolloutContextKind: 'user',
		});
	});

	it('never includes updatePercentageRollout instruction kind', () => {
		const body = buildTargetingPatchBody(
			{
				environmentKey: 'production',
				rollout: {
					mode: 'fallthrough',
					treatmentVariationRef: { by: 'id', id: 'a' },
					controlVariationRef: { by: 'id', id: 'b' },
					treatmentPercentThousandths: 50_000,
					rolloutContextKind: 'user',
					rolloutBucketBy: 'user',
				},
			},
			{ treatmentVariationId: 'a', controlVariationId: 'b' },
		);
		for (const instruction of body.instructions) {
			expect(instruction.kind).not.toBe('updatePercentageRollout');
		}
	});
});
