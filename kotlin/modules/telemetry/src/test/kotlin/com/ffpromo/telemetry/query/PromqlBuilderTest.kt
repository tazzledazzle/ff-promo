package com.ffpromo.telemetry.query

import com.ffpromo.contracts.GatePolicyInput
import com.ffpromo.contracts.GateRunContext
import com.ffpromo.contracts.MetricType
import com.ffpromo.telemetry.errors.UnsupportedMetricTypeError
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class PromqlBuilderTest {
    private val policy = GatePolicyInput(
        metricType = MetricType.error_rate,
        threshold = 0.01,
        serviceName = "demo-service",
        windowSeconds = 300,
    )

    private val runContext = GateRunContext(
        flagKey = "demo-feature-flag",
        treatmentVariationId = "treatment-var",
        controlVariationId = "control-var",
    )

    @Test
    fun `escapes quotes and backslashes in label values`() {
        assertEquals("""a\"b\\c""", escapePromqlLabelValue("""a"b\c"""))
    }

    @Test
    fun `builds error rate query with user context and window`() {
        val query = buildErrorRateQuery(policy, runContext, Cohort.treatment)
        assertTrue(query.contains("""ld_context_kind="user""""))
        assertTrue(query.contains("""ld_variation_id="treatment-var""""))
        assertTrue(query.contains("[300s]"))
        assertTrue(query.contains("""status=~"5..""""))
    }

    @Test
    fun `builds latency p95 query in milliseconds`() {
        val latencyPolicy = policy.copy(metricType = MetricType.latency_p95)
        val query = buildLatencyP95Query(latencyPolicy, runContext, Cohort.control)
        assertTrue(query.contains("histogram_quantile(0.95"))
        assertTrue(query.contains("""ld_variation_id="control-var""""))
        assertTrue(query.contains("* 1000"))
    }

    @Test
    fun `builds sample count query for cohorts`() {
        val query = buildSampleCountQuery(policy, runContext, Cohort.treatment)
        assertTrue(query.contains("sum(increase(http_requests_total"))
        assertTrue(query.contains("""ld_variation_id="treatment-var""""))
    }

    @Test
    fun `supports canonical metric types only`() {
        assertTrue(
            buildMetricQuery(MetricType.error_rate, policy, runContext, Cohort.treatment)
                .contains("rate(http_requests_total"),
        )
        assertTrue(
            buildMetricQuery(
                MetricType.latency_p95,
                policy.copy(metricType = MetricType.latency_p95),
                runContext,
                Cohort.treatment,
            ).contains("histogram_quantile"),
        )
        assertThrows<UnsupportedMetricTypeError> {
            buildMetricQuery("p95_latency_ms", policy, runContext, Cohort.treatment)
        }
    }
}
