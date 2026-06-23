package com.ffpromo.telemetry.query

import com.ffpromo.contracts.GatePolicyInput
import com.ffpromo.contracts.GateRunContext
import com.ffpromo.contracts.MetricType
import com.ffpromo.telemetry.errors.UnsupportedMetricTypeError

enum class Cohort {
    treatment,
    control,
}

fun escapePromqlLabelValue(value: String): String =
    value.replace("\\", "\\\\").replace("\"", "\\\"")

private fun windowSuffix(policy: GatePolicyInput): String {
    val windowSeconds = policy.windowSeconds ?: 300
    return "[${windowSeconds}s]"
}

private fun cohortVariationId(runContext: GateRunContext, cohort: Cohort): String =
    when (cohort) {
        Cohort.treatment -> runContext.treatmentVariationId
        Cohort.control -> runContext.controlVariationId
    }

private fun labelSelector(
    policy: GatePolicyInput,
    runContext: GateRunContext,
    cohort: Cohort,
    extraLabels: String = "",
): String {
    val service = escapePromqlLabelValue(policy.serviceName)
    val flagKey = escapePromqlLabelValue(runContext.flagKey)
    val variationId = escapePromqlLabelValue(cohortVariationId(runContext, cohort))
    val base =
        """service="$service",ld_flag_key="$flagKey",ld_variation_id="$variationId",ld_context_kind="user""""
    return if (extraLabels.isNotEmpty()) {
        "{$base,$extraLabels}"
    } else {
        "{$base}"
    }
}

fun buildErrorRateQuery(
    policy: GatePolicyInput,
    runContext: GateRunContext,
    cohort: Cohort,
): String {
    val labels = labelSelector(policy, runContext, cohort)
    val errorLabels = labelSelector(policy, runContext, cohort, """status=~"5.."""")
    val window = windowSuffix(policy)
    return "sum(rate(http_requests_total$errorLabels$window)) / sum(rate(http_requests_total$labels$window))"
}

fun buildLatencyP95Query(
    policy: GatePolicyInput,
    runContext: GateRunContext,
    cohort: Cohort,
): String {
    val labels = labelSelector(policy, runContext, cohort)
    val window = windowSuffix(policy)
    return "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket$labels$window)) by (le)) * 1000"
}

fun buildSampleCountQuery(
    policy: GatePolicyInput,
    runContext: GateRunContext,
    cohort: Cohort,
): String {
    val labels = labelSelector(policy, runContext, cohort)
    val window = windowSuffix(policy)
    return "sum(increase(http_requests_total$labels$window))"
}

fun buildMetricQuery(
    metricType: MetricType,
    policy: GatePolicyInput,
    runContext: GateRunContext,
    cohort: Cohort,
): String =
    when (metricType) {
        MetricType.error_rate -> buildErrorRateQuery(policy, runContext, cohort)
        MetricType.latency_p95 -> buildLatencyP95Query(policy, runContext, cohort)
        else -> throw UnsupportedMetricTypeError(
            "Unsupported metric type: $metricType",
            metricType.name,
        )
    }

fun buildMetricQuery(
    metricType: String,
    policy: GatePolicyInput,
    runContext: GateRunContext,
    cohort: Cohort,
): String {
    val resolved = MetricType.entries.find { it.name == metricType }
        ?: throw UnsupportedMetricTypeError(
            "Unsupported metric type: $metricType",
            metricType,
        )
    return buildMetricQuery(resolved, policy, runContext, cohort)
}
