package com.ffpromo.ldadapter.client

import com.ffpromo.ldadapter.errors.ApprovalRequiredError
import com.ffpromo.ldadapter.errors.HttpResponseError
import com.ffpromo.ldadapter.errors.LdApiError
import com.ffpromo.ldadapter.errors.LdRateLimitError
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlin.random.Random

data class RateLimitedLdClientOptions(
    val maxConcurrent: Int = 2,
    val retries: Int = 4,
    val jitterMs: Long = 500,
    val sleep: suspend (Long) -> Unit = { ms -> delay(ms) },
    val random: Random = Random.Default,
)

class RateLimitedLdClient private constructor(
    val rawClient: LaunchDarklyRawClient,
    private val options: RateLimitedLdClientOptions,
    private val semaphore: Semaphore,
) {
    suspend fun <T> schedule(fn: suspend () -> T): T = semaphore.withPermit {
        var lastError: Throwable? = null
        repeat(options.retries + 1) { attempt ->
            try {
                return fn()
            } catch (error: Throwable) {
                val normalized = normalizeThrownError(error)
                lastError = normalized
                if (!shouldRetry(normalized) || attempt >= options.retries) {
                    if (extractStatus(normalized) == 429 && attempt >= options.retries) {
                        throw LdRateLimitError(
                            message = "LaunchDarkly rate limit retries exhausted",
                            retryAfterMs = computeRetryDelayMs(normalized, options.jitterMs, options.random),
                            context = mapOf("status" to 429),
                        )
                    }
                    throw mapHttpError(normalized)
                }
                val delayMs = computeRetryDelayMs(normalized, options.jitterMs, options.random)
                options.sleep(delayMs)
            }
        }
        throw lastError ?: IllegalStateException("schedule failed without error")
    }

    companion object {
        fun create(
            rawClient: LaunchDarklyRawClient,
            options: RateLimitedLdClientOptions = RateLimitedLdClientOptions(),
        ): RateLimitedLdClient = RateLimitedLdClient(
            rawClient = rawClient,
            options = options,
            semaphore = Semaphore(options.maxConcurrent),
        )
    }
}

fun createRateLimitedLdClient(
    rawClient: LaunchDarklyRawClient,
    options: RateLimitedLdClientOptions = RateLimitedLdClientOptions(),
): RateLimitedLdClient = RateLimitedLdClient.create(rawClient, options)

fun extractStatus(error: Throwable): Int? =
    when (error) {
        is HttpResponseError -> error.status
        is LdApiErrorWrapper -> error.status
        else -> null
    }

class LdApiErrorWrapper(
    message: String,
    val status: Int,
    val responseHeaders: Map<String, String> = emptyMap(),
) : Exception(message)

fun computeRetryDelayMs(
    error: Throwable,
    jitterMs: Long = 500,
    random: Random = Random.Default,
): Long {
    val headers = when (error) {
        is HttpResponseError -> error.headers
        is LdApiErrorWrapper -> error.responseHeaders
        else -> emptyMap()
    }

    headerValue(headers, "retry-after")?.toIntOrNull()?.let { seconds ->
        return seconds * 1000L + if (jitterMs > 0) random.nextLong(jitterMs) else 0L
    }

    headerValue(headers, "x-ratelimit-reset")?.toLongOrNull()?.let { resetMs ->
        return maxOf(0, resetMs - System.currentTimeMillis()) + if (jitterMs > 0) random.nextLong(jitterMs) else 0L
    }

    return 1000L + if (jitterMs > 0) random.nextLong(jitterMs) else 0L
}

fun mapHttpError(error: Throwable, environmentKey: String? = null): Throwable {
    val status = extractStatus(error)
    return when (status) {
        405 -> ApprovalRequiredError(
            message = "LaunchDarkly environment requires approval before changes",
            environmentKey = environmentKey,
            context = mapOf("status" to status),
        )
        429 -> LdRateLimitError(
            message = "LaunchDarkly rate limit exceeded",
            retryAfterMs = computeRetryDelayMs(error),
            context = mapOf("status" to status),
        )
        else -> error
    }
}

fun normalizeThrownError(error: Throwable): Throwable =
    when (error) {
        is HttpResponseError -> error
        is LdApiErrorWrapper -> error
        else -> error
    }

fun shouldRetry(error: Throwable): Boolean {
    val status = extractStatus(error) ?: return false
    if (status == 405 || status == 422) return false
    if (status == 429) return true
    return status >= 500
}

private fun headerValue(headers: Map<String, String>, name: String): String? {
    headers[name]?.let { return it }
    headers.entries.firstOrNull { it.key.equals(name, ignoreCase = true) }?.value?.let { return it }
    return null
}
