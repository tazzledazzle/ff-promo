package com.ffpromo.ldadapter.provider

import com.ffpromo.contracts.ApplyTargetingInput
import com.ffpromo.contracts.GetFlagStateInput
import com.ffpromo.contracts.LaunchDarklyClientConfig
import com.ffpromo.contracts.RolloutIntent
import com.ffpromo.contracts.TargetingIntent
import com.ffpromo.contracts.VariationRef
import com.ffpromo.ldadapter.client.SEMANTIC_PATCH_CONTENT_TYPE
import com.ffpromo.ldadapter.errors.ApprovalRequiredError
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class LaunchDarklyProviderTest {
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

    private fun provider(): LaunchDarklyProvider =
        createLaunchDarklyProvider(
            LaunchDarklyClientConfig(
                accessToken = "test-token",
                baseUrl = server.url("/").toString().trimEnd('/'),
            ),
        )

    @Test
    fun `PROV-01 reads flag state from GET fixture`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody(fixture("flag-boolean.json")))

        val state = provider().getFlagState(
            GetFlagStateInput(
                projectKey = "default",
                flagKey = "sample-feature",
                environmentKey = "production",
            ),
        )

        assertEquals(2, state.variations.size)
        assertEquals(true, state.environments["production"]?.on)
        assertEquals(1, server.requestCount)
    }

    @Test
    fun `PROV-02 and PROV-03 semantic patch with resolved variation ids`() = runTest {
        val flagFixture = fixture("flag-boolean.json")
        server.enqueue(MockResponse().setResponseCode(200).setBody(flagFixture))
        server.enqueue(MockResponse().setResponseCode(200).setBody(fixture("patch-canary-success.json")))
        server.enqueue(MockResponse().setResponseCode(200).setBody(flagFixture))

        provider().applyTargeting(
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

        server.takeRequest()
        val patchBody = server.takeRequest().body.readUtf8()
        assertTrue(patchBody.contains("turnFlagOn"))
        assertTrue(patchBody.contains("updateFallthroughVariationOrRollout"))
        assertTrue(patchBody.contains("\"var-on\":10000"))
        assertTrue(patchBody.contains("\"var-off\":90000"))
    }

    @Test
    fun `422 returns error with single PATCH attempt`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody(fixture("flag-boolean.json")))
        server.enqueue(MockResponse().setResponseCode(422).setBody(fixture("patch-422-invalid.json")))

        assertThrows<Throwable> {
            provider().applyTargeting(
                ApplyTargetingInput(
                    projectKey = "default",
                    flagKey = "sample-feature",
                    intent = TargetingIntent(environmentKey = "production", turnOn = true),
                ),
            )
        }

        server.takeRequest()
        server.takeRequest()
        assertEquals(2, server.requestCount)
    }

    @Test
    fun `429 then 200 retries successfully`() = runTest {
        val flagFixture = fixture("flag-boolean.json")
        server.enqueue(MockResponse().setResponseCode(200).setBody(flagFixture))
        server.enqueue(
            MockResponse()
                .setResponseCode(429)
                .setBody(fixture("patch-429-retry.json"))
                .addHeader("Retry-After", "0"),
        )
        server.enqueue(MockResponse().setResponseCode(200).setBody(fixture("patch-canary-success.json")))
        server.enqueue(MockResponse().setResponseCode(200).setBody(flagFixture))

        provider().applyTargeting(
            ApplyTargetingInput(
                projectKey = "default",
                flagKey = "sample-feature",
                intent = TargetingIntent(environmentKey = "production", turnOn = true),
            ),
        )

        assertEquals(4, server.requestCount)
    }

    @Test
    fun `405 maps to ApprovalRequiredError`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody(fixture("flag-boolean.json")))
        server.enqueue(
            MockResponse()
                .setResponseCode(405)
                .setBody("""{"message":"approval required"}"""),
        )

        assertThrows<ApprovalRequiredError> {
            provider().applyTargeting(
                ApplyTargetingInput(
                    projectKey = "default",
                    flagKey = "sample-feature",
                    intent = TargetingIntent(environmentKey = "production", turnOn = true),
                ),
            )
        }
    }

    @Test
    fun `uses semantic patch content type on PATCH requests`() = runTest {
        val flagFixture = fixture("flag-boolean.json")
        server.enqueue(MockResponse().setResponseCode(200).setBody(flagFixture))
        server.enqueue(MockResponse().setResponseCode(200).setBody(fixture("patch-canary-success.json")))
        server.enqueue(MockResponse().setResponseCode(200).setBody(flagFixture))

        provider().applyTargeting(
            ApplyTargetingInput(
                projectKey = "default",
                flagKey = "sample-feature",
                intent = TargetingIntent(environmentKey = "production", turnOn = true),
            ),
        )

        server.takeRequest()
        val patchRequest = server.takeRequest()
        assertTrue(patchRequest.getHeader("Content-Type")!!.contains(SEMANTIC_PATCH_CONTENT_TYPE.split(';')[0]))
        assertTrue(patchRequest.getHeader("Content-Type")!!.contains("launchdarkly.semanticpatch"))
    }
}
