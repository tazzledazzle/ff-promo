import { FlagStateSchema, type FlagState } from '@ff-promo/contracts';

type LdVariation = {
	_id?: string;
	name?: string;
	value: unknown;
};

type LdRule = {
	_id?: string;
	description?: string;
	clauses?: unknown[];
	variationOrRollout?: unknown;
};

type LdEnvironment = {
	on?: boolean;
	rules?: LdRule[];
	fallthrough?: unknown;
	offVariation?: number;
	targets?: unknown[];
};

type LdFlagResponse = {
	variations?: LdVariation[];
	environments?: Record<string, LdEnvironment>;
};

export function mapLdFlagToFlagState(
	rawLdFlag: LdFlagResponse,
	projectKey: string,
	flagKey: string,
): FlagState {
	const environments: FlagState['environments'] = {};

	for (const [envKey, env] of Object.entries(rawLdFlag.environments ?? {})) {
		environments[envKey] = {
			on: env.on ?? false,
			rules: (env.rules ?? []).map((rule) => ({
				id: rule._id ?? '',
				description: rule.description,
				clauses: rule.clauses ?? [],
				variationOrRollout: rule.variationOrRollout ?? null,
			})),
			fallthrough: env.fallthrough ?? null,
			offVariation: env.offVariation,
			targets: env.targets,
		};
	}

	return FlagStateSchema.parse({
		projectKey,
		flagKey,
		variations: (rawLdFlag.variations ?? []).map((variation) => ({
			id: variation._id ?? '',
			name: variation.name,
			value: variation.value,
		})),
		environments,
	});
}
