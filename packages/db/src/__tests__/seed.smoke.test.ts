import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seed } from "../seed.js";
import { createPrismaClient } from "../client.js";
import { PipelineRepository } from "../repositories/pipeline.repository.js";
import { PromotionRunRepository } from "../repositories/promotion-run.repository.js";
import {
	getTestDatabaseUrl,
	startTestDatabase,
	stopTestDatabase,
} from "./setup.js";

describe("seed smoke", () => {
	let dbUrl: string;
	let pipelineId: string;

	beforeAll(async () => {
		dbUrl = await startTestDatabase();
		await seed(dbUrl);

		const db = createPrismaClient(dbUrl);
		const pipeline = await db.pipeline.findUniqueOrThrow({
			where: { name_version: { name: "default-promotion", version: 1 } },
		});
		pipelineId = pipeline.id;
		await db.$disconnect();
	}, 120_000);

	afterAll(async () => {
		await stopTestDatabase();
	});

	it("returns pipeline with dev, staging, prod stages in order", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new PipelineRepository(db);

		const pipeline = await repo.findById(pipelineId);
		expect(pipeline).not.toBeNull();
		expect(pipeline!.stages.map((s) => s.environment)).toEqual([
			"dev",
			"staging",
			"prod",
		]);
		expect(pipeline!.stages.map((s) => s.orderIndex)).toEqual([0, 1, 2]);

		await db.$disconnect();
	});

	it("has error_rate and latency_p95 gate policies on each stage", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new PipelineRepository(db);

		const pipeline = await repo.findById(pipelineId);
		expect(pipeline).not.toBeNull();

		for (const stage of pipeline!.stages) {
			expect(stage.gatePolicies).toHaveLength(2);
			const metricTypes = stage.gatePolicies
				.map((p) => p.metricType)
				.sort();
			expect(metricTypes).toEqual(["error_rate", "latency_p95"]);
		}

		await db.$disconnect();
	});

	it("has a pending PromotionRun for the seeded pipeline", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const runRepo = new PromotionRunRepository(db);

		const pendingRuns = await runRepo.findByStatus("pending");
		const seededRun = pendingRuns.find((r) => r.pipelineId === pipelineId);

		expect(seededRun).toBeDefined();
		expect(seededRun!.flagKey).toBe("demo-feature-flag");
		expect(seededRun!.pipelineVersion).toBe(1);

		await db.$disconnect();
	});
});
