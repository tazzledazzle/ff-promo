import { ApplyTargetingInputSchema, type TargetingIntent } from '@ff-promo/contracts';
import type { FlagState } from '@ff-promo/contracts';
import {
	SEMANTIC_PATCH_CONTENT_TYPE,
	type LaunchDarklyRawClient,
} from '../client/ld-api-client.js';
import type { RateLimitedLdClient } from '../client/rate-limited-client.js';
import { getFlagState } from '../read/get-flag-state.js';
import { resolveRuleId } from '../resolve/rule-resolver.js';
import { resolveVariationId } from '../resolve/variation-resolver.js';
import {
	buildTargetingPatchBody,
	type ResolvedRolloutIds,
} from './semantic-patch.js';

export type ApplyTargetingDeps = {
	rateLimitedClient: RateLimitedLdClient;
};

class HttpResponseError extends Error {
	readonly status: number;
	readonly response: {
		header: Record<string, string | string[] | undefined>;
		body?: unknown;
	};

	constructor(
		status: number,
		message: string,
		body?: unknown,
		headers?: Record<string, string | string[] | undefined>,
	) {
		super(message);
		this.name = 'HttpResponseError';
		this.status = status;
		this.response = { body, header: headers ?? {} };
	}
}

async function semanticPatchFeatureFlag(
	client: LaunchDarklyRawClient,
	projectKey: string,
	flagKey: string,
	body: Record<string, unknown>,
): Promise<unknown> {
	const url = `${client.config.baseUrl}/api/v2/flags/${encodeURIComponent(projectKey)}/${encodeURIComponent(flagKey)}`;
	const response = await fetch(url, {
		method: 'PATCH',
		headers: {
			Authorization: client.config.accessToken,
			'LD-API-Version': client.config.apiVersion,
			'Content-Type': SEMANTIC_PATCH_CONTENT_TYPE,
			Accept: 'application/json',
		},
		body: JSON.stringify(body),
	});

	const responseHeaders: Record<string, string> = {};
	for (const [key, value] of response.headers.entries()) {
		responseHeaders[key] = value;
	}

	const responseBody = await response.json().catch(() => undefined);
	if (!response.ok) {
		throw new HttpResponseError(
			response.status,
			`LaunchDarkly PATCH failed with status ${response.status}`,
			responseBody,
			responseHeaders,
		);
	}

	return responseBody;
}

export async function applyTargeting(
	deps: ApplyTargetingDeps,
	input: {
		projectKey: string;
		flagKey: string;
		intent: TargetingIntent;
	},
): Promise<FlagState> {
	const parsed = ApplyTargetingInputSchema.parse(input);
	const { rateLimitedClient } = deps;
	const { rawClient } = rateLimitedClient;

	const flagState = await rateLimitedClient.schedule(() =>
		getFlagState({ client: rawClient }, {
			projectKey: parsed.projectKey,
			flagKey: parsed.flagKey,
			environmentKey: parsed.intent.environmentKey,
		}),
	);

	let resolved: ResolvedRolloutIds | undefined;
	if (parsed.intent.rollout) {
		const rollout = parsed.intent.rollout;
		resolved = {
			treatmentVariationId: resolveVariationId(
				flagState,
				rollout.treatmentVariationRef,
			),
			controlVariationId: resolveVariationId(
				flagState,
				rollout.controlVariationRef,
			),
		};
		if (rollout.mode === 'rule') {
			if (!rollout.ruleRef) {
				throw new Error('ruleRef required when rollout.mode is rule');
			}
			resolved.ruleId = resolveRuleId(
				flagState,
				parsed.intent.environmentKey,
				rollout.ruleRef,
			);
		}
	}

	const patchBody = buildTargetingPatchBody(parsed.intent, resolved);

	await rateLimitedClient.schedule(() =>
		semanticPatchFeatureFlag(
			rawClient,
			parsed.projectKey,
			parsed.flagKey,
			patchBody,
		),
	);

	return rateLimitedClient.schedule(() =>
		getFlagState({ client: rawClient }, {
			projectKey: parsed.projectKey,
			flagKey: parsed.flagKey,
			environmentKey: parsed.intent.environmentKey,
		}),
	);
}
