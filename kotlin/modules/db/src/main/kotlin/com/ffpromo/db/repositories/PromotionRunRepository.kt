package com.ffpromo.db.repositories

import com.ffpromo.contracts.PersistRunStateInput
import com.ffpromo.contracts.PromotionStatus
import com.ffpromo.db.DatabaseFactory
import com.ffpromo.db.IdGenerator
import com.ffpromo.db.models.PromotionRunRecord
import com.ffpromo.db.tables.Pipelines
import com.ffpromo.db.tables.PromotionRuns
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.update
import java.time.Instant

class PromotionRunRepository {
    fun create(input: CreatePromotionRunInput): PromotionRunRecord = DatabaseFactory.withTransaction {
        val pipeline = Pipelines
            .selectAll()
            .where { Pipelines.id eq input.pipelineId }
            .singleOrNull()
            ?: error("Pipeline ${input.pipelineId} not found")

        val now = Instant.now()
        val runId = IdGenerator.newId()

        PromotionRuns.insert {
            it[id] = runId
            it[pipelineId] = input.pipelineId
            it[pipelineVersion] = pipeline[Pipelines.version]
            it[flagKey] = input.flagKey
            it[status] = PromotionStatus.pending.name
            it[currentStageIndex] = 0
            it[temporalWorkflowId] = null
            it[pauseReason] = null
            it[createdAt] = now
            it[updatedAt] = now
        }

        findByIdInTx(runId) ?: error("PromotionRun $runId not found after insert")
    }

    fun updateState(input: UpdatePromotionRunStateInput): PromotionRunRecord = DatabaseFactory.withTransaction {
        val parsed = PersistRunStateInput(
            promotionRunId = input.promotionRunId,
            status = input.status,
            currentStageIndex = input.currentStageIndex,
            pauseReason = input.pauseReason,
        )

        val existing = PromotionRuns
            .selectAll()
            .where { PromotionRuns.id eq parsed.promotionRunId }
            .singleOrNull()
            ?: error("PromotionRun ${parsed.promotionRunId} not found")

        val existingStatus = PromotionStatus.valueOf(existing[PromotionRuns.status])
        val isFirstActiveTransition =
            existingStatus != PromotionStatus.active && parsed.status == PromotionStatus.active
        val temporalWorkflowId = input.temporalWorkflowId
            ?: if (isFirstActiveTransition && existing[PromotionRuns.temporalWorkflowId] == null) {
                parsed.promotionRunId
            } else {
                null
            }

        val now = Instant.now()
        PromotionRuns.update({ PromotionRuns.id eq parsed.promotionRunId }) {
            it[status] = parsed.status.name
            parsed.currentStageIndex?.let { stageIndex ->
                it[currentStageIndex] = stageIndex
            }
            parsed.pauseReason?.let { reason ->
                it[pauseReason] = reason
            }
            if (temporalWorkflowId != null) {
                it[PromotionRuns.temporalWorkflowId] = temporalWorkflowId
            }
            if (parsed.status == PromotionStatus.active && existing[PromotionRuns.startedAt] == null) {
                it[startedAt] = now
            }
            if (parsed.status == PromotionStatus.completed || parsed.status == PromotionStatus.aborted) {
                it[completedAt] = now
            }
            it[updatedAt] = now
        }

        findByIdInTx(parsed.promotionRunId) ?: error("PromotionRun ${parsed.promotionRunId} not found after update")
    }

    fun findById(id: String): PromotionRunRecord? = DatabaseFactory.withTransaction {
        findByIdInTx(id)
    }

    fun findByStatus(status: PromotionStatus): List<PromotionRunRecord> = DatabaseFactory.withTransaction {
        PromotionRuns
            .selectAll()
            .where { PromotionRuns.status eq status.name }
            .map { toRecord(it) }
    }

    private fun findByIdInTx(id: String): PromotionRunRecord? =
        PromotionRuns
            .selectAll()
            .where { PromotionRuns.id eq id }
            .singleOrNull()
            ?.let { toRecord(it) }

    private fun toRecord(row: ResultRow): PromotionRunRecord =
        PromotionRunRecord(
            id = row[PromotionRuns.id],
            pipelineId = row[PromotionRuns.pipelineId],
            pipelineVersion = row[PromotionRuns.pipelineVersion],
            flagKey = row[PromotionRuns.flagKey],
            status = PromotionStatus.valueOf(row[PromotionRuns.status]),
            currentStageIndex = row[PromotionRuns.currentStageIndex],
            temporalWorkflowId = row[PromotionRuns.temporalWorkflowId],
            pauseReason = row[PromotionRuns.pauseReason],
            startedAt = row[PromotionRuns.startedAt],
            completedAt = row[PromotionRuns.completedAt],
            createdAt = row[PromotionRuns.createdAt],
            updatedAt = row[PromotionRuns.updatedAt],
        )
}

data class CreatePromotionRunInput(
    val pipelineId: String,
    val flagKey: String,
)

data class UpdatePromotionRunStateInput(
    val promotionRunId: String,
    val status: PromotionStatus,
    val currentStageIndex: Int? = null,
    val pauseReason: String? = null,
    val temporalWorkflowId: String? = null,
)
