import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLaunchDarklyProvider } from '@ff-promo/ld-adapter';
import nock from 'nock';

export const LD_BASE_URL = 'https://app.launchdarkly.com';
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

export function loadLdFixture(name: string) {
	return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
}

export function setupLdNockEnv() {
	process.env.LD_ACCESS_TOKEN = 'test-token';
	process.env.LD_BASE_URL = LD_BASE_URL;
	process.env.LD_API_VERSION = '20240415';
	createLaunchDarklyProvider({
		accessToken: 'test-token',
		baseUrl: LD_BASE_URL,
		apiVersion: '20240415',
	});
}

export function nockLdGetFlag(
	projectKey: string,
	flagKey: string,
	times = 1,
	fixture = 'ld-flag-boolean.json',
) {
	return nock(LD_BASE_URL)
		.get(`/api/v2/flags/${projectKey}/${flagKey}`)
		.times(times)
		.reply(200, loadLdFixture(fixture));
}

export function nockLdPatchFlag(
	projectKey: string,
	flagKey: string,
	onMatch?: (body: Record<string, unknown>) => void,
) {
	return nock(LD_BASE_URL)
		.patch(`/api/v2/flags/${projectKey}/${flagKey}`, (body) => {
			onMatch?.(body as Record<string, unknown>);
			return true;
		})
		.reply(200, loadLdFixture('ld-patch-success.json'));
}
