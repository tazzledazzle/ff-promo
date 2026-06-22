import type {
	ApplyTargetingInput,
	GetFlagStateInput,
	LaunchDarklyClientConfig,
} from '@ff-promo/contracts';
import {
	createLaunchDarklyClient,
	type LaunchDarklyRawClient,
} from '../client/ld-api-client.js';
import {
	createRateLimitedLdClient,
	type RateLimitedLdClient,
} from '../client/rate-limited-client.js';
import { getFlagState } from '../read/get-flag-state.js';
import type { FlagProvider } from './flag-provider.js';
import { applyTargeting } from '../write/apply-targeting.js';

export class LaunchDarklyProvider implements FlagProvider {
	constructor(
		private readonly rawClient: LaunchDarklyRawClient,
		private readonly rateLimitedClient: RateLimitedLdClient,
	) {}

	getFlagState(input: GetFlagStateInput) {
		return this.rateLimitedClient.schedule(() =>
			getFlagState({ client: this.rawClient }, input),
		);
	}

	applyTargeting(input: ApplyTargetingInput) {
		return applyTargeting({ rateLimitedClient: this.rateLimitedClient }, input);
	}
}

export function createLaunchDarklyProvider(
	config: LaunchDarklyClientConfig,
): LaunchDarklyProvider {
	const rawClient = createLaunchDarklyClient(config);
	const rateLimitedClient = createRateLimitedLdClient(rawClient);
	return new LaunchDarklyProvider(rawClient, rateLimitedClient);
}
