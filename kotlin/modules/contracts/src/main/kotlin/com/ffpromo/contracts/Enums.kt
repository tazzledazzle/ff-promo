/**
 * Shared domain enums for ff-promo v1 JSON contracts.
 *
 * Timestamps in API JSON use ISO-8601 strings; repository layers may use [java.time.Instant].
 */
package com.ffpromo.contracts

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class StageEnvironment {
    @SerialName("dev")
    dev,

    @SerialName("staging")
    staging,

    @SerialName("prod")
    prod,
}

@Serializable
enum class MetricType {
    @SerialName("error_rate")
    error_rate,

    @SerialName("latency_p95")
    latency_p95,
}

@Serializable
enum class ActorType {
    @SerialName("user")
    user,

    @SerialName("system")
    system,

    @SerialName("api_key")
    api_key,
}

@Serializable
enum class AuditAction {
    @SerialName("run_started")
    run_started,

    @SerialName("run_paused")
    run_paused,

    @SerialName("run_resumed")
    run_resumed,

    @SerialName("run_aborted")
    run_aborted,

    @SerialName("run_completed")
    run_completed,

    @SerialName("stage_entered")
    stage_entered,

    @SerialName("stage_advanced")
    stage_advanced,

    @SerialName("gate_evaluated")
    gate_evaluated,
}

@Serializable
enum class PromotionStatus {
    @SerialName("pending")
    pending,

    @SerialName("active")
    active,

    @SerialName("paused")
    paused,

    @SerialName("completed")
    completed,

    @SerialName("aborted")
    aborted,
}

@Serializable
enum class GateVerdict {
    @SerialName("pass")
    pass,

    @SerialName("fail")
    fail,

    @SerialName("pending")
    pending,

    @SerialName("skipped")
    skipped,
}

@Serializable
enum class PipelineConfigAction {
    @SerialName("pipeline_created")
    pipeline_created,

    @SerialName("pipeline_deactivated")
    pipeline_deactivated,

    @SerialName("pipeline_updated")
    pipeline_updated,
}

val REQUIRED_METRICS: List<MetricType> = listOf(MetricType.error_rate, MetricType.latency_p95)

val ENV_ORDER: List<StageEnvironment> = listOf(
    StageEnvironment.dev,
    StageEnvironment.staging,
    StageEnvironment.prod,
)
