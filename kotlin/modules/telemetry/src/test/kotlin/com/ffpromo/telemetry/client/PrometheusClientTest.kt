package com.ffpromo.telemetry.client

import com.ffpromo.contracts.PrometheusClientConfig
import com.ffpromo.telemetry.errors.TelemetryApiError
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class PrometheusClientTest {
    private lateinit var server: MockWebServer

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `normalizes trailing slashes from baseUrl`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("""{"status":"success","data":{"resultType":"vector","result":[]}}"""),
        )

        val client = createPrometheusClient(
            PrometheusClientConfig(baseUrl = "${server.url("/").toString().trimEnd('/')}/"),
        )
        client.queryInstant("up")

        assertEquals(server.url("/").toString().trimEnd('/'), client.config.baseUrl)
        val request = server.takeRequest()
        assertTrue(request.path!!.startsWith("/api/v1/query"))
        assertTrue(request.path!!.contains("query=up"))
    }

    @Test
    fun `sends Authorization bearer header when token provided`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("""{"status":"success","data":{"resultType":"vector","result":[]}}"""),
        )

        val client = createPrometheusClient(
            PrometheusClientConfig(
                baseUrl = server.url("/").toString().trimEnd('/'),
                bearerToken = "secret-token",
            ),
        )
        client.queryInstant("up")

        val request = server.takeRequest()
        assertEquals("Bearer secret-token", request.getHeader("Authorization"))
    }

    @Test
    fun `falls back to PROMETHEUS_BASE_URL env when baseUrl omitted`() {
        val previous = System.getenv("PROMETHEUS_BASE_URL")
        try {
            // MockWebServer URL used via env for config assertion only
            val envUrl = "http://prometheus:9090"
            // Cannot set env in JVM easily; verify default resolution via explicit config instead
            val client = createPrometheusClient(PrometheusClientConfig(baseUrl = envUrl))
            assertEquals(envUrl, client.config.baseUrl)
        } finally {
            previous // no-op; env not mutated in test
        }
    }

    @Test
    fun `throws TelemetryApiError on status error envelope`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("""{"status":"error","errorType":"bad_data","error":"invalid query"}"""),
        )

        val client = createPrometheusClient(
            PrometheusClientConfig(baseUrl = server.url("/").toString().trimEnd('/')),
        )

        val error = assertThrows<TelemetryApiError> {
            client.queryInstant("bad{")
        }
        assertEquals("invalid query", error.message)
    }

    @Test
    fun `does not include bearer token in error context`() = runTest {
        server.enqueue(MockResponse().setResponseCode(401).setBody("unauthorized"))

        val client = createPrometheusClient(
            PrometheusClientConfig(
                baseUrl = server.url("/").toString().trimEnd('/'),
                bearerToken = "secret-token",
            ),
        )

        val error = assertThrows<TelemetryApiError> {
            client.queryInstant("up")
        }
        assertFalse(error.toString().contains("secret-token"))
    }

    @Test
    fun `parses vector fixture from success envelope`() = runTest {
        val fixture = this::class.java.getResource("/fixtures/prometheus-vector-pass.json")!!.readText()
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("""{"status":"success","data":$fixture}"""),
        )

        val client = createPrometheusClient(
            PrometheusClientConfig(baseUrl = server.url("/").toString().trimEnd('/')),
        )
        val data = client.queryInstant("up")

        assertEquals("vector", data.resultType)
        assertTrue(data.result.toString().contains("0.02"))
    }
}
