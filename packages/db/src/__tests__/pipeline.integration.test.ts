import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../client.js";
import { PipelineRepository } from "../repositories/pipeline.repository.js";
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
			name: "dev-staging-prod",
			flagKey: "checkout-v2",
			projectKey: "default",
			stages: [
				{
					orderIndex: 0,
					environment: "dev",
					displayName: "Development",
					gatePolicies: [
						{
							metricType: "error_rate",
							threshold: 0.01,
							serviceName: "checkout-api",
						},
					],
				},
				{
					orderIndex: 1,
					environment: "staging",
					displayName: "Staging",
					gatePolicies: [
						{
							metricType: "error_rate",
							threshold: 0.005,
							serviceName: "checkout-api",
						},
					],
				},
				{
					orderIndex: 2,
					environment: "prod",
					displayName: "Production",
					gatePolicies: [
						{
							metricType: "p95_latency_ms",
							threshold: 500,
							serviceName: "checkout-api",
						},
					],
				},
			],
		});

		expect(created.stages).toHaveLength(3);

		const loaded = await repo.findById(created.id);
		expect(loaded).not.toBeNull();
		expect(loaded!.stages.map((s) => s.environment)).toEqual([
			"dev",
			"staging",
			"prod",
		]);
		expect(loaded!.stages[0]!.gatePolicies).toHaveLength(1);
		expect(loaded!.stages[0]!.gatePolicies[0]!.metricType).toBe("error_rate");

		await db.$disconnect();
	});

	it("findByFlagKey returns pipelines matching flagKey", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new PipelineRepository(db);

		await repo.create({
			name: "flag-key-lookup",
			flagKey: "unique-flag-key",
			projectKey: "default",
			stages: [
				{
					orderIndex: 0,
					environment: "dev",
					displayName: "Dev",
					gatePolicies: [
						{
							metricType: "error_rate",
							threshold: 0.01,
							serviceName: "api",
						},
					],
				},
			],
		});

		const results = await repo.findByFlagKey("unique-flag-key");
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results.every((p) => p.flagKey === "unique-flag-key")).toBe(true);

		await db.$disconnect();
	});
});
