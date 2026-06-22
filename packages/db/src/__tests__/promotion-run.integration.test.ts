import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "../client.js";
import { PipelineRepository } from "../repositories/pipeline.repository.js";
import { PromotionRunRepository } from "../repositories/promotion-run.repository.js";
import {
	getTestDatabaseUrl,
	startTestDatabase,
	stopTestDatabase,
} from "./setup.js";

describe("PromotionRunRepository integration", () => {
	let dbUrl: string;
	let pipelineId: string;

	beforeAll(async () => {
		dbUrl = await startTestDatabase();

		const db = createPrismaClient(dbUrl);
		const pipelineRepo = new PipelineRepository(db);
		const pipeline = await pipelineRepo.create({
			name: `run-test-pipeline-${randomUUID()}`,
			flagKey: "run-test-flag",
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
		pipelineId = pipeline.id;
		await db.$disconnect();
	}, 120_000);

	afterAll(async () => {
		await stopTestDatabase();
	});

	it("createRun snapshots pipelineVersion at creation and defaults status to pending", async () => {
		const db = createPrismaClient(dbUrl);
		const repo = new PromotionRunRepository(db);

		const run = await repo.create({
			pipelineId,
			flagKey: "run-test-flag",
		});

		expect(run.pipelineVersion).toBe(1);
		expect(run.status).toBe("pending");
		expect(run.currentStageIndex).toBe(0);
		expect(run.temporalWorkflowId).toBeNull();

		await db.$disconnect();
	});

	it("updateState changes status and currentStageIndex; sets temporalWorkflowId to run id on first active transition", async () => {
		const db = createPrismaClient(dbUrl);
		const repo = new PromotionRunRepository(db);

		const run = await repo.create({
			pipelineId,
			flagKey: "run-test-flag",
		});

		const updated = await repo.updateState({
			promotionRunId: run.id,
			status: "active",
			currentStageIndex: 0,
		});

		expect(updated.status).toBe("active");
		expect(updated.currentStageIndex).toBe(0);
		expect(updated.temporalWorkflowId).toBe(run.id);

		const paused = await repo.updateState({
			promotionRunId: run.id,
			status: "paused",
			pauseReason: "gate breach",
		});
		expect(paused.status).toBe("paused");
		expect(paused.pauseReason).toBe("gate breach");
		expect(paused.temporalWorkflowId).toBe(run.id);

		await db.$disconnect();
	});

	it("findById returns run after simulated disconnect/reconnect with new PrismaClient", async () => {
		const db1 = createPrismaClient(getTestDatabaseUrl()!);
		const repo1 = new PromotionRunRepository(db1);

		const run = await repo1.create({
			pipelineId,
			flagKey: "run-test-flag",
		});
		await db1.$disconnect();

		const db2 = createPrismaClient(getTestDatabaseUrl()!);
		const repo2 = new PromotionRunRepository(db2);

		const loaded = await repo2.findById(run.id);
		expect(loaded).not.toBeNull();
		expect(loaded!.id).toBe(run.id);
		expect(loaded!.flagKey).toBe("run-test-flag");

		await db2.$disconnect();
	});

	it("findByStatus returns runs matching status", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new PromotionRunRepository(db);

		await repo.create({ pipelineId, flagKey: "run-test-flag" });

		const pending = await repo.findByStatus("pending");
		expect(pending.length).toBeGreaterThanOrEqual(1);
		expect(pending.every((r) => r.status === "pending")).toBe(true);

		await db.$disconnect();
	});
});
