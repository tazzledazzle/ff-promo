import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../client.js";
import { seed } from "../seed.js";
import { startTestDatabase, stopTestDatabase } from "./setup.js";

describe("seed script integration", () => {
	let dbUrl: string;

	beforeAll(async () => {
		dbUrl = await startTestDatabase();
	}, 120_000);

	afterAll(async () => {
		await stopTestDatabase();
	});

	it("runs seed without error and creates at least one pipeline", async () => {
		await expect(seed(dbUrl)).resolves.toBeUndefined();

		const db = createPrismaClient(dbUrl);
		const pipelineCount = await db.pipeline.count();
		expect(pipelineCount).toBeGreaterThanOrEqual(1);
		await db.$disconnect();
	});

	it("runs seed twice without duplicate constraint errors", async () => {
		await expect(seed(dbUrl)).resolves.toBeUndefined();
		await expect(seed(dbUrl)).resolves.toBeUndefined();

		const db = createPrismaClient(dbUrl);
		const pipelines = await db.pipeline.findMany({
			where: { name: "default-promotion", version: 1 },
		});
		expect(pipelines).toHaveLength(1);

		const pendingRuns = await db.promotionRun.findMany({
			where: { pipelineId: pipelines[0]!.id, status: "pending" },
		});
		expect(pendingRuns).toHaveLength(1);
		await db.$disconnect();
	});
});
