package com.ffpromo.ldadapter.read

import com.ffpromo.contracts.GetFlagStateInput
import com.ffpromo.ldadapter.client.LaunchDarklyRawClient
import com.ffpromo.ldadapter.client.ResolvedLaunchDarklyConfig
import com.ffpromo.ldadapter.errors.LdApiError
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import com.launchdarkly.api.api.FeatureFlagsApi
import com.launchdarkly.api.ApiClient

class GetFlagStateTest {
    private lateinit var server: MockWebServer
    private val json = Json { ignoreUnknownKeys = true }

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    private fun fixture(name: String): String =
        javaClass.getResource("/fixtures/$name")!!.readText()

    private fun mockClient(): LaunchDarklyRawClient {
        val apiClient = ApiClient()
        apiClient.basePath = server.url("/").toString().trimEnd('/')
        return LaunchDarklyRawClient(
            flagsApi = FeatureFlagsApi(apiClient),
            config = ResolvedLaunchDarklyConfig(
                accessToken = "test",
                baseUrl = server.url("/").toString().trimEnd('/'),
                apiVersion = "20240415",
            ),
            httpClient = OkHttpClient(),
        )
    }

    @Test
    fun `getFlagState calls GET and returns FlagState-valid object`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody(fixture("flag-boolean.json")))

        val flagState = getFlagState(
            GetFlagStateDeps(mockClient()),
            GetFlagStateInput(
                projectKey = "default",
                flagKey = "sample-feature",
                environmentKey = "production",
            ),
        )

        assertEquals("sample-feature", flagState.flagKey)
        assertEquals(true, flagState.environments["production"]?.on)
        assertEquals(1, server.requestCount)
    }

    @Test
    fun `getFlagState throws when environment key is missing`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody(fixture("flag-boolean.json")))

        assertThrows<LdApiError> {
            getFlagState(
                GetFlagStateDeps(mockClient()),
                GetFlagStateInput(
                    projectKey = "default",
                    flagKey = "sample-feature",
                    environmentKey = "missing-env",
                ),
            )
        }
    }
}

class MappersTest {
    private val json = Json { ignoreUnknownKeys = true }

    private fun fixture(name: String): String =
        javaClass.getResource("/fixtures/$name")!!.readText()

    @Test
    fun `mapLdFlagToFlagState maps boolean flag fixture`() {
        val raw = json.parseToJsonElement(fixture("flag-boolean.json")).jsonObject
        val flagState = mapLdFlagToFlagState(raw, "default", "sample-feature")

        assertEquals(2, flagState.variations.size)
        assertEquals("var-off", flagState.variations[0].id)
        assertEquals("Off", flagState.variations[0].name)
        assertEquals(true, flagState.environments["production"]?.on)
        assertEquals("rule-prod-1", flagState.environments["production"]?.rules?.first()?.id)
        assertEquals(false, flagState.environments["staging"]?.on)
    }

    @Test
    fun `mapLdFlagToFlagState maps multivariate flag fixture`() {
        val raw = json.parseToJsonElement(fixture("flag-multivariate.json")).jsonObject
        val flagState = mapLdFlagToFlagState(raw, "default", "multivariate-flag")

        assertEquals(listOf("Control", "Treatment", "Variant C"), flagState.variations.map { it.name })
    }
}
