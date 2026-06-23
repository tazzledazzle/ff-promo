package com.ffpromo.telemetry.preflight

import com.ffpromo.contracts.GatePolicyInput
import com.ffpromo.contracts.GateRunContext
import com.ffpromo.contracts.MetricType
import com.ffpromo.contracts.PreflightCheckStatus
import com.ffpromo.telemetry.client.PrometheusInstantQueryData
import com.ffpromo.telemetry.support.QueuePrometheusClient
import com.ffpromo.telemetry.support.vector
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonArray
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class RunPreflightTest {
    private val runContext = GateRunContext(
        flagKey = "demo-feature-flag",
        treatmentVariationId = "treatment-var",
        controlVariationId = "control-var",
    )

    private val policies = listOf(
        GatePolicyInput(
            metricType = MetricType.error_rate,
            threshold = 0.01,
            serviceName = "demo-service",
            minSampleSize = 100,
        ),
    )

    @Test
    fun `passes when treatment and control samples and user context are present`() = runTest {
        val client = QueuePrometheusClient(mutableListOf(vector("200"), vector("200")))
        val report = runPreflightChecks(client, policies, runContext)
        assertEquals(PreflightCheckStatus.pass, report.status)
        assertEquals(
            listOf(
                "metric_flow_treatment",
                "metric_flow_control",
                "min_sample_treatment",
                "min_sample_control",
                "context_kind_user",
            ),
            report.checks.map { it.id },
        )
    }

    @Test
    fun `fails when treatment metric flow is missing`() = runTest {
        val client = QueuePrometheusClient(
            mutableListOf(
                PrometheusInstantQueryData(resultType = "vector", result = buildJsonArray {}),
                vector("200"),
            ),
        )
        val report = runPreflightChecks(client, policies, runContext)
        assertEquals(PreflightCheckStatus.fail, report.status)
        assertTrue(!report.blockReason.isNullOrBlank())
        assertEquals(
            PreflightCheckStatus.fail,
            report.checks.find { it.id == "metric_flow_treatment" }?.status,
        )
    }
}
