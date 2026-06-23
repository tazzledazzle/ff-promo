package com.ffpromo.telemetry.evaluate

import com.ffpromo.contracts.GateEvaluationResult
import com.ffpromo.contracts.GatePolicyInput
import com.ffpromo.contracts.GateRunContext
import com.ffpromo.contracts.GateVerdictResult
import com.ffpromo.telemetry.client.PrometheusClient
import com.ffpromo.telemetry.errors.TelemetryApiError
import com.ffpromo.telemetry.query.Cohort
import com.ffpromo.telemetry.query.ParseResult
import com.ffpromo.telemetry.query.buildMetricQuery
import com.ffpromo.telemetry.query.buildSampleCountQuery
import com.ffpromo.telemetry.query.parseInstantQueryResult
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

private fun failResult(
    policy: GatePolicyInput,
    reason: String,
    extra: GateEvaluationResult? = null,
): GateEvaluationResult {
    val metadata = buildJsonObject {
        put("reason", JsonPrimitive(reason))
        extra?.metadata?.forEach { (key, value) -> put(key, value) }
    }
    return GateEvaluationResult(
        verdict = GateVerdictResult.fail,
        metricType = policy.metricType.name,
        threshold = policy.threshold,
        observedDelta = extra?.observedDelta,
        treatmentValue = extra?.treatmentValue,
        controlValue = extra?.controlValue,
        metadata = metadata,
    )
}

private fun validateRunContext(runContext: GateRunContext): GateRunContext {
    require(runContext.flagKey.isNotBlank()) { "flagKey is required" }
    require(runContext.treatmentVariationId.isNotBlank()) { "treatmentVariationId is required" }
    require(runContext.controlVariationId.isNotBlank()) { "controlVariationId is required" }
    return runContext
}

suspend fun evaluateGatePolicy(
    client: PrometheusClient,
    policy: GatePolicyInput,
    runContextInput: GateRunContext,
): GateEvaluationResult {
    val runContext = validateRunContext(runContextInput)
    val minSampleSize = policy.minSampleSize ?: 0

    return try {
        val responses = coroutineScope {
            val treatment = async {
                client.queryInstant(buildMetricQuery(policy.metricType, policy, runContext, Cohort.treatment))
            }
            val control = async {
                client.queryInstant(buildMetricQuery(policy.metricType, policy, runContext, Cohort.control))
            }
            val treatmentSample = async {
                client.queryInstant(buildSampleCountQuery(policy, runContext, Cohort.treatment))
            }
            val controlSample = async {
                client.queryInstant(buildSampleCountQuery(policy, runContext, Cohort.control))
            }
            listOf(treatment.await(), control.await(), treatmentSample.await(), controlSample.await())
        }
        val treatmentData = responses[0]
        val controlData = responses[1]
        val treatmentSampleData = responses[2]
        val controlSampleData = responses[3]

        val treatmentParsed = parseInstantQueryResult(treatmentData)
        if (treatmentParsed is ParseResult.Fail) {
            return failResult(policy, treatmentParsed.reason.name)
        }
        val treatmentValue = (treatmentParsed as ParseResult.Ok).value

        val controlParsed = parseInstantQueryResult(controlData)
        if (controlParsed is ParseResult.Fail) {
            return failResult(policy, controlParsed.reason.name)
        }
        val controlValue = (controlParsed as ParseResult.Ok).value

        val treatmentSampleParsed = parseInstantQueryResult(treatmentSampleData)
        if (treatmentSampleParsed is ParseResult.Fail) {
            return failResult(
                policy,
                "insufficient_samples",
                GateEvaluationResult(
                    verdict = GateVerdictResult.fail,
                    metricType = policy.metricType.name,
                    threshold = policy.threshold,
                    metadata = buildJsonObject {
                        put("reason", JsonPrimitive("insufficient_samples"))
                        put("cohort", JsonPrimitive("treatment"))
                    },
                ),
            )
        }
        val treatmentSampleValue = (treatmentSampleParsed as ParseResult.Ok).value
        if (treatmentSampleValue < minSampleSize) {
            return failResult(
                policy,
                "insufficient_samples",
                GateEvaluationResult(
                    verdict = GateVerdictResult.fail,
                    metricType = policy.metricType.name,
                    threshold = policy.threshold,
                    metadata = buildJsonObject {
                        put("reason", JsonPrimitive("insufficient_samples"))
                        put("cohort", JsonPrimitive("treatment"))
                        put("observed", JsonPrimitive(treatmentSampleValue))
                        put("required", JsonPrimitive(minSampleSize))
                    },
                ),
            )
        }

        val controlSampleParsed = parseInstantQueryResult(controlSampleData)
        if (controlSampleParsed is ParseResult.Fail) {
            return failResult(
                policy,
                "insufficient_samples",
                GateEvaluationResult(
                    verdict = GateVerdictResult.fail,
                    metricType = policy.metricType.name,
                    threshold = policy.threshold,
                    metadata = buildJsonObject {
                        put("reason", JsonPrimitive("insufficient_samples"))
                        put("cohort", JsonPrimitive("control"))
                    },
                ),
            )
        }
        val controlSampleValue = (controlSampleParsed as ParseResult.Ok).value
        if (controlSampleValue < minSampleSize) {
            return failResult(
                policy,
                "insufficient_samples",
                GateEvaluationResult(
                    verdict = GateVerdictResult.fail,
                    metricType = policy.metricType.name,
                    threshold = policy.threshold,
                    metadata = buildJsonObject {
                        put("reason", JsonPrimitive("insufficient_samples"))
                        put("cohort", JsonPrimitive("control"))
                        put("observed", JsonPrimitive(controlSampleValue))
                        put("required", JsonPrimitive(minSampleSize))
                    },
                ),
            )
        }

        val observedDelta = treatmentValue - controlValue
        if (observedDelta > policy.threshold) {
            return GateEvaluationResult(
                verdict = GateVerdictResult.fail,
                metricType = policy.metricType.name,
                threshold = policy.threshold,
                observedDelta = observedDelta,
                treatmentValue = treatmentValue,
                controlValue = controlValue,
                metadata = buildJsonObject {
                    put("reason", JsonPrimitive("threshold_exceeded"))
                },
            )
        }

        GateEvaluationResult(
            verdict = GateVerdictResult.pass,
            metricType = policy.metricType.name,
            threshold = policy.threshold,
            observedDelta = observedDelta,
            treatmentValue = treatmentValue,
            controlValue = controlValue,
            metadata = emptyMap(),
        )
    } catch (error: TelemetryApiError) {
        failResult(
            policy,
            "prometheus_error",
            GateEvaluationResult(
                verdict = GateVerdictResult.fail,
                metricType = policy.metricType.name,
                threshold = policy.threshold,
                metadata = buildJsonObject {
                    put("reason", JsonPrimitive("prometheus_error"))
                    put("status", JsonPrimitive(error.status))
                    error.context?.get("errorType")?.let { put("errorType", JsonPrimitive(it.toString())) }
                },
            ),
        )
    }
}
