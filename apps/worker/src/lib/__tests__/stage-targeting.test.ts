import { describe, expect, it } from 'vitest';
import { mapLdFlagToFlagState } from '@ff-promo/ld-adapter';
import {
	buildGateRunContext,
	buildStageTargetingIntent,
	resolveStageVariationIds,
} from '../stage-targeting.js';

const rawFlag = {
	variations: [
		{ _id: 'var-off', value: false, name: 'Off' },
		{ _id: 'var-on', value: true, name: 'On' },
	],
	environments: {
		dev: {
			on: true,
			rules: [],
			fallthrough: { variation: 0 },
			offVariation: 0,
		},
	},
};

describe('stage-targeting', () => {
	const flagState = mapLdFlagToFlagState(rawFlag, 'default', 'demo-feature-flag');

	it('builds targeting intent with user context and 50/50 rollout', () => {
		const intent = buildStageTargetingIntent({ environment: 'dev' });
		expect(intent.environmentKey).toBe('dev');
		expect(intent.turnOn).toBe(true);
		expect(intent.rollout?.rolloutContextKind).toBe('user');
		expect(intent.rollout?.treatmentPercentThousandths).toBe(50_000);
		expect(intent.rollout?.mode).toBe('fallthrough');
	});

	it('resolves treatment and control variation ids', () => {
		const ids = resolveStageVariationIds(flagState);
		expect(ids.treatmentVariationId).toBe('var-on');
		expect(ids.controlVariationId).toBe('var-off');
	});

	it('builds gate run context', () => {
		const context = buildGateRunContext('demo-feature-flag', 'var-on', 'var-off');
		expect(context).toEqual({
			flagKey: 'demo-feature-flag',
			treatmentVariationId: 'var-on',
			controlVariationId: 'var-off',
		});
	});
});
