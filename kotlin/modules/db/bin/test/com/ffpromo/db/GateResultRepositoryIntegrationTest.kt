package com.ffpromo.db

import com.ffpromo.contracts.GateResultCreateInput
import com.ffpromo.contracts.GateVerdict
import com.ffpromo.contracts.PipelineCreateInput
import com.ffpromo.db.fixtures.singleDevStage
import com.ffpromo.db.repositories.CreatePromotionRunInput
import com.ffpromo.db.repositories.GateResultRepository
import com.ffpromo.db.repositories.PipelineRepository
import com.ffpromo.db.repositories.PromotionRunRepository
import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import java.util.UUID

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class GateResultRepositoryIntegrationTest {
    private lateinit var repo: GateResultRepository
    private lateinit var promotionRunId: String
    private lateinit var stageId: String

    @BeforeAll
    fun setUp() {
        TestDatabase.start()
        repo = GateResultRepository()

        val pipelineRepo = PipelineRepository()
        val runRepo = PromotionRunRepository()

        val pipeline = pipelineRepo.create(
            PipelineCreateInput(
                name = "gate-result-pipeline-${UUID.randomUUID()}",
                flagKey = "gate-result-flag",
                projectKey = "default",
                stages = singleDevStage(),
            ),
        )
        stageId = pipeline.stages[0].id

        val run = runRepo.create(
            CreatePromotionRunInput(pipelineId = pipeline.id, flagKey = "gate-result-flag"),
        )
        promotionRunId = run.id
    }

    @AfterAll
    fun tearDown() {
        TestDatabase.stop()
    }

    @Test
    fun `create stores verdict, metricType, observedValue, threshold, and metadata JSON`() {
        val result = repo.create(
            GateResultCreateInput(
                promotionRunId = promotionRunId,
                stageId = stageId,
                verdict = GateVerdict.pass,
                metricType = "error_rate",
                observedValue = 0.002,
                threshold = 0.01,
                metadata = mapOf(
                    "flagKey" to JsonPrimitive("gate-result-flag"),
                    "environment" to JsonPrimitive("dev"),
                    "stageIndex" to JsonPrimitive(0),
                    "serviceName" to JsonPrimitive("api"),
                ),
            ),
        )

        assertEquals(GateVerdict.pass, result.verdict)
        assertEquals("error_rate", result.metricType)
        assertEquals(0.002, result.observedValue)
        assertEquals(0.01, result.threshold)
        assertEquals("gate-result-flag", result.metadata["flagKey"]?.toString()?.trim('"'))
        assertEquals("dev", result.metadata["environment"]?.toString()?.trim('"'))
    }

    @Test
    fun `findByRunId returns results ordered by evaluatedAt desc`() {
        repo.create(
            GateResultCreateInput(
                promotionRunId = promotionRunId,
                stageId = stageId,
                verdict = GateVerdict.pass,
                metricType = "error_rate",
                observedValue = 0.001,
                threshold = 0.01,
                metadata = mapOf("order" to JsonPrimitive("first")),
            ),
        )

        Thread.sleep(10)

        repo.create(
            GateResultCreateInput(
                promotionRunId = promotionRunId,
                stageId = stageId,
                verdict = GateVerdict.fail,
                metricType = "latency_p95",
                observedValue = 600.0,
                threshold = 500.0,
                metadata = mapOf("order" to JsonPrimitive("second")),
            ),
        )

        val results = repo.findByRunId(promotionRunId)
        assertTrue(results.size >= 2)
        assertTrue(results[0].evaluatedAt >= results[1].evaluatedAt)
    }

    @Test
    fun `findByRunAndStage filters by promotionRunId and stageId`() {
        val results = repo.findByRunAndStage(promotionRunId, stageId)
        assertTrue(results.size >= 1)
        assertTrue(results.all { it.stageId == stageId })
    }
}
