package com.ffpromo.telemetry.evaluate

import com.ffpromo.contracts.GatePolicyInput
import com.ffpromo.contracts.GateRunContext
import com.ffpromo.contracts.GateVerdictResult
import com.ffpromo.contracts.MetricType
import com.ffpromo.telemetry.client.PrometheusInstantQueryData
import com.ffpromo.telemetry.support.QueuePrometheusClient
import com.ffpromo.telemetry.support.metadataReason
import com.ffpromo.telemetry.support.vector
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonArray
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class EvaluateGatePolicyTest {
    private val runContext = GateRunContext(
        flagKey = "demo-feature-flag",
        treatmentVariationId = "treatment-var",
        controlVariationId = "control-var",
    )

    @Test
    fun `passes when delta equals threshold`() = runTest {
        val client = QueuePrometheusClient(
            mutableListOf(vector("0.02"), vector("0.01"), vector("200"), vector("200")),
        )
        val result = evaluateGatePolicy(
            client,
            GatePolicyInput(
                metricType = MetricType.error_rate,
                threshold = 0.01,
                serviceName = "demo-service",
                minSampleSize = 100,
            ),
            runContext,
        )
        assertEquals(GateVerdictResult.pass, result.verdict)
        assertEquals(0.01, result.observedDelta!!, 0.0001)
    }

    @Test
    fun `fails when delta exceeds threshold`() = runTest {
        val client = QueuePrometheusClient(
            mutableListOf(vector("0.05"), vector("0.01"), vector("200"), vector("200")),
        )
        val result = evaluateGatePolicy(
            client,
            GatePolicyInput(
                metricType = MetricType.error_rate,
                threshold = 0.01,
                serviceName = "demo-service",
                minSampleSize = 100,
            ),
            runContext,
        )
        assertEquals(GateVerdictResult.fail, result.verdict)
        assertEquals("threshold_exceeded", metadataReason(result))
    }

    @Test
    fun `fails closed on empty treatment data`() = runTest {
        val client = QueuePrometheusClient(
            mutableListOf(
                PrometheusInstantQueryData(resultType = "vector", result = buildJsonArray {}),
                vector("0.01"),
                vector("200"),
                vector("200"),
            ),
        )
        val result = evaluateGatePolicy(
            client,
            GatePolicyInput(
                metricType = MetricType.error_rate,
                threshold = 0.01,
                serviceName = "demo-service",
            ),
            runContext,
        )
        assertEquals(GateVerdictResult.fail, result.verdict)
        assertEquals("no_data", metadataReason(result))
    }

    @Test
    fun `fails on insufficient samples`() = runTest {
        val client = QueuePrometheusClient(
            mutableListOf(vector("0.02"), vector("0.01"), vector("50"), vector("200")),
        )
        val result = evaluateGatePolicy(
            client,
            GatePolicyInput(
                metricType = MetricType.error_rate,
                threshold = 0.01,
                serviceName = "demo-service",
                minSampleSize = 100,
            ),
            runContext,
        )
        assertEquals(GateVerdictResult.fail, result.verdict)
        assertEquals("insufficient_samples", metadataReason(result))
    }

    @Test
    fun `evaluates latency_p95 delta in milliseconds`() = runTest {
        val client = QueuePrometheusClient(
            mutableListOf(vector("900"), vector("300"), vector("200"), vector("200")),
        )
        val result = evaluateGatePolicy(
            client,
            GatePolicyInput(
                metricType = MetricType.latency_p95,
                threshold = 500.0,
                serviceName = "demo-service",
                minSampleSize = 100,
            ),
            runContext,
        )
        assertEquals(GateVerdictResult.fail, result.verdict)
        assertEquals(600.0, result.observedDelta)
    }
}
