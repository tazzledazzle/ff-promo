package com.ffpromo.db.repositories

import com.ffpromo.contracts.AuditEventInput
import com.ffpromo.db.DatabaseFactory
import com.ffpromo.db.IdGenerator
import com.ffpromo.db.metadataToJsonObject
import com.ffpromo.db.models.AuditEventRecord
import com.ffpromo.db.models.GateResultRecord
import com.ffpromo.db.tables.AuditEvents
import com.ffpromo.db.tables.GateResults
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import java.time.Instant

class AuditRepository {
    fun append(input: AuditEventInput): AuditEventRecord = DatabaseFactory.withTransaction {
        val now = Instant.now()
        val eventId = IdGenerator.newId()
        val metadataJson = metadataToJsonObject(input.metadata)

        AuditEvents.insert {
            it[id] = eventId
            it[promotionRunId] = input.promotionRunId
            it[action] = input.action.name
            it[actorType] = input.actorType.name
            it[actorId] = input.actorId
            it[displayName] = input.displayName
            it[gateResultId] = input.gateResultId
            it[metadata] = metadataJson
            it[occurredAt] = now
        }

        findByIdInTx(eventId) ?: error("AuditEvent $eventId not found after insert")
    }

    fun findByRunId(
        promotionRunId: String,
        limit: Int = 100,
        cursor: String? = null,
    ): List<AuditEventRecord> = DatabaseFactory.withTransaction {
        val query = AuditEvents
            .selectAll()
            .where { AuditEvents.promotionRunId eq promotionRunId }
            .orderBy(AuditEvents.occurredAt to SortOrder.ASC)

        val rows = if (cursor != null) {
            val cursorTime = AuditEvents
                .selectAll()
                .where { AuditEvents.id eq cursor }
                .singleOrNull()
                ?.get(AuditEvents.occurredAt)
            if (cursorTime != null) {
                query.filter { it[AuditEvents.occurredAt] > cursorTime }
            } else {
                query
            }
        } else {
            query
        }.take(limit)

        rows.map { row ->
            val gateResult = row[AuditEvents.gateResultId]?.let { gateResultId ->
                GateResults
                    .selectAll()
                    .where { GateResults.id eq gateResultId }
                    .singleOrNull()
                    ?.let { toGateResultRecord(it) }
            }
            toAuditEventRecord(row, gateResult)
        }
    }

    private fun findByIdInTx(id: String): AuditEventRecord? {
        val row = AuditEvents
            .selectAll()
            .where { AuditEvents.id eq id }
            .singleOrNull() ?: return null

        val gateResult = row[AuditEvents.gateResultId]?.let { gateResultId ->
            GateResults
                .selectAll()
                .where { GateResults.id eq gateResultId }
                .singleOrNull()
                ?.let { toGateResultRecord(it) }
        }
        return toAuditEventRecord(row, gateResult)
    }

    private fun toAuditEventRecord(row: ResultRow, gateResult: GateResultRecord?): AuditEventRecord {
        val metadata = row[AuditEvents.metadata]
        return AuditEventRecord(
            id = row[AuditEvents.id],
            promotionRunId = row[AuditEvents.promotionRunId],
            action = com.ffpromo.contracts.AuditAction.valueOf(row[AuditEvents.action]),
            actorType = com.ffpromo.contracts.ActorType.valueOf(row[AuditEvents.actorType]),
            actorId = row[AuditEvents.actorId],
            displayName = row[AuditEvents.displayName],
            gateResultId = row[AuditEvents.gateResultId],
            metadata = metadata,
            occurredAt = row[AuditEvents.occurredAt],
            gateResult = gateResult,
        )
    }

    private fun toGateResultRecord(row: ResultRow): GateResultRecord =
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
