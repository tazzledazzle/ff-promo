package com.ffpromo.telemetry.client

import com.ffpromo.contracts.PrometheusClientConfig
import com.ffpromo.telemetry.errors.TelemetryApiError
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URI

const val DEFAULT_PROMETHEUS_BASE_URL = "http://localhost:9090"

data class ResolvedPrometheusConfig(
    val baseUrl: String,
    val bearerToken: String? = null,
    val timeout: String? = null,
)

data class PrometheusInstantQueryData(
    val resultType: String,
    val result: JsonElement,
)

interface PrometheusClient {
    val config: ResolvedPrometheusConfig

    suspend fun queryInstant(query: String, timeout: String? = null): PrometheusInstantQueryData
}

@Serializable
private data class PrometheusQueryEnvelope(
    val status: String,
    val data: PrometheusInstantQueryDataDto? = null,
    val error: String? = null,
    @SerialName("errorType")
    val errorType: String? = null,
)

@Serializable
private data class PrometheusInstantQueryDataDto(
    val resultType: String,
    val result: JsonElement,
)

private val json = Json { ignoreUnknownKeys = true }

private fun assertHttpOrHttpsUrl(baseUrl: String) {
    val parsed = try {
        URI(baseUrl)
    } catch (_: Exception) {
        throw TelemetryApiError("Invalid Prometheus baseUrl", 0, null, mapOf("baseUrl" to baseUrl))
    }
    if (parsed.scheme != "http" && parsed.scheme != "https") {
        throw TelemetryApiError(
            "Prometheus baseUrl must use http or https",
            0,
            null,
            mapOf("baseUrl" to baseUrl),
        )
    }
}

private fun parseEnvelope(statusCode: Int, bodyText: String): PrometheusInstantQueryData {
    val body = try {
        json.decodeFromString<PrometheusQueryEnvelope>(bodyText)
    } catch (_: Exception) {
        throw TelemetryApiError("Prometheus query failed ($statusCode)", statusCode)
    }

    if (statusCode !in 200..299 || body.status != "success" || body.data == null) {
        throw TelemetryApiError(
            body.error ?: "Prometheus query failed ($statusCode)",
            statusCode,
            body,
            buildMap {
                body.errorType?.let { put("errorType", it) }
            }.ifEmpty { null },
        )
    }

    return PrometheusInstantQueryData(
        resultType = body.data.resultType,
        result = body.data.result,
    )
}

private class OkHttpPrometheusClient(
    override val config: ResolvedPrometheusConfig,
    private val httpClient: OkHttpClient,
) : PrometheusClient {
    override suspend fun queryInstant(query: String, timeout: String?): PrometheusInstantQueryData =
        withContext(Dispatchers.IO) {
            val urlBuilder = "${config.baseUrl}/api/v1/query".toHttpUrl().newBuilder()
                .addQueryParameter("query", query)

            val effectiveTimeout = timeout ?: config.timeout
            if (effectiveTimeout != null) {
                urlBuilder.addQueryParameter("timeout", effectiveTimeout)
            }

            val requestBuilder = Request.Builder().url(urlBuilder.build())
            config.bearerToken?.let { token ->
                requestBuilder.header("Authorization", "Bearer $token")
            }

            var lastError: TelemetryApiError? = null
            repeat(3) { attempt ->
                httpClient.newCall(requestBuilder.build()).execute().use { response ->
                    val bodyText = response.body?.string().orEmpty()
                    try {
                        return@withContext parseEnvelope(response.code, bodyText)
                    } catch (error: TelemetryApiError) {
                        lastError = error
                        if (error.status == 503 && attempt < 2) {
                            return@use
                        }
                        throw error
                    }
                }
            }
            throw lastError ?: TelemetryApiError("Prometheus query failed", 0)
        }
}

fun createPrometheusClient(configInput: PrometheusClientConfig): PrometheusClient {
    val baseUrl = (
        configInput.baseUrl
            ?: System.getenv("PROMETHEUS_BASE_URL")
            ?: DEFAULT_PROMETHEUS_BASE_URL
        ).trimEnd('/')
    val bearerToken = configInput.bearerToken ?: System.getenv("PROMETHEUS_BEARER_TOKEN")

    assertHttpOrHttpsUrl(baseUrl)

    val resolved = ResolvedPrometheusConfig(
        baseUrl = baseUrl,
        bearerToken = bearerToken,
        timeout = configInput.timeout,
    )

    return OkHttpPrometheusClient(resolved, OkHttpClient())
}
