package com.ffpromo.db.models

import com.ffpromo.contracts.AuditAction
import com.ffpromo.contracts.ActorType
import com.ffpromo.contracts.GateVerdict
import com.ffpromo.contracts.PipelineConfigAction
import com.ffpromo.contracts.PromotionStatus
import kotlinx.serialization.json.JsonObject
import java.time.Instant

data class PromotionRunRecord(
    val id: String,
    val pipelineId: String,
    val pipelineVersion: Int,
    val flagKey: String,
    val status: PromotionStatus,
    val currentStageIndex: Int,
    val temporalWorkflowId: String?,
    val pauseReason: String?,
    val startedAt: Instant?,
    val completedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class GateResultRecord(
    val id: String,
    val promotionRunId: String,
    val stageId: String,
    val verdict: GateVerdict,
    val metricType: String,
    val observedValue: Double?,
    val threshold: Double,
    val metadata: JsonObject,
    val evaluatedAt: Instant,
)

data class AuditEventRecord(
    val id: String,
    val promotionRunId: String,
    val action: AuditAction,
    val actorType: ActorType,
    val actorId: String,
    val displayName: String?,
    val gateResultId: String?,
    val metadata: JsonObject,
    val occurredAt: Instant,
    val gateResult: GateResultRecord? = null,
)

data class PipelineConfigAuditRecord(
    val id: String,
    val pipelineId: String,
    val action: PipelineConfigAction,
    val actorType: ActorType,
    val actorId: String,
    val displayName: String?,
    val metadata: JsonObject,
    val occurredAt: Instant,
)

data class PipelineSummary(
    val id: String,
    val name: String,
    val flagKey: String,
    val projectKey: String,
    val description: String?,
    val isActive: Boolean,
    val version: Int,
    val stageIds: List<String>,
)
