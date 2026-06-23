package com.ffpromo.db.repositories

import com.ffpromo.contracts.GateResultCreateInput
import com.ffpromo.db.DatabaseFactory
import com.ffpromo.db.IdGenerator
import com.ffpromo.db.metadataToJsonObject
import com.ffpromo.db.models.GateResultRecord
import com.ffpromo.db.tables.GateResults
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import java.time.Instant

class GateResultRepository {
    fun create(input: GateResultCreateInput): GateResultRecord = DatabaseFactory.withTransaction {
        val now = Instant.now()
        val resultId = IdGenerator.newId()
        val metadataJson = metadataToJsonObject(input.metadata)

        GateResults.insert {
            it[id] = resultId
            it[promotionRunId] = input.promotionRunId
            it[stageId] = input.stageId
            it[verdict] = input.verdict.name
            it[metricType] = input.metricType
            it[observedValue] = input.observedValue
            it[threshold] = input.threshold
            it[metadata] = metadataJson
            it[evaluatedAt] = now
        }

        findByIdInTx(resultId) ?: error("GateResult $resultId not found after insert")
    }

    fun findByRunId(promotionRunId: String): List<GateResultRecord> = listByRunId(promotionRunId)

    fun listByRunId(promotionRunId: String): List<GateResultRecord> = DatabaseFactory.withTransaction {
        GateResults
            .selectAll()
            .where { GateResults.promotionRunId eq promotionRunId }
            .orderBy(GateResults.evaluatedAt to SortOrder.DESC)
            .map { toRecord(it) }
    }

    fun findByRunAndStage(promotionRunId: String, stageId: String): List<GateResultRecord> =
        DatabaseFactory.withTransaction {
            GateResults
                .selectAll()
                .where { (GateResults.promotionRunId eq promotionRunId) and (GateResults.stageId eq stageId) }
                .orderBy(GateResults.evaluatedAt to SortOrder.DESC)
                .map { toRecord(it) }
        }

    private fun findByIdInTx(id: String): GateResultRecord? =
        GateResults
            .selectAll()
            .where { GateResults.id eq id }
            .singleOrNull()
            ?.let { toRecord(it) }

    private fun toRecord(row: ResultRow): GateResultRecord =
        GateResultRecord(
            id = row[GateResults.id],
            promotionRunId = row[GateResults.promotionRunId],
            stageId = row[GateResults.stageId],
            verdict = com.ffpromo.contracts.GateVerdict.valueOf(row[GateResults.verdict]),
            metricType = row[GateResults.metricType],
            observedValue = row[GateResults.observedValue],
            threshold = row[GateResults.threshold],
            metadata = row[GateResults.metadata],
            evaluatedAt = row[GateResults.evaluatedAt],
        )
}
