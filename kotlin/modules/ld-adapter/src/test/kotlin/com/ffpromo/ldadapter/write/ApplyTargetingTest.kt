package com.ffpromo.ldadapter.write

import com.ffpromo.contracts.ApplyTargetingInput
import com.ffpromo.contracts.RolloutIntent
import com.ffpromo.contracts.TargetingIntent
import com.ffpromo.contracts.VariationRef
import com.ffpromo.ldadapter.client.LaunchDarklyRawClient
import com.ffpromo.ldadapter.client.RateLimitedLdClient
import com.ffpromo.ldadapter.client.ResolvedLaunchDarklyConfig
import com.ffpromo.ldadapter.client.SEMANTIC_PATCH_CONTENT_TYPE
import com.ffpromo.ldadapter.errors.UnresolvedVariationError
import com.launchdarkly.api.ApiClient
import com.launchdarkly.api.api.FeatureFlagsApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class ApplyTargetingTest {
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

    private fun createStack(): TestStack {
        val flagFixture = fixture("flag-boolean.json")
        val rawClient = LaunchDarklyRawClient(
            flagsApi = FeatureFlagsApi(ApiClient()),
            config = ResolvedLaunchDarklyConfig(
                accessToken = "test-token",
                baseUrl = server.url("/").toString().trimEnd('/'),
                apiVersion = "20240415",
            ),
            httpClient = OkHttpClient(),
        )
        val rateLimitedClient = RateLimitedLdClient.create(rawClient)
        return TestStack(rawClient, rateLimitedClient, flagFixture)
    }

    private data class TestStack(
        val rawClient: LaunchDarklyRawClient,
        val rateLimitedClient: RateLimitedLdClient,
        val flagFixture: String,
    )

    @Test
    fun `GET-before-write getFeatureFlag before PATCH`() = runTest {
        val stack = createStack()
        val callOrder = mutableListOf<String>()

        server.enqueue(MockResponse().setResponseCode(200).setBody(stack.flagFixture))
        server.enqueue(MockResponse().setResponseCode(200).setBody("{}"))
        server.enqueue(MockResponse().setResponseCode(200).setBody(stack.flagFixture))

        applyTargeting(
            ApplyTargetingDeps(stack.rateLimitedClient),
            ApplyTargetingInput(
                projectKey = "default",
                flagKey = "sample-feature",
                intent = TargetingIntent(
                    environmentKey = "production",
                    rollout = RolloutIntent(
                        mode = "fallthrough",
                        treatmentVariationRef = VariationRef.ByValue(JsonPrimitive(true)),
                        controlVariationRef = VariationRef.ByValue(JsonPrimitive(false)),
                        treatmentPercentThousandths = 10_000,
                        rolloutContextKind = "user",
                        rolloutBucketBy = "user",
                    ),
                ),
            ),
        )

        assertEquals("GET", server.takeRequest().method)
        assertEquals("PATCH", server.takeRequest().method)
        assertEquals("GET", server.takeRequest().method)
    }

    @Test
    fun `routes GET and PATCH through rateLimitedClient schedule`() = runTest {
        val stack = createStack()
        server.enqueue(MockResponse().setResponseCode(200).setBody(stack.flagFixture))
        server.enqueue(MockResponse().setResponseCode(200).setBody("{}"))
        server.enqueue(MockResponse().setResponseCode(200).setBody(stack.flagFixture))

        applyTargeting(
            ApplyTargetingDeps(stack.rateLimitedClient),
            ApplyTargetingInput(
                projectKey = "default",
                flagKey = "sample-feature",
                intent = TargetingIntent(environmentKey = "production", turnOn = true),
            ),
        )

        assertEquals(3, server.requestCount)
    }

    @Test
    fun `sets semantic patch Content-Type on PATCH`() = runTest {
        val stack = createStack()
        server.enqueue(MockResponse().setResponseCode(200).setBody(stack.flagFixture))
        server.enqueue(MockResponse().setResponseCode(200).setBody("{}"))
        server.enqueue(MockResponse().setResponseCode(200).setBody(stack.flagFixture))

        applyTargeting(
            ApplyTargetingDeps(stack.rateLimitedClient),
            ApplyTargetingInput(
                projectKey = "default",
                flagKey = "sample-feature",
                intent = TargetingIntent(environmentKey = "production", turnOn = true),
            ),
        )

        server.takeRequest()
        val patchRequest = server.takeRequest()
        assertEquals("PATCH", patchRequest.method)
        assertTrue(patchRequest.getHeader("Content-Type")!!.startsWith(SEMANTIC_PATCH_CONTENT_TYPE))
    }

    @Test
    fun `throws UnresolvedVariationError before patch when ref cannot resolve`() = runTest {
        val stack = createStack()
        server.enqueue(MockResponse().setResponseCode(200).setBody(stack.flagFixture))

        assertThrows<UnresolvedVariationError> {
            applyTargeting(
                ApplyTargetingDeps(stack.rateLimitedClient),
                ApplyTargetingInput(
                    projectKey = "default",
                    flagKey = "sample-feature",
                    intent = TargetingIntent(
                        environmentKey = "production",
                        rollout = RolloutIntent(
                            mode = "fallthrough",
                            treatmentVariationRef = VariationRef.ByValue(JsonPrimitive("missing")),
                            controlVariationRef = VariationRef.ByValue(JsonPrimitive(false)),
                            treatmentPercentThousandths = 10_000,
                            rolloutContextKind = "user",
                            rolloutBucketBy = "user",
                        ),
                    ),
                ),
            )
        }

        assertEquals(1, server.requestCount)
    }

    @Test
    fun `uses resolveRuleId when rollout mode is rule`() = runTest {
        val stack = createStack()
        server.enqueue(MockResponse().setResponseCode(200).setBody(stack.flagFixture))
        server.enqueue(MockResponse().setResponseCode(200).setBody("{}"))
        server.enqueue(MockResponse().setResponseCode(200).setBody(stack.flagFixture))

        applyTargeting(
            ApplyTargetingDeps(stack.rateLimitedClient),
            ApplyTargetingInput(
                projectKey = "default",
                flagKey = "sample-feature",
                intent = TargetingIntent(
                    environmentKey = "production",
                    rollout = RolloutIntent(
                        mode = "rule",
                        ruleRef = com.ffpromo.contracts.RuleRef.ById("rule-prod-1"),
                        treatmentVariationRef = VariationRef.ByValue(JsonPrimitive(true)),
                        controlVariationRef = VariationRef.ByValue(JsonPrimitive(false)),
                        treatmentPercentThousandths = 10_000,
                        rolloutContextKind = "user",
                        rolloutBucketBy = "user",
                    ),
                ),
            ),
        )

        server.takeRequest()
        val patchBody = server.takeRequest().body.readUtf8()
        assertTrue(patchBody.contains("updateRuleVariationOrRollout"))
        assertTrue(patchBody.contains("rule-prod-1"))
    }
}
