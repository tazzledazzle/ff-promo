package com.ffpromo.db

import com.ffpromo.contracts.AuditAction
import com.ffpromo.contracts.AuditEventInput
import com.ffpromo.contracts.ActorType
import com.ffpromo.contracts.GateResultCreateInput
import com.ffpromo.contracts.GateVerdict
import com.ffpromo.contracts.PipelineCreateInput
import com.ffpromo.db.fixtures.singleDevStage
import com.ffpromo.db.repositories.AuditRepository
import com.ffpromo.db.repositories.CreatePromotionRunInput
import com.ffpromo.db.repositories.GateResultRepository
import com.ffpromo.db.repositories.PipelineRepository
import com.ffpromo.db.repositories.PromotionRunRepository
import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import java.util.UUID

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AuditRepositoryIntegrationTest {
    private lateinit var auditRepo: AuditRepository
    private lateinit var promotionRunId: String
    private lateinit var stageId: String

    @BeforeAll
    fun setUp() {
        TestDatabase.start()
        auditRepo = AuditRepository()

        val pipelineRepo = PipelineRepository()
        val runRepo = PromotionRunRepository()

        val pipeline = pipelineRepo.create(
            PipelineCreateInput(
                name = "audit-pipeline-${UUID.randomUUID()}",
                flagKey = "audit-flag",
                projectKey = "default",
                stages = singleDevStage(),
            ),
        )
        stageId = pipeline.stages[0].id

        val run = runRepo.create(
            CreatePromotionRunInput(pipelineId = pipeline.id, flagKey = "audit-flag"),
        )
        promotionRunId = run.id
    }

    @AfterAll
    fun tearDown() {
        TestDatabase.stop()
    }

    @Test
    fun `append creates event with actorType, actorId, displayName, and auto-set occurredAt`() {
        val before = System.currentTimeMillis()
        val event = auditRepo.append(
            AuditEventInput(
                promotionRunId = promotionRunId,
                action = AuditAction.run_started,
                actorType = ActorType.system,
                actorId = "orchestrator",
                displayName = "Promotion Orchestrator",
                metadata = mapOf(
                    "flagKey" to JsonPrimitive("audit-flag"),
                    "environment" to JsonPrimitive("dev"),
                ),
            ),
        )
        val after = System.currentTimeMillis()

        assertEquals(ActorType.system, event.actorType)
        assertEquals("orchestrator", event.actorId)
        assertEquals("Promotion Orchestrator", event.displayName)
        assertEquals(AuditAction.run_started, event.action)
        assertTrue(event.occurredAt.toEpochMilli() >= before)
        assertTrue(event.occurredAt.toEpochMilli() <= after + 1000)
    }

    @Test
    fun `append with gateResultId links gate_evaluated milestone to GateResult per D-08`() {
        val gateRepo = GateResultRepository()

        val gateResult = gateRepo.create(
            GateResultCreateInput(
                promotionRunId = promotionRunId,
                stageId = stageId,
                verdict = GateVerdict.fail,
                metricType = "error_rate",
                observedValue = 0.05,
                threshold = 0.01,
                metadata = mapOf(
                    "flagKey" to JsonPrimitive("audit-flag"),
                    "environment" to JsonPrimitive("dev"),
                    "stageIndex" to JsonPrimitive(0),
                ),
            ),
        )

        val event = auditRepo.append(
            AuditEventInput(
                promotionRunId = promotionRunId,
                action = AuditAction.gate_evaluated,
                actorType = ActorType.system,
                actorId = "gate-evaluator",
                gateResultId = gateResult.id,
                metadata = mapOf(
                    "flagKey" to JsonPrimitive("audit-flag"),
                    "environment" to JsonPrimitive("dev"),
                    "stageIndex" to JsonPrimitive(0),
                    "metricType" to JsonPrimitive("error_rate"),
                    "observedValue" to JsonPrimitive(0.05),
                    "threshold" to JsonPrimitive(0.01),
                ),
            ),
        )

        assertEquals(gateResult.id, event.gateResultId)
    }

    @Test
    fun `findByRunId returns events ascending by occurredAt with gateResult included`() {
        auditRepo.append(
            AuditEventInput(
                promotionRunId = promotionRunId,
                action = AuditAction.stage_entered,
                actorType = ActorType.system,
                actorId = "workflow",
                metadata = mapOf("stageIndex" to JsonPrimitive(0)),
            ),
        )

        Thread.sleep(10)

        auditRepo.append(
            AuditEventInput(
                promotionRunId = promotionRunId,
                action = AuditAction.run_paused,
                actorType = ActorType.user,
                actorId = "operator-1",
                displayName = "Alice Operator",
                metadata = mapOf("reason" to JsonPrimitive("manual pause")),
            ),
        )

        val events = auditRepo.findByRunId(promotionRunId)
        assertTrue(events.size >= 2)

        for (i in 1 until events.size) {
            assertTrue(events[i].occurredAt >= events[i - 1].occurredAt)
        }

        val gateEvaluated = events.find { it.action == AuditAction.gate_evaluated }
        if (gateEvaluated != null) {
            assertNotNull(gateEvaluated.gateResult)
        }
    }

    @Test
    fun `exposes append and findByRunId only — no update or delete per D-04`() {
        val methods = AuditRepository::class.java.declaredMethods
            .filter { it.name != "equals" && it.name != "hashCode" && it.name != "toString" }
            .map { it.name }
            .sorted()

        assertEquals(listOf("append", "findByRunId"), methods)
        assertFalse(AuditRepository::class.java.methods.any { it.name == "update" })
        assertFalse(AuditRepository::class.java.methods.any { it.name == "delete" })
        assertFalse(AuditRepository::class.java.methods.any { it.name == "remove" })
    }
}
