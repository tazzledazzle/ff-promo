import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "../client.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import { GateResultRepository } from "../repositories/gate-result.repository.js";
import { PipelineRepository } from "../repositories/pipeline.repository.js";
import { PromotionRunRepository } from "../repositories/promotion-run.repository.js";
import {
	getTestDatabaseUrl,
	startTestDatabase,
	stopTestDatabase,
} from "./setup.js";

describe("AuditRepository integration (SAFE-01)", () => {
	let dbUrl: string;
	let promotionRunId: string;
	let stageId: string;

	beforeAll(async () => {
		dbUrl = await startTestDatabase();

		const db = createPrismaClient(dbUrl);
		const pipelineRepo = new PipelineRepository(db);
		const runRepo = new PromotionRunRepository(db);

		const pipeline = await pipelineRepo.create({
			name: `audit-pipeline-${randomUUID()}`,
			flagKey: "audit-flag",
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
			flagKey: "audit-flag",
		});
		promotionRunId = run.id;

		await db.$disconnect();
	}, 120_000);

	afterAll(async () => {
		await stopTestDatabase();
	});

	it("append creates event with actorType, actorId, displayName, and auto-set occurredAt", async () => {
		const db = createPrismaClient(dbUrl);
		const repo = new AuditRepository(db);

		const before = Date.now();
		const event = await repo.append({
			promotionRunId,
			action: "run_started",
			actorType: "system",
			actorId: "orchestrator",
			displayName: "Promotion Orchestrator",
			metadata: { flagKey: "audit-flag", environment: "dev" },
		});
		const after = Date.now();

		expect(event.actorType).toBe("system");
		expect(event.actorId).toBe("orchestrator");
		expect(event.displayName).toBe("Promotion Orchestrator");
		expect(event.action).toBe("run_started");
		expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
		expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after + 1000);

		await db.$disconnect();
	});

	it("append with gateResultId links gate_evaluated milestone to GateResult per D-08", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const gateRepo = new GateResultRepository(db);
		const auditRepo = new AuditRepository(db);

		const gateResult = await gateRepo.create({
			promotionRunId,
			stageId,
			verdict: "fail",
			metricType: "error_rate",
			observedValue: 0.05,
			threshold: 0.01,
			metadata: {
				flagKey: "audit-flag",
				environment: "dev",
				stageIndex: 0,
			},
		});

		const event = await auditRepo.append({
			promotionRunId,
			action: "gate_evaluated",
			actorType: "system",
			actorId: "gate-evaluator",
			gateResultId: gateResult.id,
			metadata: {
				flagKey: "audit-flag",
				environment: "dev",
				stageIndex: 0,
				metricType: "error_rate",
				observedValue: 0.05,
				threshold: 0.01,
			},
		});

		expect(event.gateResultId).toBe(gateResult.id);

		await db.$disconnect();
	});

	it("findByRunId returns events ascending by occurredAt with gateResult included", async () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const auditRepo = new AuditRepository(db);

		await auditRepo.append({
			promotionRunId,
			action: "stage_entered",
			actorType: "system",
			actorId: "workflow",
			metadata: { stageIndex: 0 },
		});

		await new Promise((resolve) => setTimeout(resolve, 10));

		await auditRepo.append({
			promotionRunId,
			action: "run_paused",
			actorType: "user",
			actorId: "operator-1",
			displayName: "Alice Operator",
			metadata: { reason: "manual pause" },
		});

		const events = await auditRepo.findByRunId(promotionRunId);
		expect(events.length).toBeGreaterThanOrEqual(2);

		for (let i = 1; i < events.length; i++) {
			expect(events[i]!.occurredAt.getTime()).toBeGreaterThanOrEqual(
				events[i - 1]!.occurredAt.getTime(),
			);
		}

		const gateEvaluated = events.find((e) => e.action === "gate_evaluated");
		if (gateEvaluated) {
			expect(gateEvaluated.gateResult).not.toBeNull();
		}

		await db.$disconnect();
	});

	it("exposes append and findByRunId only — no update or delete per D-04", () => {
		const db = createPrismaClient(getTestDatabaseUrl()!);
		const repo = new AuditRepository(db);

		expect(typeof repo.append).toBe("function");
		expect(typeof repo.findByRunId).toBe("function");
		expect("update" in repo).toBe(false);
		expect("delete" in repo).toBe(false);
		expect("remove" in repo).toBe(false);

		const proto = Object.getPrototypeOf(repo);
		const methodNames = Object.getOwnPropertyNames(proto).filter(
			(name) => name !== "constructor" && typeof proto[name] === "function",
		);
		expect(methodNames.sort()).toEqual(["append", "findByRunId"]);
	});
});
