import {
	GetFlagStateInputSchema,
	type FlagEnvironmentState,
	type FlagState,
} from '@ff-promo/contracts';
import type { LaunchDarklyRawClient } from '../client/ld-api-client.js';
import { LdApiError } from '../errors/ld-adapter-error.js';
import { mapLdFlagToFlagState } from './mappers.js';

export type GetFlagStateDeps = {
	client: LaunchDarklyRawClient;
};

function promisifyGetFeatureFlag(
	client: LaunchDarklyRawClient,
	projectKey: string,
	flagKey: string,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		client.flagsApi.getFeatureFlag(projectKey, flagKey, {}, (error, data) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(data);
		});
	});
}

export function getEnvironmentState(
	flagState: FlagState,
	environmentKey: string,
): FlagEnvironmentState {
	const env = flagState.environments[environmentKey];
	if (!env) {
		throw new LdApiError(
			`Environment not found in flag state: ${environmentKey}`,
			404,
			undefined,
			{
				projectKey: flagState.projectKey,
				flagKey: flagState.flagKey,
				environmentKey,
			},
		);
	}
	return env;
}

export async function getFlagState(
	deps: GetFlagStateDeps,
	input: {
		projectKey: string;
		flagKey: string;
		environmentKey: string;
	},
): Promise<FlagState> {
	const parsed = GetFlagStateInputSchema.parse(input);
	const raw = await promisifyGetFeatureFlag(
		deps.client,
		parsed.projectKey,
		parsed.flagKey,
	);
	const flagState = mapLdFlagToFlagState(
		raw as Parameters<typeof mapLdFlagToFlagState>[0],
		parsed.projectKey,
		parsed.flagKey,
	);
	getEnvironmentState(flagState, parsed.environmentKey);
	return flagState;
}
