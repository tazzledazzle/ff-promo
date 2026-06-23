package com.ffpromo.contracts

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class PrometheusClientConfig(
    val baseUrl: String? = null,
    val bearerToken: String? = null,
    val timeout: String? = null,
)

@Serializable
data class GateRunContext(
    val flagKey: String,
    val treatmentVariationId: String,
    val controlVariationId: String,
    val environmentKey: String? = null,
)

@Serializable
enum class GateVerdictResult {
    @SerialName("pass")
    pass,

    @SerialName("fail")
    fail,
}

@Serializable
enum class PreflightCheckStatus {
    @SerialName("pass")
    pass,

    @SerialName("fail")
    fail,
}

@Serializable
data class GateEvaluationResult(
    val verdict: GateVerdictResult,
    val metricType: String,
    val observedDelta: Double? = null,
    val treatmentValue: Double? = null,
    val controlValue: Double? = null,
    val threshold: Double,
    val metadata: Map<String, JsonElement> = emptyMap(),
)

@Serializable
data class PreflightCheck(
    val id: String,
    val status: PreflightCheckStatus,
    val detail: String? = null,
    val observed: Double? = null,
    val required: Double? = null,
)

@Serializable
data class PreflightReport(
    val status: PreflightCheckStatus,
    val checks: List<PreflightCheck>,
    val blockReason: String? = null,
)

@Serializable
data class StageGateEvaluation(
    val verdict: GateVerdictResult,
    val results: List<GateEvaluationResult>,
)
