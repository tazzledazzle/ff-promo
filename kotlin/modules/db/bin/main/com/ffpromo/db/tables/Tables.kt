package com.ffpromo.db.tables

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.timestamp
import org.jetbrains.exposed.sql.json.jsonb
import java.time.Instant

object Pipelines : Table() {
    override val tableName = "\"Pipeline\""
    val id = varchar("id", 32)
    val name = varchar("name", 255)
    val description = text("description").nullable()
    val version = integer("version").default(1)
    val flagKey = varchar("flagKey", 255)
    val projectKey = varchar("projectKey", 255)
    val isActive = bool("isActive").default(true)
    val createdAt = timestamp("createdAt").default(Instant.now())
    val updatedAt = timestamp("updatedAt")

    override val primaryKey = PrimaryKey(id)
}

object Stages : Table() {
    override val tableName = "\"Stage\""
    val id = varchar("id", 32)
    val pipelineId = varchar("pipelineId", 32)
    val orderIndex = integer("orderIndex")
    val environment = varchar("environment", 64)
    val displayName = varchar("displayName", 255)

    override val primaryKey = PrimaryKey(id)
}

object GatePolicies : Table() {
    override val tableName = "\"GatePolicy\""
    val id = varchar("id", 32)
    val stageId = varchar("stageId", 32)
    val metricType = varchar("metricType", 64)
    val threshold = double("threshold")
    val comparisonMode = varchar("comparisonMode", 64).default("absolute")
    val windowSeconds = integer("windowSeconds").default(300)
    val minSampleSize = integer("minSampleSize").default(0)
    val serviceName = varchar("serviceName", 255)

    override val primaryKey = PrimaryKey(id)
}

object PromotionRuns : Table() {
    override val tableName = "\"PromotionRun\""
    val id = varchar("id", 32)
    val pipelineId = varchar("pipelineId", 32)
    val pipelineVersion = integer("pipelineVersion")
    val flagKey = varchar("flagKey", 255)
    val status = varchar("status", 32).default("pending")
    val currentStageIndex = integer("currentStageIndex").default(0)
    val temporalWorkflowId = varchar("temporalWorkflowId", 255).nullable()
    val pauseReason = text("pauseReason").nullable()
    val startedAt = timestamp("startedAt").nullable()
    val completedAt = timestamp("completedAt").nullable()
    val createdAt = timestamp("createdAt").default(Instant.now())
    val updatedAt = timestamp("updatedAt")

    override val primaryKey = PrimaryKey(id)
}

object GateResults : Table() {
    override val tableName = "\"GateResult\""
    val id = varchar("id", 32)
    val promotionRunId = varchar("promotionRunId", 32)
    val stageId = varchar("stageId", 32)
    val verdict = varchar("verdict", 32)
    val metricType = varchar("metricType", 64)
    val observedValue = double("observedValue").nullable()
    val threshold = double("threshold")
    val metadata = jsonb(
        name = "metadata",
        serialize = { Json.encodeToString(JsonObject.serializer(), it) },
        deserialize = { Json.decodeFromString(JsonObject.serializer(), it) },
    )
    val evaluatedAt = timestamp("evaluatedAt").default(Instant.now())

    override val primaryKey = PrimaryKey(id)
}

object AuditEvents : Table() {
    override val tableName = "\"AuditEvent\""
    val id = varchar("id", 32)
    val promotionRunId = varchar("promotionRunId", 32)
    val action = varchar("action", 64)
    val actorType = varchar("actorType", 32)
    val actorId = varchar("actorId", 255)
    val displayName = varchar("displayName", 255).nullable()
    val gateResultId = varchar("gateResultId", 32).nullable()
    val metadata = jsonb(
        name = "metadata",
        serialize = { Json.encodeToString(JsonObject.serializer(), it) },
        deserialize = { Json.decodeFromString(JsonObject.serializer(), it) },
    )
    val occurredAt = timestamp("occurredAt").default(Instant.now())

    override val primaryKey = PrimaryKey(id)
}

object PipelineConfigAudits : Table() {
    override val tableName = "\"PipelineConfigAudit\""
    val id = varchar("id", 32)
    val pipelineId = varchar("pipelineId", 32)
    val action = varchar("action", 64)
    val actorType = varchar("actorType", 32)
    val actorId = varchar("actorId", 255)
    val displayName = varchar("displayName", 255).nullable()
    val metadata = jsonb(
        name = "metadata",
        serialize = { Json.encodeToString(JsonObject.serializer(), it) },
        deserialize = { Json.decodeFromString(JsonObject.serializer(), it) },
    )
    val occurredAt = timestamp("occurredAt").default(Instant.now())

    override val primaryKey = PrimaryKey(id)
}
