package com.ffpromo.db.repositories

import com.ffpromo.contracts.ActorType
import com.ffpromo.contracts.PipelineConfigAction
import com.ffpromo.db.DatabaseFactory
import com.ffpromo.db.IdGenerator
import com.ffpromo.db.metadataToJsonObject
import com.ffpromo.db.models.PipelineConfigAuditRecord
import com.ffpromo.db.tables.PipelineConfigAudits
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import java.time.Instant

class PipelineAuditRepository {
    fun append(input: AppendPipelineAuditInput): PipelineConfigAuditRecord = DatabaseFactory.withTransaction {
        val now = Instant.now()
        val auditId = IdGenerator.newId()

        PipelineConfigAudits.insert {
            it[id] = auditId
            it[pipelineId] = input.pipelineId
            it[action] = input.action.name
            it[actorType] = input.actorType.name
            it[actorId] = input.actorId
            it[displayName] = input.displayName
            it[metadata] = metadataToJsonObject(input.metadata)
            it[occurredAt] = now
        }

        findByIdInTx(auditId) ?: error("PipelineConfigAudit $auditId not found after insert")
    }

    fun findByPipelineId(pipelineId: String): List<PipelineConfigAuditRecord> = DatabaseFactory.withTransaction {
        PipelineConfigAudits
            .selectAll()
            .where { PipelineConfigAudits.pipelineId eq pipelineId }
            .orderBy(PipelineConfigAudits.occurredAt to SortOrder.ASC)
            .map { toRecord(it) }
    }

    private fun findByIdInTx(id: String): PipelineConfigAuditRecord? =
        PipelineConfigAudits
            .selectAll()
            .where { PipelineConfigAudits.id eq id }
            .singleOrNull()
            ?.let { toRecord(it) }

    private fun toRecord(row: ResultRow): PipelineConfigAuditRecord =
        PipelineConfigAuditRecord(
            id = row[PipelineConfigAudits.id],
            pipelineId = row[PipelineConfigAudits.pipelineId],
            action = PipelineConfigAction.valueOf(row[PipelineConfigAudits.action]),
            actorType = ActorType.valueOf(row[PipelineConfigAudits.actorType]),
            actorId = row[PipelineConfigAudits.actorId],
            displayName = row[PipelineConfigAudits.displayName],
            metadata = row[PipelineConfigAudits.metadata],
            occurredAt = row[PipelineConfigAudits.occurredAt],
        )
}

data class AppendPipelineAuditInput(
    val pipelineId: String,
    val action: PipelineConfigAction,
    val actorType: ActorType,
    val actorId: String,
    val displayName: String? = null,
    val metadata: Map<String, JsonElement>? = null,
)
