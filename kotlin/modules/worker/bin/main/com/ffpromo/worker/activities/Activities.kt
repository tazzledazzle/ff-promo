package com.ffpromo.worker.activities

import com.ffpromo.contracts.AuditAction
import com.ffpromo.contracts.AuditEventInput
import com.ffpromo.contracts.GateResultCreateInput
import com.ffpromo.contracts.GateVerdict
import com.ffpromo.contracts.PersistRunStateInput
import com.ffpromo.contracts.PromotionStatus
import com.ffpromo.db.DatabaseFactory
import com.ffpromo.db.repositories.RepositoryFactory
import com.ffpromo.db.repositories.UpdatePromotionRunStateInput
import io.temporal.activity.ActivityInterface
import io.temporal.activity.ActivityMethod
import kotlinx.serialization.json.JsonPrimitive

@ActivityInterface
interface PersistRunStateActivity {
    @ActivityMethod
    fun persistRunState(
        promotionRunId: String,
        status: String,
        currentStageIndex: Int?,
        pauseReason: String?,
    )
}

class PersistRunStateActivityImpl : PersistRunStateActivity {
    override fun persistRunState(
        promotionRunId: String,
        status: String,
        currentStageIndex: Int?,
        pauseReason: String?,
    ) {
        val databaseUrl = System.getenv("DATABASE_URL")
            ?: error("DATABASE_URL is required for persistRunState activity")

        DatabaseFactory.connectFromDatabaseUrl(databaseUrl)
        try {
            RepositoryFactory.create().promotionRuns.updateState(
                UpdatePromotionRunStateInput(
                    promotionRunId = promotionRunId,
                    status = PromotionStatus.valueOf(status),
                    currentStageIndex = currentStageIndex,
                    pauseReason = pauseReason,
                ),
            )
        } finally {
            DatabaseFactory.close()
        }
    }
}

@ActivityInterface
interface RecordAuditEventActivity {
    @ActivityMethod
    fun recordAuditEvent(
        promotionRunId: String,
        action: String,
        actorType: String,
        actorId: String,
        displayName: String?,
        gateResultId: String?,
        metadataJson: String?,
    )
}

class RecordAuditEventActivityImpl : RecordAuditEventActivity {
    override fun recordAuditEvent(
        promotionRunId: String,
        action: String,
        actorType: String,
        actorId: String,
        displayName: String?,
        gateResultId: String?,
        metadataJson: String?,
    ) {
        val databaseUrl = System.getenv("DATABASE_URL")
            ?: error("DATABASE_URL is required for recordAuditEvent activity")

        if (action == AuditAction.gate_evaluated.name && gateResultId == null) {
            error("gateResultId is required when action is gate_evaluated")
        }

        val metadata = metadataJson?.let { parseMetadataJson(it) }

        DatabaseFactory.connectFromDatabaseUrl(databaseUrl)
        try {
            RepositoryFactory.create().audit.append(
                AuditEventInput(
                    promotionRunId = promotionRunId,
                    action = AuditAction.valueOf(action),
                    actorType = com.ffpromo.contracts.ActorType.valueOf(actorType),
                    actorId = actorId,
                    displayName = displayName,
                    gateResultId = gateResultId,
                    metadata = metadata,
                ),
            )
        } finally {
            DatabaseFactory.close()
        }
    }
}

@ActivityInterface
interface EvaluateGateActivity {
    @ActivityMethod
    fun evaluateGate(promotionRunId: String, stageIndex: Int): String
}

class EvaluateGateActivityImpl : EvaluateGateActivity {
    override fun evaluateGate(promotionRunId: String, stageIndex: Int): String {
        val databaseUrl = System.getenv("DATABASE_URL")
            ?: error("DATABASE_URL is required for evaluateGate activity")

        DatabaseFactory.connectFromDatabaseUrl(databaseUrl)
        return try {
            val repos = RepositoryFactory.create()
            val run = repos.promotionRuns.findById(promotionRunId)
                ?: error("PromotionRun $promotionRunId not found")
            val pipeline = repos.pipelines.findById(run.pipelineId)
                ?: error("Pipeline ${run.pipelineId} not found")
            val stage = pipeline.stages.getOrNull(stageIndex)
                ?: error("Stage index $stageIndex not found")

            val gateResult = repos.gateResults.create(
                GateResultCreateInput(
                    promotionRunId = promotionRunId,
                    stageId = stage.id,
                    verdict = GateVerdict.pass,
                    metricType = "error_rate",
                    observedValue = 0.001,
                    threshold = 0.01,
                    metadata = mapOf(
                        "stub" to JsonPrimitive(true),
                        "stageIndex" to JsonPrimitive(stageIndex),
                    ),
                ),
            )

            return gateResult.id
        } finally {
            DatabaseFactory.close()
        }
    }
}

private fun parseMetadataJson(json: String): Map<String, kotlinx.serialization.json.JsonElement>? {
    if (json.isBlank()) return null
    val element = kotlinx.serialization.json.Json.parseToJsonElement(json)
    return if (element is kotlinx.serialization.json.JsonObject) element.toMap() else null
}
