import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "../client.js";
import { GateResultRepository } from "../repositories/gate-result.repository.js";
import { PipelineRepository } from "../repositories/pipeline.repository.js";
import { PromotionRunRepository } from "../repositories/promotion-run.repository.js";
import {
	getTestDatabaseUrl,
	startTestDatabase,
	stopTestDatabase,
} from "./setup.js";

describe("GateResultRepository integration", () => {
	let dbUrl: string;
	let promotionRunId: string;
	let stageId: string;

	beforeAll(async () => {
		dbUrl = await startTestDatabase();

		const db = createPrismaClient(dbUrl);
		const pipelineRepo = new PipelineRepository(db);
		const runRepo = new PromotionRunRepository(db);

		const pipeline = await pipelineRepo.create({
			name: `gate-result-pipeline-${randomUUID()}`,
			flagKey: "gate-result-flag",
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
		stageId = pipeline.stages[0]!.id;

		const run = await runRepo.create({
			pipelineId: pipeline.id,
			flagKey: "gate-result-flag",
		});
		promotionRunId = run.id;

		await db.$disconnect();
	}, 120_000);

	afterAll(async () => {
		await stopTestDatabase();
	});

	it("create stores verdict, metricType, observedValue, threshold, and metadata JSON", async () => {
		const db = createPrismaClient(dbUrl);
		const repo = new GateResultRepository(db);

		const result = await repo.create({
			promotionRunId,
			stageId,
			verdict: "pass",
			metricType: "error_rate",
			observedValue: 0.002,
			threshold: 0.01,
			metadata: {
				flagKey: "gate-result-flag",
				environment: "dev",
				stageIndex: 0,
				serviceName: "api",
			},
		});

		expect(result.verdict).toBe("pass");
		expect(result.metricType).toBe("error_rate");
		expect(result.observedValue).toBe(0.002);
		expect(result.threshold).toBe(0.01);
		expect(result.metadata).toMatchObject({
			flagKey: "gate-result-flag",
			environment: "dev",
		});

		await db.$disconnect();
	});

	it("findByRunId returns results ordered by evaluatedAt desc", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new GateResultRepository(db);

		await repo.create({
			promotionRunId,
			stageId,
			verdict: "pass",
			metricType: "error_rate",
			observedValue: 0.001,
			threshold: 0.01,
			metadata: { order: "first" },
		});

		await new Promise((resolve) => setTimeout(resolve, 10));

		await repo.create({
			promotionRunId,
			stageId,
			verdict: "fail",
			metricType: "p95_latency_ms",
			observedValue: 600,
			threshold: 500,
			metadata: { order: "second" },
		});

		const results = await repo.findByRunId(promotionRunId);
		expect(results.length).toBeGreaterThanOrEqual(2);
		expect(
			results[0]!.evaluatedAt.getTime(),
		).toBeGreaterThanOrEqual(results[1]!.evaluatedAt.getTime());

		await db.$disconnect();
	});

	it("findByRunAndStage filters by promotionRunId and stageId", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new GateResultRepository(db);

		const results = await repo.findByRunAndStage(promotionRunId, stageId);
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results.every((r) => r.stageId === stageId)).toBe(true);

		await db.$disconnect();
	});
});
