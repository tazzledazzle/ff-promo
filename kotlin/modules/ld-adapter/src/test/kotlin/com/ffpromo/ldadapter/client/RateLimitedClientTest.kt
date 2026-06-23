package com.ffpromo.ldadapter.client

import com.ffpromo.ldadapter.errors.HttpResponseError
import com.ffpromo.ldadapter.errors.ApprovalRequiredError
import com.ffpromo.ldadapter.errors.LdRateLimitError
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.random.Random

class RateLimitedClientTest {
    private val rawClient = LaunchDarklyRawClient(
        flagsApi = com.launchdarkly.api.api.FeatureFlagsApi(com.launchdarkly.api.ApiClient()),
        config = ResolvedLaunchDarklyConfig(
            accessToken = "test",
            baseUrl = "https://app.launchdarkly.com",
            apiVersion = "20240415",
        ),
        httpClient = okhttp3.OkHttpClient(),
    )

    @Test
    fun `passes successful calls through without retry`() = runTest {
        val client = createRateLimitedLdClient(rawClient)
        var calls = 0
        val result = client.schedule {
            calls++
            "ok"
        }
        assertEquals("ok", result)
        assertEquals(1, calls)
    }

    @Test
    fun `retries 429 honoring Retry-After header`() = runTest {
        var sleepCalls = 0
        val client = createRateLimitedLdClient(
            rawClient,
            RateLimitedLdClientOptions(
                sleep = { sleepCalls++ },
                retries = 2,
                jitterMs = 0,
                random = Random(0),
            ),
        )
        var calls = 0
        val result = client.schedule {
            calls++
            if (calls == 1) {
                throw HttpResponseError(
                    message = "rate limited",
                    status = 429,
                    headers = mapOf("retry-after" to "1"),
                )
            }
            "ok"
        }

        assertEquals("ok", result)
        assertEquals(2, calls)
        assertEquals(1, sleepCalls)
        assertEquals(
            1000L,
            computeRetryDelayMs(
                HttpResponseError("rate limited", 429, headers = mapOf("retry-after" to "1")),
                jitterMs = 0,
                random = Random(0),
            ),
        )
    }

    @Test
    fun `does not retry 422 fail-fast errors`() = runTest {
        val client = createRateLimitedLdClient(rawClient)
        var calls = 0
        val error = assertThrows<LdApiErrorWrapper> {
            client.schedule {
                calls++
                throw LdApiErrorWrapper("invalid", 422)
            }
        }
        assertEquals(422, error.status)
        assertEquals(1, calls)
    }

    @Test
    fun `maps 405 to ApprovalRequiredError`() = runTest {
        val client = createRateLimitedLdClient(rawClient)
        assertThrows<ApprovalRequiredError> {
            client.schedule {
                throw LdApiErrorWrapper("approval required", 405)
            }
        }
    }

    @Test
    fun `throws LdRateLimitError after retries exhausted on 429`() = runTest {
        val client = createRateLimitedLdClient(
            rawClient,
            RateLimitedLdClientOptions(
                sleep = {},
                retries = 1,
                jitterMs = 0,
                random = Random(0),
            ),
        )
        assertThrows<LdRateLimitError> {
            client.schedule {
                throw HttpResponseError(
                    message = "rate limited",
                    status = 429,
                    headers = mapOf("retry-after" to "1"),
                )
            }
        }
    }
}
