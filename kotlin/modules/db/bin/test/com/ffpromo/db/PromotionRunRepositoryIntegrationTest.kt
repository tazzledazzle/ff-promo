package com.ffpromo.db

import com.ffpromo.contracts.PipelineCreateInput
import com.ffpromo.contracts.PromotionStatus
import com.ffpromo.db.fixtures.singleDevStage
import com.ffpromo.db.repositories.CreatePromotionRunInput
import com.ffpromo.db.repositories.PipelineRepository
import com.ffpromo.db.repositories.PromotionRunRepository
import com.ffpromo.db.repositories.UpdatePromotionRunStateInput
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import java.util.UUID

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PromotionRunRepositoryIntegrationTest {
    private lateinit var pipelineRepo: PipelineRepository
    private lateinit var repo: PromotionRunRepository
    private lateinit var pipelineId: String

    @BeforeAll
    fun setUp() {
        TestDatabase.start()
        pipelineRepo = PipelineRepository()
        repo = PromotionRunRepository()

        val pipeline = pipelineRepo.create(
            PipelineCreateInput(
                name = "run-test-pipeline-${UUID.randomUUID()}",
                flagKey = "run-test-flag",
                projectKey = "default",
                stages = singleDevStage(),
            ),
        )
        pipelineId = pipeline.id
    }

    @AfterAll
    fun tearDown() {
        TestDatabase.stop()
    }

    @Test
    fun `createRun snapshots pipelineVersion at creation and defaults status to pending`() {
        val run = repo.create(
            CreatePromotionRunInput(pipelineId = pipelineId, flagKey = "run-test-flag"),
        )

        assertEquals(1, run.pipelineVersion)
        assertEquals(PromotionStatus.pending, run.status)
        assertEquals(0, run.currentStageIndex)
        assertNull(run.temporalWorkflowId)
    }

    @Test
    fun `updateState changes status and currentStageIndex, sets temporalWorkflowId to run id on first active transition`() {
        val run = repo.create(
            CreatePromotionRunInput(pipelineId = pipelineId, flagKey = "run-test-flag"),
        )

        val updated = repo.updateState(
            UpdatePromotionRunStateInput(
                promotionRunId = run.id,
                status = PromotionStatus.active,
                currentStageIndex = 0,
            ),
        )

        assertEquals(PromotionStatus.active, updated.status)
        assertEquals(0, updated.currentStageIndex)
        assertEquals(run.id, updated.temporalWorkflowId)

        val paused = repo.updateState(
            UpdatePromotionRunStateInput(
                promotionRunId = run.id,
                status = PromotionStatus.paused,
                pauseReason = "gate breach",
            ),
        )
        assertEquals(PromotionStatus.paused, paused.status)
        assertEquals("gate breach", paused.pauseReason)
        assertEquals(run.id, paused.temporalWorkflowId)
    }

    @Test
    fun `findById returns run after simulated disconnect reconnect with new repository`() {
        val run = repo.create(
            CreatePromotionRunInput(pipelineId = pipelineId, flagKey = "run-test-flag"),
        )

        DatabaseFactory.close()
        TestDatabase.start()

        val loaded = PromotionRunRepository().findById(run.id)
        assertNotNull(loaded)
        assertEquals(run.id, loaded!!.id)
        assertEquals("run-test-flag", loaded.flagKey)
    }

    @Test
    fun `findByStatus returns runs matching status`() {
        repo.create(CreatePromotionRunInput(pipelineId = pipelineId, flagKey = "run-test-flag"))

        val pending = repo.findByStatus(PromotionStatus.pending)
        assertTrue(pending.size >= 1)
        assertTrue(pending.all { it.status == PromotionStatus.pending })
    }
}
