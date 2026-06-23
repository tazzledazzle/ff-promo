package com.ffpromo.telemetry.evaluate

import com.ffpromo.contracts.GatePolicyInput
import com.ffpromo.contracts.GateRunContext
import com.ffpromo.contracts.GateVerdictResult
import com.ffpromo.contracts.MetricType
import com.ffpromo.telemetry.support.QueuePrometheusClient
import com.ffpromo.telemetry.support.vector
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class EvaluateStageGatesTest {
    private val runContext = GateRunContext(
        flagKey = "demo-feature-flag",
        treatmentVariationId = "treatment-var",
        controlVariationId = "control-var",
    )

    @Test
    fun `passes when all policies pass`() = runTest {
        val client = QueuePrometheusClient(
            mutableListOf(
                vector("0.02"), vector("0.01"), vector("200"), vector("200"),
                vector("300"), vector("300"), vector("200"), vector("200"),
            ),
        )
        val result = evaluateStageGates(
            client,
            listOf(
                GatePolicyInput(MetricType.error_rate, 0.01, "demo-service", minSampleSize = 100),
                GatePolicyInput(MetricType.latency_p95, 500.0, "demo-service", minSampleSize = 100),
            ),
            runContext,
        )
        assertEquals(GateVerdictResult.pass, result.verdict)
        assertEquals(2, result.results.size)
    }

    @Test
    fun `fails when any policy fails`() = runTest {
        val client = QueuePrometheusClient(
            mutableListOf(
                vector("0.02"), vector("0.01"), vector("200"), vector("200"),
                vector("1000"), vector("300"), vector("200"), vector("200"),
            ),
        )
        val result = evaluateStageGates(
            client,
            listOf(
                GatePolicyInput(MetricType.error_rate, 0.01, "demo-service", minSampleSize = 100),
                GatePolicyInput(MetricType.latency_p95, 500.0, "demo-service", minSampleSize = 100),
            ),
            runContext,
        )
        assertEquals(GateVerdictResult.fail, result.verdict)
    }
}
