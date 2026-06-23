package com.ffpromo.contracts

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class GateResultCreateInput(
    val promotionRunId: String,
    val stageId: String,
    val verdict: GateVerdict,
    val metricType: String,
    val observedValue: Double? = null,
    val threshold: Double,
    val metadata: Map<String, JsonElement>,
)

/** Worker/repository alias matching plan terminology. */
typealias GateResultRecord = GateResultCreateInput
