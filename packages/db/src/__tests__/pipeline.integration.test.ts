import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "../client.js";
import { PipelineRepository } from "../repositories/pipeline.repository.js";
import { standardStages } from "./pipeline-fixtures.js";
import {
	getTestDatabaseUrl,
	startTestDatabase,
	stopTestDatabase,
} from "./setup.js";

describe("PipelineRepository integration", () => {
	let dbUrl: string;

	beforeAll(async () => {
		dbUrl = await startTestDatabase();
	}, 120_000);

	afterAll(async () => {
		await stopTestDatabase();
	});

	it("persists pipeline with 3 stages and gate policies; findById returns nested stages ordered by orderIndex", async () => {
		const db = createPrismaClient(dbUrl);
		const repo = new PipelineRepository(db);

		const created = await repo.create({
			name: `dev-staging-prod-${randomUUID()}`,
			flagKey: "checkout-v2",
			projectKey: "default",
			stages: standardStages("checkout-api"),
		});

		expect(created.stages).toHaveLength(3);

		const loaded = await repo.findById(created.id);
		expect(loaded).not.toBeNull();
		expect(loaded!.stages.map((s) => s.environment)).toEqual([
			"dev",
			"staging",
			"prod",
		]);
		expect(loaded!.stages[0]!.gatePolicies).toHaveLength(2);
		expect(loaded!.stages[0]!.gatePolicies[0]!.metricType).toBe("error_rate");

		await db.$disconnect();
	});

	it("findByFlagKey returns pipelines matching flagKey", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new PipelineRepository(db);

		const flagKey = `unique-flag-key-${randomUUID()}`;
		await repo.create({
			name: `flag-key-lookup-${randomUUID()}`,
			flagKey,
			projectKey: "default",
			stages: [
				{
					orderIndex: 0,
					environment: "dev",
					displayName: "Dev",
					gatePolicies: standardStages()[0]!.gatePolicies,
				},
			],
		});

		const results = await repo.findByFlagKey(flagKey);
		expect(results.length).toBe(1);
		expect(results.every((p) => p.flagKey === flagKey)).toBe(true);

		await db.$disconnect();
	});

	it("deactivate sets isActive false", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new PipelineRepository(db);

		const created = await repo.create({
			name: `deactivate-${randomUUID()}`,
			flagKey: "deactivate-flag",
			projectKey: "default",
			stages: standardStages(),
		});

		const deactivated = await repo.deactivate(created.id);
		expect(deactivated.isActive).toBe(false);
		expect(deactivated.stages).toHaveLength(3);

		await db.$disconnect();
	});

	it("listAll includes deactivated pipelines", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new PipelineRepository(db);
		const name = `list-all-${randomUUID()}`;

		const created = await repo.create({
			name,
			flagKey: `list-all-${randomUUID()}`,
			projectKey: "default",
			stages: standardStages(),
		});
		await repo.deactivate(created.id);

		const all = await repo.listAll();
		const item = all.find((p) => p.id === created.id);
		expect(item).toBeDefined();
		expect(item!.isActive).toBe(false);

		await db.$disconnect();
	});

	it("resolveNextVersion increments after second create with same name", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new PipelineRepository(db);
		const name = `version-bump-${randomUUID()}`;

		const first = await repo.create({
			name,
			flagKey: `v1-${randomUUID()}`,
			projectKey: "default",
			stages: standardStages(),
		});
		expect(first.version).toBe(1);

		const second = await repo.create({
			name,
			flagKey: `v2-${randomUUID()}`,
			projectKey: "default",
			stages: standardStages(),
		});
		expect(second.version).toBe(2);

		const next = await repo.resolveNextVersion(name);
		expect(next).toBe(3);

		await db.$disconnect();
	});
});
