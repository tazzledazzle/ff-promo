package com.ffpromo.telemetry.preflight

import com.ffpromo.contracts.GatePolicyInput
import com.ffpromo.contracts.GateRunContext
import com.ffpromo.contracts.MetricType
import com.ffpromo.contracts.PreflightCheck
import com.ffpromo.contracts.PreflightCheckStatus
import com.ffpromo.contracts.PreflightReport
import com.ffpromo.telemetry.client.PrometheusClient
import com.ffpromo.telemetry.errors.TelemetryApiError
import com.ffpromo.telemetry.query.Cohort
import com.ffpromo.telemetry.query.ParseResult
import com.ffpromo.telemetry.query.buildSampleCountQuery
import com.ffpromo.telemetry.query.parseInstantQueryResult
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

private fun check(
    id: String,
    status: PreflightCheckStatus,
    detail: String? = null,
    observed: Double? = null,
    required: Double? = null,
): PreflightCheck =
    PreflightCheck(
        id = id,
        status = status,
        detail = detail,
        observed = observed,
        required = required,
    )

private fun requiredSampleSize(policies: List<GatePolicyInput>): Int =
    policies.maxOfOrNull { it.minSampleSize ?: 0 } ?: 0

private fun summarizeFailures(checks: List<PreflightCheck>): String =
    checks
        .filter { it.status == PreflightCheckStatus.fail }
        .joinToString("; ") { it.detail ?: it.id }

private fun probePolicy(
    policies: List<GatePolicyInput>,
    runContext: GateRunContext,
): GatePolicyInput =
    policies.firstOrNull() ?: GatePolicyInput(
        metricType = MetricType.error_rate,
        threshold = 0.0,
        serviceName = runContext.flagKey,
    )

private fun validateRunContext(runContext: GateRunContext): GateRunContext {
    require(runContext.flagKey.isNotBlank()) { "flagKey is required" }
    require(runContext.treatmentVariationId.isNotBlank()) { "treatmentVariationId is required" }
    require(runContext.controlVariationId.isNotBlank()) { "controlVariationId is required" }
    return runContext
}

suspend fun runPreflightChecks(
    client: PrometheusClient,
    policies: List<GatePolicyInput>,
    runContextInput: GateRunContext,
): PreflightReport {
    val runContext = validateRunContext(runContextInput)
    val required = requiredSampleSize(policies)
    val policy = probePolicy(policies, runContext)
    val checks = mutableListOf<PreflightCheck>()

    try {
        val (treatmentSampleData, controlSampleData) = coroutineScope {
            val treatment = async {
                client.queryInstant(buildSampleCountQuery(policy, runContext, Cohort.treatment))
            }
            val control = async {
                client.queryInstant(buildSampleCountQuery(policy, runContext, Cohort.control))
            }
            treatment.await() to control.await()
        }

        val treatmentSample = parseInstantQueryResult(treatmentSampleData)
        val controlSample = parseInstantQueryResult(controlSampleData)

        checks += check(
            id = "metric_flow_treatment",
            status = if (treatmentSample is ParseResult.Ok) PreflightCheckStatus.pass else PreflightCheckStatus.fail,
            detail = if (treatmentSample is ParseResult.Ok) null else "No treatment user-scoped metrics found",
        )
        checks += check(
            id = "metric_flow_control",
            status = if (controlSample is ParseResult.Ok) PreflightCheckStatus.pass else PreflightCheckStatus.fail,
            detail = if (controlSample is ParseResult.Ok) null else "No control user-scoped metrics found",
        )
        checks += check(
            id = "min_sample_treatment",
            status = if (treatmentSample is ParseResult.Ok && treatmentSample.value >= required) {
                PreflightCheckStatus.pass
            } else {
                PreflightCheckStatus.fail
            },
            observed = (treatmentSample as? ParseResult.Ok)?.value,
            required = required.toDouble(),
            detail = if (treatmentSample is ParseResult.Ok && treatmentSample.value >= required) {
                null
            } else {
                "Treatment sample count below required minimum"
            },
        )
        checks += check(
            id = "min_sample_control",
            status = if (controlSample is ParseResult.Ok && controlSample.value >= required) {
                PreflightCheckStatus.pass
            } else {
                PreflightCheckStatus.fail
            },
            observed = (controlSample as? ParseResult.Ok)?.value,
            required = required.toDouble(),
            detail = if (controlSample is ParseResult.Ok && controlSample.value >= required) {
                null
            } else {
                "Control sample count below required minimum"
            },
        )
        checks += check(
            id = "context_kind_user",
            status = if (treatmentSample is ParseResult.Ok) PreflightCheckStatus.pass else PreflightCheckStatus.fail,
            detail = if (treatmentSample is ParseResult.Ok) null else "No user context kind series present",
        )
    } catch (error: TelemetryApiError) {
        checks += listOf(
            check("metric_flow_treatment", PreflightCheckStatus.fail, detail = "Prometheus query failed"),
            check("metric_flow_control", PreflightCheckStatus.fail, detail = "Prometheus query failed"),
            check("min_sample_treatment", PreflightCheckStatus.fail, required = required.toDouble()),
            check("min_sample_control", PreflightCheckStatus.fail, required = required.toDouble()),
            check("context_kind_user", PreflightCheckStatus.fail, detail = "Prometheus query failed"),
        )
    }

    val status = if (checks.all { it.status == PreflightCheckStatus.pass }) {
        PreflightCheckStatus.pass
    } else {
        PreflightCheckStatus.fail
    }

    return PreflightReport(
        status = status,
        checks = checks,
        blockReason = if (status == PreflightCheckStatus.fail) summarizeFailures(checks) else null,
    )
}
