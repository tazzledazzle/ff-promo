package com.ffpromo.ldadapter.client

import com.ffpromo.contracts.LaunchDarklyClientConfig
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class LdApiClientTest {
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
    fun `createLaunchDarklyClient sets LD-API-Version and Authorization on GET`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("""{"key":"sample-feature","variations":[],"environments":{}}"""),
        )

        val rawClient = createLaunchDarklyClient(
            LaunchDarklyClientConfig(
                accessToken = "test-token",
                baseUrl = server.url("/").toString().trimEnd('/'),
            ),
        )
        val client = LdApiClient(rawClient)
        client.getFeatureFlag("default", "sample-feature")

        val request = server.takeRequest()
        assertEquals("test-token", request.getHeader("Authorization"))
        assertEquals(DEFAULT_LD_API_VERSION, request.getHeader("LD-API-Version"))
        assertTrue(request.path!!.contains("/api/v2/flags/default/sample-feature"))
    }

    @Test
    fun `createLaunchDarklyClient respects baseUrl override`() {
        val rawClient = createLaunchDarklyClient(
            LaunchDarklyClientConfig(
                accessToken = "test-token",
                baseUrl = "https://app.eu.launchdarkly.com",
            ),
        )

        assertEquals("https://app.eu.launchdarkly.com", rawClient.config.baseUrl)
        assertEquals(DEFAULT_LD_API_VERSION, rawClient.config.apiVersion)
        assertEquals("test-token", rawClient.config.accessToken)
    }
}
