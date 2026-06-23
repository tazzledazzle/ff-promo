package com.ffpromo.telemetry

import com.ffpromo.contracts.GatePolicyInput
import com.ffpromo.contracts.GateRunContext
import com.ffpromo.contracts.GateVerdictResult
import com.ffpromo.contracts.MetricType
import com.ffpromo.contracts.PreflightCheckStatus
import com.ffpromo.contracts.PrometheusClientConfig
import com.ffpromo.telemetry.client.createPrometheusClient
import com.ffpromo.telemetry.evaluate.evaluateGatePolicy
import com.ffpromo.telemetry.evaluate.evaluateStageGates
import com.ffpromo.telemetry.preflight.runPreflightChecks
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class TelemetryIntegrationTest {
    private lateinit var server: MockWebServer

    private val runContext = GateRunContext(
        flagKey = "demo-feature-flag",
        treatmentVariationId = "treatment-var-id",
        controlVariationId = "control-var-id",
    )

    private val errorRatePolicy = GatePolicyInput(
        metricType = MetricType.error_rate,
        threshold = 0.01,
        serviceName = "demo-service",
        windowSeconds = 300,
        minSampleSize = 100,
    )

    private val latencyPolicy = GatePolicyInput(
        metricType = MetricType.latency_p95,
        threshold = 500.0,
        serviceName = "demo-service",
        windowSeconds = 300,
        minSampleSize = 100,
    )

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    private fun loadFixture(name: String): String =
        this::class.java.getResource("/fixtures/$name")!!.readText()

    private fun promqlFromPath(path: String?): String {
        if (path == null) return ""
        val queryIndex = path.indexOf("query=")
        if (queryIndex < 0) return ""
        val raw = path.substring(queryIndex + 6).substringBefore("&")
        return java.net.URLDecoder.decode(raw, Charsets.UTF_8)
    }

    private fun replyForQuery(query: String): String = when {
        query.contains("treatment-var-id") && query.contains("increase(") ->
            loadFixture("prometheus-sample-count-high.json")
        query.contains("control-var-id") && query.contains("increase(") ->
            loadFixture("prometheus-sample-count-high.json")
        query.contains("treatment-var-id") && query.contains("histogram_quantile") ->
            loadFixture("prometheus-treatment-latency.json")
        query.contains("control-var-id") && query.contains("histogram_quantile") ->
            loadFixture("prometheus-control-latency.json")
        query.contains("treatment-var-id") && query.contains("""status=~"5.."""") ->
            loadFixture("prometheus-treatment-error-rate.json")
        query.contains("control-var-id") && query.contains("""status=~"5.."""") ->
            loadFixture("prometheus-control-error-rate.json")
        query.contains("treatment-var-id") ->
            loadFixture("prometheus-treatment-error-rate.json")
        query.contains("control-var-id") ->
            loadFixture("prometheus-control-error-rate.json")
        else -> loadFixture("prometheus-vector-empty.json")
    }

    private fun metadataReason(result: com.ffpromo.contracts.GateEvaluationResult): String? =
        com.ffpromo.telemetry.support.metadataReason(result)

    @Test
    fun `TELE-03 error rate delta pass at HTTP boundary`() = runTest {
        server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: okhttp3.mockwebserver.RecordedRequest): MockResponse {
                val promql = promqlFromPath(request.path)
                val data = replyForQuery(promql)
                return MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"status":"success","data":$data}""")
            }
        }

        val client = createPrometheusClient(
            PrometheusClientConfig(baseUrl = server.url("/").toString().trimEnd('/')),
        )
        val result = evaluateGatePolicy(client, errorRatePolicy, runContext)

        assertEquals(GateVerdictResult.pass, result.verdict)
        assertEquals(0.01, result.observedDelta!!, 0.0001)
        assertEquals(4, server.requestCount)
    }

    @Test
    fun `TELE-03 threshold exceeded fails at HTTP boundary`() = runTest {
        server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: okhttp3.mockwebserver.RecordedRequest): MockResponse {
                val promql = promqlFromPath(request.path)
                val data = if (promql.contains("treatment-var-id") && promql.contains("""status=~"5.."""")) {
                    loadFixture("prometheus-treatment-error-rate-fail.json")
                } else {
                    replyForQuery(promql)
                }
                return MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"status":"success","data":$data}""")
            }
        }

        val client = createPrometheusClient(
            PrometheusClientConfig(baseUrl = server.url("/").toString().trimEnd('/')),
        )
        val result = evaluateGatePolicy(client, errorRatePolicy, runContext)

        assertEquals(GateVerdictResult.fail, result.verdict)
        assertEquals("threshold_exceeded", metadataReason(result))
    }

    @Test
    fun `TELE-03 empty vector fails closed with no_data`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody(
                    """{"status":"success","data":${loadFixture("prometheus-vector-empty.json")}}""",
                ),
        )
        repeat(3) {
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody(
                        """{"status":"success","data":${loadFixture("prometheus-vector-empty.json")}}""",
                    ),
            )
        }

        val client = createPrometheusClient(
            PrometheusClientConfig(baseUrl = server.url("/").toString().trimEnd('/')),
        )
        val result = evaluateGatePolicy(client, errorRatePolicy, runContext)

        assertEquals(GateVerdictResult.fail, result.verdict)
        assertEquals("no_data", metadataReason(result))
    }

    @Test
    fun `TELE-03 insufficient samples fail closed`() = runTest {
        server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: okhttp3.mockwebserver.RecordedRequest): MockResponse {
                val promql = promqlFromPath(request.path)
                val data = if (promql.contains("increase(")) {
                    loadFixture("prometheus-sample-count-low.json")
                } else {
                    replyForQuery(promql)
                }
                return MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"status":"success","data":$data}""")
            }
        }

        val client = createPrometheusClient(
            PrometheusClientConfig(baseUrl = server.url("/").toString().trimEnd('/')),
        )
        val result = evaluateGatePolicy(client, errorRatePolicy, runContext)

        assertEquals(GateVerdictResult.fail, result.verdict)
        assertEquals("insufficient_samples", metadataReason(result))
    }

    @Test
    fun `TELE-03 stage fails when one policy fails`() = runTest {
        var call = 0
        server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: okhttp3.mockwebserver.RecordedRequest): MockResponse {
                call += 1
                val promql = promqlFromPath(request.path)
                val data = when {
                    call <= 4 -> replyForQuery(promql)
                    promql.contains("histogram_quantile") && promql.contains("treatment-var-id") ->
                        """{"resultType":"vector","result":[{"metric":{},"value":[0,"1000"]}]}"""
                    promql.contains("increase(") ->
                        loadFixture("prometheus-sample-count-high.json")
                    else -> loadFixture("prometheus-control-latency.json")
                }
                return MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"status":"success","data":$data}""")
            }
        }

        val client = createPrometheusClient(
            PrometheusClientConfig(baseUrl = server.url("/").toString().trimEnd('/')),
        )
        val result = evaluateStageGates(client, listOf(errorRatePolicy, latencyPolicy), runContext)

        assertEquals(GateVerdictResult.fail, result.verdict)
    }

    @Test
    fun `TELE-04 preflight passes when checks succeed`() = runTest {
        repeat(2) {
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody(
                        """{"status":"success","data":${loadFixture("prometheus-sample-count-high.json")}}""",
                    ),
            )
        }

        val client = createPrometheusClient(
            PrometheusClientConfig(baseUrl = server.url("/").toString().trimEnd('/')),
        )
        val report = runPreflightChecks(client, listOf(errorRatePolicy), runContext)

        assertEquals(PreflightCheckStatus.pass, report.status)
        assertEquals(2, server.requestCount)
    }

    @Test
    fun `TELE-04 preflight fails with blockReason when treatment missing`() = runTest {
        server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: okhttp3.mockwebserver.RecordedRequest): MockResponse {
                val promql = promqlFromPath(request.path)
                val data = if (promql.contains("treatment-var-id")) {
                    loadFixture("prometheus-vector-empty.json")
                } else {
                    loadFixture("prometheus-sample-count-high.json")
                }
                return MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"status":"success","data":$data}""")
            }
        }

        val client = createPrometheusClient(
            PrometheusClientConfig(baseUrl = server.url("/").toString().trimEnd('/')),
        )
        val report = runPreflightChecks(client, listOf(errorRatePolicy), runContext)

        assertEquals(PreflightCheckStatus.fail, report.status)
        assertTrue(!report.blockReason.isNullOrBlank())
    }
}
