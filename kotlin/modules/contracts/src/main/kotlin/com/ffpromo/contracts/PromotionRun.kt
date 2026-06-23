package com.ffpromo.contracts

import kotlinx.serialization.Serializable

@Serializable
data class PromotionRunCreateInput(
    val pipelineId: String,
    val flagKey: String,
    val actor: Actor,
)

@Serializable
data class PersistRunStateInput(
    val promotionRunId: String,
    val status: PromotionStatus,
    val currentStageIndex: Int? = null,
    val pauseReason: String? = null,
)
